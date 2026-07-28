import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import processarMovimentacaoEstoque from './processarMovimentacaoEstoque.js';

// Porte de processarRecebimentoMaterial: registra o recebimento de uma OC no
// depósito de destino, gera as movimentações de estoque (entrada) e atualiza a OC.
export default async function processarRecebimentoMaterial({ body, user }) {
  requirePermission(user, 'ESTOQUE_CREATE');
  const {
    ordem_compra_id, numero_oc, deposito_id, almoxarifado_id,
    itens = [], numero_nfe, data_nfe, observacoes, confirmacao_qualidade,
  } = body || {};

  if (!ordem_compra_id) throw Object.assign(new Error('ordem_compra_id obrigatório'), { status: 400 });
  const depId = deposito_id || almoxarifado_id;
  if (!depId) throw Object.assign(new Error('Selecione o depósito de destino'), { status: 400 });

  const oc = (await store.filter('OrdemCompra', { id: ordem_compra_id }))[0];
  if (!oc) throw Object.assign(new Error('Ordem de compra não encontrada'), { status: 404 });

  // Não permite receber acima do solicitado (tolerância 0%).
  for (const it of itens) {
    const rec = Number(it.quantidade_recebida) || 0;
    const sol = Number(it.quantidade_solicitada) || 0;
    if (rec > sol) {
      throw Object.assign(
        new Error(`Quantidade recebida (${rec}) maior que a solicitada (${sol}) no item "${it.descricao || ''}".`),
        { status: 400 }
      );
    }
  }

  const totalSolic = itens.reduce((s, i) => s + (Number(i.quantidade_solicitada) || 0), 0);
  const totalReceb = itens.reduce((s, i) => s + (Number(i.quantidade_recebida) || 0), 0);
  const statusEntrega = totalReceb > 0 && totalReceb >= totalSolic ? 'recebido_total' : 'parcial';

  const receb = await store.create('RecebimentoMaterial', {
    ordem_compra_id,
    numero_oc: numero_oc || oc.numero,
    requisicao_id: oc.requisicao_id || null,
    obra_id: oc.obra_id || null,
    deposito_id: depId,
    almoxarifado_id: depId,
    numero_nfe: numero_nfe || null,
    data_nfe: data_nfe || null,
    observacoes: observacoes || null,
    confirmacao_qualidade: !!confirmacao_qualidade,
    itens,
    status: statusEntrega,
    status_entrega: statusEntrega,
    data_recebimento: new Date().toISOString(),
    recebido_por: user?.email || null,
  }, user?.email || null);

  // Entrada de estoque pelo motor ÚNICO (grava EstoqueMovimentacao + SaldoEstoque
  // materializado). Antes gravava a entidade legada 'MovimentacaoEstoque', que as
  // telas de saldo atuais não leem → material recebido não aparecia no estoque.
  const itensEntrada = itens
    .filter((it) => (Number(it.quantidade_recebida) || 0) > 0)
    .map((it) => ({
      insumo_id: it.insumo_id,
      insumo_nome: it.descricao || null,
      qtd: Number(it.quantidade_recebida) || 0,
      custo_unit: Number(it.valor_unitario) || 0,
    }));
  if (itensEntrada.length) {
    await processarMovimentacaoEstoque({
      body: {
        tipo: 'ENTRADA',
        destino_local_id: depId,
        obra_id: oc.obra_id || null,
        documento_ref: `OC ${numero_oc || oc.numero || ''} · Receb. ${String(receb.id).slice(0, 8)}`.trim(),
        observacao: `Recebimento OC ${numero_oc || oc.numero || ''}`.trim(),
        itens: itensEntrada,
      },
      user,
    });
  }

  await store.update('OrdemCompra', ordem_compra_id, {
    status: statusEntrega === 'recebido_total' ? 'recebida' : 'parcial',
  }).catch(() => {});

  // Avança a requisição para "recebida" quando o recebimento for total
  // (habilita a etapa de envio ao Financeiro no fluxo).
  if (oc.requisicao_id && statusEntrega === 'recebido_total') {
    await store.update('RequisicaoCompra', oc.requisicao_id, { status: 'recebida' }).catch(() => {});
  }

  return { ok: true, recebimento_id: receb.id, status_entrega: statusEntrega };
}
