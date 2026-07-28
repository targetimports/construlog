import { store } from '../entityStore.js';

const getOne = async (entity, id) => (await store.filter(entity, { id }, null, 1))[0];

// Confirma o recebimento de material de uma OC: cria o RecebimentoMaterial,
// marca a OC como recebida, dá ENTRADA no estoque (SaldoEstoque + MovimentacaoEstoque)
// e gera alerta se houver divergência entre solicitado e recebido.
export default async function confirmarRecebimentoMaterial({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { oc_id, itens_recebidos, almoxarifado_id, numero_nfe, data_nfe, observacoes } = body || {};
  if (!oc_id || !Array.isArray(itens_recebidos) || itens_recebidos.length === 0 || !almoxarifado_id) {
    throw Object.assign(new Error('oc_id, itens_recebidos e almoxarifado_id são obrigatórios'), { status: 400 });
  }

  const oc = await getOne('OrdemCompra', oc_id);
  if (!oc) throw Object.assign(new Error('Ordem de compra não encontrada'), { status: 404 });

  const agora = new Date().toISOString();

  const recebimento = await store.create('RecebimentoMaterial', {
    ordem_compra_id: oc_id, numero_oc: oc.numero, almoxarifado_id,
    fornecedor_id: oc.fornecedor_id, fornecedor_nome: oc.fornecedor_nome,
    itens: itens_recebidos.map((item) => ({ ...item, divergencia: (item.quantidade_recebida || 0) - (item.quantidade_solicitada || 0) })),
    data_recebimento: agora, responsavel_almoxarife: user.email,
    numero_nfe, data_nfe, status_recebimento: 'total', observacoes
  });

  const tem_divergencia = itens_recebidos.some((i) => (i.quantidade_recebida || 0) !== (i.quantidade_solicitada || 0));

  await store.update('OrdemCompra', oc_id, { status: 'recebida', status_entrega: 'recebido_total' });

  // Entrada no estoque (atualiza saldo existente ou cria novo)
  for (const item of itens_recebidos) {
    const saldos = await store.filter('SaldoEstoque', { insumo_id: item.insumo_id, almoxarifado_id });
    if (saldos.length > 0) {
      const s = saldos[0];
      const novo_total = (s.quantidade_total || 0) + (item.quantidade_recebida || 0);
      await store.update('SaldoEstoque', s.id, {
        quantidade_total: novo_total,
        quantidade_disponivel: novo_total - (s.quantidade_reservada || 0),
        data_ultima_movimentacao: agora
      });
    } else {
      const insumo = await getOne('Insumo', item.insumo_id);
      await store.create('SaldoEstoque', {
        insumo_id: item.insumo_id, almoxarifado_id,
        codigo_insumo: insumo?.codigo || '', descricao_insumo: insumo?.descricao || '', unidade: insumo?.unidade || '',
        quantidade_total: item.quantidade_recebida || 0, quantidade_disponivel: item.quantidade_recebida || 0,
        custo_unitario_medio: item.valor_unitario || 0,
        valor_total_estoque: (item.quantidade_recebida || 0) * (item.valor_unitario || 0),
        data_ultima_movimentacao: agora
      });
    }
  }

  // Movimentação de estoque (entrada)
  await store.create('MovimentacaoEstoque', {
    insumo_id: itens_recebidos[0].insumo_id, tipo: 'entrada',
    quantidade: itens_recebidos.reduce((sum, i) => sum + (i.quantidade_recebida || 0), 0),
    almoxarifado_destino_id: almoxarifado_id, ordem_compra_id: oc_id,
    data_movimentacao: agora.split('T')[0], responsavel: user.email,
    observacoes: `Recebimento OC ${oc.numero}`
  });

  if (tem_divergencia) {
    await store.create('AlertaInsumoOrcamento', {
      tipo_alerta: 'material_recebido_e_nao_distribuido', severidade: 'aviso',
      mensagem: `Divergência detectada no recebimento da OC ${oc.numero}`,
      dados_alerta: {
        oc_numero: oc.numero,
        itens_com_divergencia: itens_recebidos.filter((i) => (i.quantidade_recebida || 0) !== (i.quantidade_solicitada || 0)).length
      }
    });
  }

  return {
    recebimento_id: recebimento.id, oc_id, status: 'recebido',
    quantidade_total_recebida: itens_recebidos.reduce((sum, i) => sum + (i.quantidade_recebida || 0), 0),
    tem_divergencia,
    observacao: tem_divergencia ? 'Verifique as divergências registradas' : 'Material entrando no estoque central'
  };
}
