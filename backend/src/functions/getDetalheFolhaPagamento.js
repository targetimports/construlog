import { store } from '../entityStore.js';
import { can } from '../rbac.js';
import { custosHora, horasUteisDoMes } from './maoObraCore.js';

// Detalhamento da folha: para cada colaborador da folha, quantas horas ele trabalhou
// em CADA obra no mês da competência, o custo/hora do cadastro e o rateio do custo.
//
// Fonte das horas = ApontamentoMaoObra, que é alimentado pelo Ponto/Presença
// (ObraDetalhes → Equipe & Diário → Ponto/Presença): presente → horas_normais (8),
// falta → 0, mais horas_extra. O join usa `profissional_id` (campo presente em todos
// os apontamentos); `colaborador_id` fica como fallback para registros antigos.
//
// IMPORTANTE (regra da empresa): mensalista recebe salário FIXO — as horas NÃO calculam
// o pagamento. Elas mostram quanto do custo dele foi APLICADO em cada obra:
//     valor_aplicado = horas × custo real da hora
//     custo real da hora = total_item ÷ horas úteis do mês (dias úteis × 8h)
// É a MESMA fórmula do maoObraCore (usado na DRE da obra), para as duas telas contarem
// a mesma história. Quem trabalha o mês inteiro aplica ~100% do custo nas obras; o que
// sobra (faltas / dias sem apontamento) vem em `nao_alocado`.
//
// Somente leitura: não altera folha, apontamento nem financeiro.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const STATUS_FORA = new Set(['REJEITADO', 'CANCELADO', 'CANCELADA']);

export default async function getDetalheFolhaPagamento({ body, user }) {
  // Leitura: RH/Dep. Pessoal ou quem enxerga o financeiro.
  if (!can(user, 'RH_FOLHA') && !can(user, 'FINANCEIRO_VIEW')) {
    throw Object.assign(new Error('Sem permissão para ver o detalhamento da folha'), { status: 403 });
  }

  const { folha_id } = body || {};
  if (!folha_id) throw Object.assign(new Error('folha_id é obrigatório'), { status: 400 });

  const folha = (await store.filter('FolhaPagamento', { id: folha_id }))[0];
  if (!folha) throw Object.assign(new Error('Folha não encontrada'), { status: 404 });

  const competencia = String(folha.competencia || ''); // YYYY-MM
  const itens = (await store.filter('FolhaPagamentoItem', { folha_id }, undefined, 1000)) || [];
  if (itens.length === 0) return { ok: true, competencia, detalhes: {} };

  const idsColab = itens.map((i) => i.colaborador_id).filter(Boolean);
  const colabs = idsColab.length
    ? (await store.filter('Colaborador', { id: { $in: idsColab } }, undefined, 1000)) || []
    : [];
  const colabById = Object.fromEntries(colabs.map((c) => [c.id, c]));

  // Apontamentos do mês da competência (exclui rejeitado/cancelado).
  const aps = ((await store.filter('ApontamentoMaoObra', {}, undefined, 100000)) || [])
    .filter((a) => String(a.data || '').startsWith(competencia))
    .filter((a) => !STATUS_FORA.has(String(a.status || '').toUpperCase()));

  // Nomes das obras envolvidas.
  const idsObra = [...new Set(aps.map((a) => a.obra_id).filter(Boolean))];
  const obras = idsObra.length
    ? (await store.filter('Obra', { id: { $in: idsObra } }, undefined, 1000)) || []
    : [];
  const obraNome = Object.fromEntries(obras.map((o) => [o.id, o.nome]));

  // Agrupa por colaborador → obra.
  const porColab = {};
  for (const a of aps) {
    const cid = a.profissional_id || a.colaborador_id;
    if (!cid || !colabById[cid]) continue; // só quem está nesta folha
    const hn = num(a.horas_normais);
    const he = num(a.horas_extra);
    if (hn + he <= 0) continue;
    const oid = a.obra_id || '_sem_obra';
    ((porColab[cid] = porColab[cid] || {})[oid] = porColab[cid][oid] || { horas_normais: 0, horas_extra: 0, dias: 0 });
    porColab[cid][oid].horas_normais += hn;
    porColab[cid][oid].horas_extra += he;
    porColab[cid][oid].dias += 1;
  }

  // Monta o detalhe por item da folha, com o rateio proporcional às horas.
  const detalhes = {};
  for (const item of itens) {
    const cid = item.colaborador_id;
    const colab = colabById[cid];
    const porObra = porColab[cid] || {};
    const totalHoras = Object.values(porObra).reduce((s, o) => s + o.horas_normais + o.horas_extra, 0);

    // Hora base (custo do mês sem extras ÷ horas úteis) e hora extra (o que foi pago).
    // Exatamente a mesma função usada pela DRE (maoObraCore) — números batem.
    const { horaBase, horaExtra } = custosHora(colab, item, competencia);

    const obrasArr = Object.entries(porObra).map(([oid, o]) => {
      const horas = r2(o.horas_normais + o.horas_extra);
      return {
        obra_id: oid === '_sem_obra' ? null : oid,
        obra_nome: oid === '_sem_obra' ? 'Sem obra' : (obraNome[oid] || 'Obra'),
        dias: o.dias,
        horas_normais: r2(o.horas_normais),
        horas_extra: r2(o.horas_extra),
        horas_total: horas,
        // Custo aplicado = horas normais × hora base + horas extra × hora extra paga.
        valor_rateado: r2(o.horas_normais * horaBase + o.horas_extra * horaExtra),
      };
    }).sort((a, b) => b.horas_total - a.horas_total);

    const aplicado = r2(obrasArr.reduce((s, o) => s + o.valor_rateado, 0));

    detalhes[cid] = {
      colaborador_id: cid,
      colaborador_nome: colab?.nome || null,
      custo_hora: num(colab?.custo_hora),      // valor/hora do cadastro (salário ÷ 220 — referência legal)
      custo_hora_real: r2(horaBase),           // hora base (custo do mês sem extras ÷ horas úteis)
      custo_hora_extra: r2(horaExtra),         // o que se paga por hora extra
      horas_extra_pagas: num(item.horas_extra),
      valor_horas_extra: num(item.valor_horas_extra),
      horas_uteis_mes: horasUteisDoMes(competencia), // base do mês (dias úteis × 8h)
      total_item: num(item.total_item),        // o que ele custa no mês (folha)
      horas_total: r2(totalHoras),
      valor_aplicado: aplicado,                // total distribuído às obras
      // Parte do custo sem apontamento no mês (não caiu em nenhuma obra).
      nao_alocado: r2(Math.max(0, num(item.total_item) - aplicado)),
      obras: obrasArr,
    };
  }

  return { ok: true, competencia, folha_id, detalhes };
}
