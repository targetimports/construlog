import { store } from '../entityStore.js';
import { podeAcessarObra } from '../escopoObra.js';
import { servicosDaObra, custoRealDaObra, r2 } from './custoServicoCore.js';

// Custo real acumulado por serviço do contrato — a metade que faltava.
//
// Junta o que a Fase 1 congelou (custo previsto no ContratoItem) com o que a
// Fase 2 passou a apontar (rateio do custo real), e devolve as duas colunas lado
// a lado por serviço e por etapa. É a matéria-prima do relatório de desvio.
//
// DUAS COLUNAS DE REAL, DE PROPÓSITO:
//   realizado    — origem já paga; é o que a DRE conta hoje.
//   comprometido — despesa assumida e ainda não paga.
// Somar os dois numa coluna só esconderia o aviso que chega antes do estrago;
// separá-los é o que o manual chama de custo comprometido.
//
// O QUE NÃO FOI APONTADO APARECE. Um relatório que só mostra o classificado
// sugere que a obra gastou menos do que gastou. A linha "não apontado" fecha a
// conta com a DRE e mede a qualidade do próprio apontamento.

const num = (v) => Number(v) || 0;

export default async function getCustoRealPorServico({ body, user }) {
  const { obra_id, competencia = null, ate_competencia = null } = body || {};

  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });
  if (!(await podeAcessarObra(user, obra_id))) {
    throw Object.assign(new Error('Sem acesso a esta obra.'), { status: 403 });
  }

  const { porId, versao, itens = [] } = await servicosDaObra(obra_id);
  if (!versao) {
    return { ok: true, obra_id, sem_contrato: true, servicos: [], etapas: [], totais: null };
  }

  // ── Custo apontado ────────────────────────────────────────────────────
  let apontamentos = await store.filter('ApontamentoCustoServico', { obra_id }, undefined, 50000).catch(() => []);
  if (competencia) apontamentos = apontamentos.filter((a) => a.competencia === competencia);
  if (ate_competencia) apontamentos = apontamentos.filter((a) => !a.competencia || a.competencia <= ate_competencia);

  const porServico = new Map();
  const zero = () => ({ realizado: 0, comprometido: 0, por_categoria: {} });
  for (const a of apontamentos) {
    const k = String(a.contrato_item_id);
    if (!porServico.has(k)) porServico.set(k, zero());
    const alvo = porServico.get(k);
    const v = num(a.valor);
    if (a.realizado) alvo.realizado = r2(alvo.realizado + v);
    else alvo.comprometido = r2(alvo.comprometido + v);
    const cat = a.categoria || 'indireto';
    alvo.por_categoria[cat] = r2(num(alvo.por_categoria[cat]) + v);
  }

  // ── Serviços com as duas metades ──────────────────────────────────────
  const servicos = itens.map((it) => {
    const real = porServico.get(String(it.id)) || zero();
    const previsto = r2(num(it.custo_total_previsto));
    const realizado = r2(real.realizado);
    return {
      contrato_item_id: it.id,
      codigo: it.item_codigo || '',
      descricao: it.descricao || it.item_label || '',
      etapa: it.etapa || 'Geral',
      unidade: it.unidade || '',
      qtd_contrato: num(it.qtd_contrato),
      venda_total: r2(num(it.total ?? it.preco_total)),
      custo_previsto: previsto,
      custo_realizado: realizado,
      custo_comprometido: r2(real.comprometido),
      por_categoria: real.por_categoria,
      tem_apontamento: realizado > 0 || real.comprometido > 0,
      // Sem linha-base não há desvio a calcular para este serviço. Marcar é
      // melhor que somar zero: zero se confunde com "no orçamento", e o
      // serviço passaria por controlado sem nunca ter sido comparado.
      sem_custo_previsto: previsto <= 0,
      custo_origem: it.custo_origem || null,
    };
  });

  // ── Etapas ────────────────────────────────────────────────────────────
  const etapasMap = new Map();
  for (const s of servicos) {
    if (!etapasMap.has(s.etapa)) {
      etapasMap.set(s.etapa, { etapa: s.etapa, servicos: 0, venda_total: 0, custo_previsto: 0, custo_realizado: 0, custo_comprometido: 0 });
    }
    const e = etapasMap.get(s.etapa);
    e.servicos += 1;
    e.venda_total = r2(e.venda_total + s.venda_total);
    e.custo_previsto = r2(e.custo_previsto + s.custo_previsto);
    e.custo_realizado = r2(e.custo_realizado + s.custo_realizado);
    e.custo_comprometido = r2(e.custo_comprometido + s.custo_comprometido);
  }

  // ── Fechamento com a DRE ──────────────────────────────────────────────
  // Todo o custo da obra, apontado ou não, na mesma régua da DRE — inclusive o
  // que ainda não tem como ser apontado (mensalista, frota, diárias). É o que
  // impede o relatório de dar uma impressão boa só porque parte do custo ficou
  // de fora da conta.
  const real = await custoRealDaObra(obra_id);
  const custoTotalObra = real.total_realizado;
  const custoComprometidoObra = real.origens_comprometido;

  const apontadoRealizado = servicos.reduce((s, x) => s + x.custo_realizado, 0);
  const apontadoComprometido = servicos.reduce((s, x) => s + x.custo_comprometido, 0);
  const previstoTotal = servicos.reduce((s, x) => s + x.custo_previsto, 0);
  const vendaTotal = servicos.reduce((s, x) => s + x.venda_total, 0);

  const naoApontadoRealizado = r2(custoTotalObra - apontadoRealizado);
  const cobertura = custoTotalObra > 0 ? r2((apontadoRealizado / custoTotalObra) * 100) : 0;

  return {
    ok: true,
    obra_id,
    contrato_versao_id: versao.id,
    servicos,
    etapas: [...etapasMap.values()].sort((a, b) => b.custo_previsto - a.custo_previsto),
    totais: {
      venda_total: r2(vendaTotal),
      custo_previsto: r2(previstoTotal),
      custo_realizado_apontado: r2(apontadoRealizado),
      custo_comprometido_apontado: r2(apontadoComprometido),
      // O universo, na mesma régua da DRE.
      custo_realizado_obra: custoTotalObra,
      custo_comprometido_obra: custoComprometidoObra,
      custo_nao_apontado: naoApontadoRealizado,
      cobertura_apontamento: cobertura,
      custo_nao_apontavel: real.nao_apontavel,
      detalhe_nao_apontavel: real.detalhe_nao_apontavel,
      servicos_com_apontamento: servicos.filter((s) => s.tem_apontamento).length,
      servicos_sem_previsto: servicos.filter((s) => s.sem_custo_previsto).length,
      servicos_total: servicos.length,
    },
  };
}
