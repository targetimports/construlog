import { store } from '../entityStore.js';
import calcBMv2 from './calcBMv2.js';

// Porte de onBMApproveWithFinance: aprova a BM (recalcula e persiste os totais)
// e gera a Conta a Receber do período no Financeiro.
export default async function onBMApproveWithFinance({ body, user }) {
  const { bm_id, observacao_auditoria } = body || {};
  if (!bm_id) throw Object.assign(new Error('bm_id obrigatório'), { status: 400 });

  const bm = (await store.filter('BM', { id: bm_id }))[0];
  if (!bm) throw Object.assign(new Error('BM não encontrada'), { status: 404 });
  if (bm.status === 'APROVADA') {
    return { ok: true, ja_aprovada: true };
  }

  // Recalcula + persiste os itens/totais antes de aprovar.
  const calc = await calcBMv2({ body: { bm_id, persist: true, items_override: [] }, user });
  const totals = calc.totals;

  await store.update('BM', bm_id, {
    status: 'APROVADA',
    data_aprovacao: new Date().toISOString(),
    aprovada_por: user?.email || null,
    observacao_auditoria: observacao_auditoria || null,
    total_periodo: totals.total_periodo,
    total_anterior: totals.total_anterior,
    total_acumulado: totals.total_acumulado,
    total_contrato: totals.total_contrato,
    percent_concluida: totals.percent_concluida,
  });

  // Reflete a evolução físico-financeira na Obra: "Valor Realizado" (valor
  // medido acumulado), "% Consumido" e a barra de Progresso passam a refletir
  // a medição aprovada. Sem isso o realizado fica sempre R$ 0.
  await store.update('Obra', bm.obra_id, {
    valor_realizado: totals.total_acumulado || 0,
    percent_concluida_atual: totals.percent_concluida || 0,
    percentual_concluido: totals.percent_concluida || 0,
  }).catch(() => {});

  // Configuração financeira da obra (desconto, retenção e toggles).
  // Preferência: config do contrato; fallback: config da obra.
  let cfg = (await store.filter('ConfiguracaoMedicao', { obra_id: bm.obra_id, contrato_versao_id: bm.contrato_versao_id }))[0]
         || (await store.filter('ConfiguracaoMedicao', { obra_id: bm.obra_id }))[0]
         || null;
  const cfgAtiva = cfg ? cfg.ativo !== false : false;
  const pctDesconto = cfgAtiva ? (Number(cfg.percentual_desconto) || 0) : 0;
  const pctRetencao = cfgAtiva ? (Number(cfg.percentual_retencao) || 0) : 0;
  // Toggle "Gerar ContaReceber Automaticamente" (default: gera).
  const gerarContaReceber = cfg ? cfg.gerar_conta_receber_automaticamente !== false : true;

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const bruto = totals.total_periodo;
  const valorDesconto = r2(bruto * (pctDesconto / 100));      // desconto sobre o bruto
  const baseAposDesconto = r2(bruto - valorDesconto);
  const valorRetido = r2(baseAposDesconto * (pctRetencao / 100)); // retenção após desconto
  const valorLiquido = r2(baseAposDesconto - valorRetido);

  // Conta a Receber do valor medido no período (líquido de desconto/retenção).
  let contaReceberId = null;
  if (gerarContaReceber && bruto > 0) {
    const obra = (await store.filter('Obra', { id: bm.obra_id }))[0] || {};
    const venc = new Date();
    venc.setDate(venc.getDate() + 30);
    const cr = await store.create('ContaFinanceira', {
      tipo: 'receber',
      obra_id: bm.obra_id,
      descricao: `Medição BM #${bm.numero}`,
      fornecedor_cliente: obra.cliente || obra.cliente_nome || null,
      cliente_id: obra.cliente_id || null,
      valor: valorLiquido,
      valor_bruto: bruto,
      percentual_desconto: pctDesconto,
      valor_desconto: valorDesconto,
      percentual_retencao: pctRetencao,
      valor_retido: valorRetido,
      status: 'pendente',
      categoria: 'medicao',
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: venc.toISOString().split('T')[0],
      referencia_tipo: 'bm',
      referencia_id: bm_id,
    }, user?.email || null);
    contaReceberId = cr.id;
    // Modelo financeiro ÚNICO = ContaFinanceira (acima). Não criamos mais
    // LancamentoFinanceiro paralelo (entidade legada, não lida pelas telas).
  }

  return {
    ok: true,
    conta_receber_id: contaReceberId,
    conta_receber_valor: valorLiquido,
    valor_bruto: bruto,
    valor_desconto: valorDesconto,
    valor_retido: valorRetido,
  };
}
