import { store } from '../entityStore.js';

// Gera uma Viagem (Romaneio) a partir de um Pedido de Compra consolidado:
// uma parada por obra (a partir do rateio dos itens), com os itens a entregar.

const num = (v) => Number(v) || 0;

export default async function gerarViagemDePedidoConsolidado({ body, user }) {
  const { pedido_id } = body || {};
  if (!pedido_id) return { success: false, error: 'Pedido não informado.' };

  const pedidos = await store.filter('PedidoCompra', { id: pedido_id }, undefined, 1);
  const pedido = pedidos[0];
  if (!pedido) return { success: false, error: 'Pedido não encontrado.' };
  if (!pedido.consolidado) return { success: false, error: 'Viagem só pode ser gerada de pedidos consolidados.' };

  const itens = await store.filter('PedidoCompraItem', { pedido_id }, undefined, 1000);

  // Agrupa por obra a partir do rateio de cada item.
  const porObra = {};
  for (const it of itens) {
    const rateios = Array.isArray(it.rateio_obras) && it.rateio_obras.length
      ? it.rateio_obras
      : (pedido.obra_id ? [{ obra_id: pedido.obra_id, obra_nome: pedido.obra_nome, quantidade: it.quantidade_pedida }] : []);
    for (const r of rateios) {
      if (!r.obra_id || num(r.quantidade) <= 0) continue;
      if (!porObra[r.obra_id]) porObra[r.obra_id] = { obra_nome: r.obra_nome || '', local_estoque_id: r.local_estoque_id || null, local_estoque_nome: r.local_estoque_nome || null, itens: [] };
      porObra[r.obra_id].itens.push({
        material_id: it.material_id,
        material_nome: it.material_nome,
        material_unidade: it.material_unidade,
        quantidade_planejada: num(r.quantidade),
      });
    }
  }

  const obrasIds = Object.keys(porObra);
  if (obrasIds.length === 0) {
    return { success: false, error: 'Nenhum rateio por obra encontrado para gerar as paradas.' };
  }

  const todas = await store.filter('Viagem', {}, '-created_date', 100000);
  const numero = `VG-${new Date().getFullYear()}-${String(todas.length + 1).padStart(4, '0')}`;
  const viagem = await store.create('Viagem', {
    numero,
    status: 'PLANEJADA',
    data_saida: new Date().toISOString(),
    origem: 'Estoque Central',
    pedido_id,
    fornecedor_nome: pedido.fornecedor_nome || '',
    observacao: `Gerada automaticamente do pedido ${pedido.numero || pedido_id}`,
  }, user?.email || null);

  let ordem = 1;
  for (const obraId of obrasIds) {
    const o = porObra[obraId];
    const parada = await store.create('ParadaViagem', {
      viagem_id: viagem.id,
      ordem: ordem++,
      obra_id: obraId,
      obra_nome: o.obra_nome,
      local_estoque_id: o.local_estoque_id,
      local_estoque_nome: o.local_estoque_nome,
      status: 'PENDENTE',
    }, user?.email || null);
    for (const it of o.itens) {
      await store.create('ParadaViagemItem', {
        parada_viagem_id: parada.id,
        material_id: it.material_id,
        material_nome: it.material_nome,
        material_unidade: it.material_unidade,
        quantidade_planejada: it.quantidade_planejada,
        quantidade_entregue: 0,
      }, user?.email || null);
    }
  }

  return { success: true, message: `Viagem ${numero} criada com ${obrasIds.length} parada(s).`, viagem };
}
