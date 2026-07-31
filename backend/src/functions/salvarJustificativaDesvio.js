import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';
import { servicosDaObra, r2 } from './custoServicoCore.js';

// JUSTIFICATIVA DO DESVIO — o que transforma relatório em gestão.
//
// Um número de desvio sozinho não muda nada: todo mês alguém olha, comenta e
// esquece. O que faz o desvio virar ação são três perguntas, nesta ordem:
//
//   1. É RECUPERÁVEL? Dá para trazer de volta até o fim da obra, ou o dinheiro
//      já foi? Isso decide se o caso é de plano de ação ou de reprevisão.
//   2. É PONTUAL OU RECORRENTE? Uma nota lançada errada é pontual. Um consumo
//      de material sistematicamente acima da composição é recorrente — e vai
//      acontecer de novo em todo serviço parecido.
//   3. Se é RECORRENTE, o que se faz? Ou o orçamento estava errado e precisa
//      ser atualizado, ou a execução está errada e precisa de plano de ação.
//      Deixar como está é a única resposta que o sistema não aceita.
//
// A justificativa é por SERVIÇO e por COMPETÊNCIA: o mesmo serviço pode desviar
// por um motivo em março e por outro em abril, e um fechamento não pode herdar
// a explicação do mês anterior sem que alguém a confirme.
//
// O VALOR DO DESVIO É CONGELADO no momento da justificativa. Se o custo mudar
// depois, a justificativa fica marcada como defasada em vez de passar a explicar
// um número que ninguém analisou.

const num = (v) => Number(v) || 0;
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

export const NATUREZAS = ['pontual', 'recorrente'];
export const ACOES = ['nenhuma', 'plano_acao', 'atualizar_orcamento'];

export default async function salvarJustificativaDesvio({ body, user }) {
  const {
    obra_id,
    contrato_item_id,
    competencia,
    desvio_valor,
    desvio_pct,
    recuperavel,
    motivo,
    natureza,
    acao = 'nenhuma',
    plano_acao,
    responsavel,
    prazo,
    remover = false,
  } = body || {};

  if (!obra_id) throw erro('obra_id é obrigatório');
  if (!contrato_item_id) throw erro('contrato_item_id é obrigatório');
  if (!/^\d{4}-\d{2}$/.test(String(competencia || ''))) throw erro('competencia deve estar no formato AAAA-MM');

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) throw erro('Obra não encontrada.', 404);
  if (!podeEditarObra(user, obra)) throw erro('Sem permissão para justificar desvios desta obra.', 403);

  const { porId, versao } = await servicosDaObra(obra_id);
  if (!versao) throw erro('A obra não tem contrato ativo.');
  if (!porId.has(String(contrato_item_id))) throw erro('O serviço informado não pertence a esta obra.');

  // Já existe justificativa para este serviço nesta competência?
  const existentes = await store.filter('JustificativaDesvio', { obra_id, contrato_item_id, competencia }, undefined, 10)
    .catch(() => []);

  if (remover) {
    for (const e of existentes) await store.delete('JustificativaDesvio', e.id).catch(() => {});
    return { ok: true, removidas: existentes.length };
  }

  // ── Validação: as três perguntas são obrigatórias ─────────────────────
  if (typeof recuperavel !== 'boolean') {
    throw erro('Informe se o desvio é recuperável até o fim da obra.');
  }
  if (!NATUREZAS.includes(natureza)) {
    throw erro(`Informe a natureza do desvio: ${NATUREZAS.join(' ou ')}.`);
  }
  const motivoLimpo = String(motivo || '').trim();
  if (motivoLimpo.length < 10) {
    throw erro('Descreva o motivo do desvio (ao menos 10 caracteres). "Sem justificativa" é a resposta que o controle existe para evitar.');
  }
  if (!ACOES.includes(acao)) throw erro('Ação inválida.');

  // Desvio recorrente exige decisão. Reconhecer que o problema vai se repetir e
  // não fazer nada é o caso que o controle existe para impedir.
  if (natureza === 'recorrente' && acao === 'nenhuma') {
    throw erro('Desvio recorrente exige uma decisão: abrir plano de ação ou atualizar o orçamento.');
  }
  const planoLimpo = String(plano_acao || '').trim();
  if (acao === 'plano_acao' && planoLimpo.length < 10) {
    throw erro('Descreva o plano de ação (ao menos 10 caracteres).');
  }
  if (acao === 'plano_acao' && !String(responsavel || '').trim()) {
    throw erro('Plano de ação sem responsável não sai do papel — informe quem responde por ele.');
  }

  const item = porId.get(String(contrato_item_id));
  const payload = {
    obra_id,
    empresa_id: obra.empresa_id || null,
    contrato_item_id,
    contrato_versao_id: versao.id,
    competencia,
    // Retrato do desvio no momento da análise: é ISTO que foi justificado.
    desvio_valor: r2(desvio_valor),
    desvio_pct: desvio_pct == null ? null : r2(desvio_pct),
    servico_descricao: item?.descricao || item?.item_label || null,
    etapa: item?.etapa || null,
    recuperavel,
    natureza,
    motivo: motivoLimpo.slice(0, 2000),
    acao,
    plano_acao: planoLimpo.slice(0, 2000) || null,
    responsavel: String(responsavel || '').trim() || null,
    prazo: prazo || null,
    status: acao === 'plano_acao' ? 'em_acao' : 'justificado',
    justificado_por: user?.email || null,
    justificado_em: new Date().toISOString(),
  };

  if (existentes[0]) {
    await store.update('JustificativaDesvio', existentes[0].id, payload);
    return { ok: true, id: existentes[0].id, atualizada: true };
  }
  const rec = await store.create('JustificativaDesvio', payload, user?.email || null);
  return { ok: true, id: rec.id, atualizada: false };
}
