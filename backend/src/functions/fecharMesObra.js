import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';
import { podeAcessarObra } from '../escopoObra.js';
import { ORIGENS, prepararOrigens, r2 } from './custoServicoCore.js';
import getDesvioObra from './getDesvioObra.js';

// FECHAMENTO MENSAL DA OBRA.
//
// Sem fechamento, a margem de março continua mudando em junho: chega uma nota
// atrasada, alguém corrige um apontamento, e o número que a diretoria analisou
// deixa de existir. Nenhuma análise se sustenta assim — e ninguém confia num
// relatório cujo passado se mexe.
//
// Fechar o mês faz duas coisas:
//   1. CONFERE antes (a lista abaixo). Fechar com pendência é congelar um
//      retrato errado, o que é pior que não fechar.
//   2. CONGELA o retrato: os números do mês ficam gravados no FechamentoObra,
//      e é dali que os relatórios históricos passam a ler.
//
// O QUE TRAVA E O QUE APENAS AVISA
//
// Trava: desvio relevante sem justificativa. É a razão de o fechamento existir
// — se o mês pudesse fechar com desvio inexplicado, a rotina inteira viraria
// carimbo.
//
// Avisa: custo sem apontamento, BM não aprovada, contas em aberto. São
// pendências reais, mas de outras áreas; travar por elas emperraria a obra por
// motivo que o engenheiro não controla. Quem fecha assume, por escrito, o que
// ficou pendente — fica gravado no retrato.

const num = (v) => Number(v) || 0;
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const ehCompetencia = (c) => /^\d{4}-\d{2}$/.test(String(c || ''));

// Monta a lista de conferência. Usada tanto pela tela (antes de fechar) quanto
// pelo próprio fechamento — assim não existe caminho que pule a checagem.
async function conferir(obra_id, competencia, user) {
  const desvio = await getDesvioObra({ body: { obra_id, competencia }, user });
  if (desvio.sem_contrato) {
    return { pode_fechar: false, itens: [{ chave: 'contrato', nivel: 'bloqueio', titulo: 'Obra sem contrato ativo', detalhe: 'Gere o contrato a partir do orçamento.' }], desvio: null };
  }
  const t = desvio.totais;
  const itens = [];

  // ── Bloqueio ────────────────────────────────────────────────────────
  if (t.pendentes_justificativa > 0) {
    itens.push({
      chave: 'justificativas',
      nivel: 'bloqueio',
      titulo: `${t.pendentes_justificativa} desvio(s) sem justificativa`,
      detalhe: 'Todo desvio relevante do mês precisa de motivo, natureza e decisão antes do fechamento.',
    });
  }

  // ── Avisos ──────────────────────────────────────────────────────────
  if (num(t.cobertura_apontamento) < 100 && num(t.custo_nao_apontado) > 0) {
    itens.push({
      chave: 'apontamento',
      nivel: 'aviso',
      titulo: `${r2(t.custo_nao_apontado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de custo sem serviço`,
      detalhe: `Só ${num(t.cobertura_apontamento).toFixed(0)}% do custo real está apontado. O desvio do mês cobre apenas essa parte.`,
    });
  }

  const bmsMes = (await store.filter('BM', { obra_id }, undefined, 500).catch(() => []))
    .filter((b) => String(b.data_fim || b.data_aprovacao || '').slice(0, 7) === competencia);
  const rascunhos = bmsMes.filter((b) => String(b.status || '').toUpperCase() === 'RASCUNHO');
  if (rascunhos.length) {
    itens.push({
      chave: 'bm_rascunho',
      nivel: 'aviso',
      titulo: `${rascunhos.length} medição(ões) em rascunho na competência`,
      detalhe: 'Medição não aprovada não entra no avanço nem no desvio do mês.',
    });
  }
  if (!bmsMes.some((b) => String(b.status || '').toUpperCase() === 'APROVADA')) {
    itens.push({
      chave: 'sem_bm',
      nivel: 'aviso',
      titulo: 'Nenhuma medição aprovada nesta competência',
      detalhe: 'O avanço do mês virá do acumulado anterior.',
    });
  }

  let contasAbertas = 0;
  const ctx = await prepararOrigens(obra_id);
  for (const [tipo, desc] of Object.entries(ORIGENS)) {
    const regs = await store.filter(desc.entidade, { obra_id }, '-created_date', 20000).catch(() => []);
    for (const reg of regs) {
      if (!desc.aceita(reg) || desc.realizado(reg)) continue;
      if (r2(desc.valor(reg, ctx[tipo])) <= 0) continue;
      const d = desc.data(reg);
      if (d && String(d).slice(0, 7) <= competencia) contasAbertas += 1;
    }
  }
  if (contasAbertas) {
    itens.push({
      chave: 'contas_abertas',
      nivel: 'aviso',
      titulo: `${contasAbertas} despesa(s) em aberto até esta competência`,
      detalhe: 'Custo comprometido que ainda não virou custo real — vai pesar num mês seguinte.',
    });
  }

  return { pode_fechar: !itens.some((i) => i.nivel === 'bloqueio'), itens, desvio };
}

// ── Conferência (só leitura, para a tela) ────────────────────────────────
export async function getConferenciaFechamento({ body, user }) {
  const { obra_id, competencia } = body || {};
  if (!obra_id) throw erro('obra_id é obrigatório');
  if (!(await podeAcessarObra(user, obra_id))) throw erro('Sem acesso a esta obra.', 403);

  const comp = ehCompetencia(competencia) ? competencia : new Date().toISOString().slice(0, 7);
  const jaFechado = (await store.filter('FechamentoObra', { obra_id, competencia: comp }, undefined, 5).catch(() => []))
    .find((f) => f.status === 'fechado') || null;

  const { pode_fechar, itens, desvio } = await conferir(obra_id, comp, user);
  return {
    ok: true,
    obra_id,
    competencia: comp,
    ja_fechado: !!jaFechado,
    fechamento: jaFechado || null,
    pode_fechar: pode_fechar && !jaFechado,
    conferencia: itens,
    resumo: desvio?.totais || null,
  };
}

// ── Fechar ───────────────────────────────────────────────────────────────
export default async function fecharMesObra({ body, user }) {
  const { obra_id, competencia, observacao } = body || {};
  if (!obra_id) throw erro('obra_id é obrigatório');
  if (!ehCompetencia(competencia)) throw erro('competencia deve estar no formato AAAA-MM');

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) throw erro('Obra não encontrada.', 404);
  if (!podeEditarObra(user, obra)) throw erro('Sem permissão para fechar o mês desta obra.', 403);

  // Não se fecha um mês que ainda não terminou: o retrato nasceria incompleto.
  const mesCorrente = new Date().toISOString().slice(0, 7);
  if (competencia > mesCorrente) throw erro('Não é possível fechar uma competência futura.');

  const existente = (await store.filter('FechamentoObra', { obra_id, competencia }, undefined, 5).catch(() => []))[0];
  if (existente && existente.status === 'fechado') {
    throw erro(`A competência ${competencia} já está fechada. Reabra antes de fechar de novo.`, 409);
  }

  const { pode_fechar, itens, desvio } = await conferir(obra_id, competencia, user);
  if (!pode_fechar) {
    const bloqueios = itens.filter((i) => i.nivel === 'bloqueio');
    throw Object.assign(
      new Error(`Não é possível fechar: ${bloqueios.map((b) => b.titulo).join('; ')}.`),
      { status: 400, detail: { conferencia: itens } },
    );
  }

  const t = desvio.totais;
  const payload = {
    obra_id,
    empresa_id: obra.empresa_id || null,
    competencia,
    status: 'fechado',
    // RETRATO CONGELADO. É a razão de o fechamento existir: os relatórios
    // históricos leem daqui, e não de um recálculo que mudaria a cada nota
    // atrasada que chegasse depois.
    retrato: {
      venda_contrato: t.venda_contrato,
      receita_medida: t.receita_medida,
      avanco_pct: t.avanco_pct,
      custo_previsto_executado: t.custo_previsto_executado,
      custo_real_apontado: t.custo_real_apontado,
      custo_real_obra: t.custo_real_obra,
      custo_nao_apontado: t.custo_nao_apontado,
      cobertura_apontamento: t.cobertura_apontamento,
      desvio: t.desvio,
      desvio_pct: t.desvio_pct,
      custo_pendente: t.custo_pendente,
      custo_final_projetado: t.custo_final_projetado,
      margem_prevista_pct: t.margem_prevista_pct,
      margem_projetada_pct: t.margem_projetada_pct,
      resultado_projetado: t.resultado_projetado,
      ultima_bm: desvio.ultima_bm?.numero ?? null,
    },
    // Pendências assumidas por quem fechou: ficam no registro para que, meses
    // depois, se saiba em que condições aquele número foi congelado.
    pendencias: itens.filter((i) => i.nivel === 'aviso').map((i) => i.titulo),
    observacao: String(observacao || '').trim().slice(0, 1000) || null,
    fechado_por: user?.email || null,
    fechado_em: new Date().toISOString(),
  };

  if (existente) {
    await store.update('FechamentoObra', existente.id, payload);
    return { ok: true, id: existente.id, competencia, reaberto_antes: true, pendencias: payload.pendencias };
  }
  const rec = await store.create('FechamentoObra', payload, user?.email || null);
  return { ok: true, id: rec.id, competencia, pendencias: payload.pendencias, retrato: payload.retrato };
}

// ── Reabrir ──────────────────────────────────────────────────────────────
// Reabrir é legítimo (nota que chegou atrasada existe), mas fica registrado:
// quem reabriu, quando e por quê. Fechamento que se desfaz em silêncio não
// vale mais que não ter fechamento.
export async function reabrirMesObra({ body, user }) {
  const { obra_id, competencia, motivo } = body || {};
  if (!obra_id || !ehCompetencia(competencia)) throw erro('obra_id e competencia (AAAA-MM) são obrigatórios');

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) throw erro('Obra não encontrada.', 404);
  if (!podeEditarObra(user, obra)) throw erro('Sem permissão para reabrir o mês desta obra.', 403);

  const motivoLimpo = String(motivo || '').trim();
  if (motivoLimpo.length < 10) throw erro('Explique por que o mês está sendo reaberto (ao menos 10 caracteres).');

  const existente = (await store.filter('FechamentoObra', { obra_id, competencia }, undefined, 5).catch(() => []))[0];
  if (!existente || existente.status !== 'fechado') throw erro('Esta competência não está fechada.', 400);

  const historico = Array.isArray(existente.historico_reaberturas) ? existente.historico_reaberturas : [];
  await store.update('FechamentoObra', existente.id, {
    status: 'reaberto',
    historico_reaberturas: [
      ...historico,
      { em: new Date().toISOString(), por: user?.email || null, motivo: motivoLimpo.slice(0, 1000), retrato_anterior: existente.retrato },
    ],
  });

  return { ok: true, competencia, reaberturas: historico.length + 1 };
}
