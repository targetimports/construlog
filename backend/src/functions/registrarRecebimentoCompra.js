import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import processarMovimentacaoEstoque from './processarMovimentacaoEstoque.js';
import { criarEnvioEmTransito } from './criarEnvioEmTransito.js';

// CONFIRMA a compra de um Pedido: gera o pagamento e MANDA O MATERIAL DIRETO PARA A
// OBRA (em trânsito), sem passar pelo estoque Central.
//
// Modelo (cliente, 2026-07-17): material comprado para uma obra não entra no Central
// — a Central confirma/aprova a compra (nasce a conta a pagar do fornecedor) e o
// material segue direto para o almoxarifado da obra, onde o responsável faz a
// VISTORIA do recebimento (quantidade/quebra/fotos) na aba "Receber" do ObraDetalhes.
//
// Faz:
//   1) Recebimento (cabeçalho) + itens = documento da compra (NF, fornecedor, valor);
//   2) conta a pagar do fornecedor (o pagamento — pelo valor comprado);
//   3) envio "em trânsito" DIRETO para a obra (nenhuma movimentação no Central);
//   4) atualiza a quantidade do pedido e seu status.
//
// Fallback: pedido SEM obra (consolidado multi-obra / compra p/ o Central) mantém o
// comportamento antigo — entra no Central — para não quebrar esse caso.

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function registrarRecebimentoCompra({ body, user }) {
  requirePermission(user, 'COMPRAS_CREATE');
  const { pedido_id, itens = [], numero_nf = '', observacao = '', data_recebimento } = body || {};
  if (!pedido_id) throw Object.assign(new Error('Pedido não informado.'), { status: 400 });

  const pedido = (await store.filter('PedidoCompra', { id: pedido_id }))[0];
  if (!pedido) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });

  const pedidoItens = await store.filter('PedidoCompraItem', { pedido_id }, undefined, 1000);
  const itemById = Object.fromEntries(pedidoItens.map((i) => [i.id, i]));

  // Destino: almoxarifado da OBRA do pedido. Se o pedido não tem obra, cai no Central
  // (fallback do modelo antigo).
  const obra = pedido.obra_id ? (await store.filter('Obra', { id: pedido.obra_id }))[0] : null;
  const destinoObra = obra
    ? ((await store.filter('LocalEstoque', { obra_id: obra.id, nivel: 'OBRA' }))[0]
      || (await store.filter('LocalEstoque', { obra_id: obra.id, tipo: 'OBRA' }))[0])
    : null;
  const central = (await store.filter('LocalEstoque', { nivel: 'CENTRAL' }))[0];
  const direto = !!(obra && destinoObra);   // compra vai DIRETO para a obra
  if (!direto && !central) throw Object.assign(new Error('Estoque Central não configurado (pedido sem obra).'), { status: 400 });

  const linhas = (Array.isArray(itens) ? itens : [])
    .map((l) => ({ ...l, pcItem: itemById[l.pedido_item_id] }))
    .filter((l) => l.pcItem && num(l.quantidade_recebida) > 0);
  if (linhas.length === 0) throw Object.assign(new Error('Informe ao menos um item.'), { status: 400 });

  for (const l of linhas) {
    const restante = num(l.pcItem.quantidade_pedida) - num(l.pcItem.quantidade_recebida);
    if (num(l.quantidade_recebida) > restante + 0.001) {
      throw Object.assign(new Error(
        `Quantidade (${num(l.quantidade_recebida)}) excede o restante do item "${l.pcItem.material_nome || ''}" (${r2(restante)}).`,
      ), { status: 400 });
    }
  }

  const agora = data_recebimento || new Date().toISOString();
  const valorTotal = r2(linhas.reduce(
    (s, l) => s + num(l.quantidade_recebida) * num(l.preco_unitario ?? l.pcItem.preco_unitario), 0,
  ));

  const todosReceb = await store.filter('Recebimento', {}, '-created_date', 100000);
  const numeroReceb = `REC-${new Date().getFullYear()}-${String(todosReceb.length + 1).padStart(4, '0')}`;

  // 1) Documento da compra (NF, fornecedor, valor). local = obra (direto) ou Central.
  const recebimento = await store.create('Recebimento', {
    numero: numeroReceb,
    pedido_id: pedido.id,
    pedido_numero: pedido.numero || null,
    empresa_id: pedido.empresa_id || null,
    local_estoque_id: direto ? destinoObra.id : central.id,
    numero_nf: numero_nf || '',
    data_recebimento: agora,
    fornecedor_id: pedido.fornecedor_id || null,
    fornecedor_nome: pedido.fornecedor_nome || '',
    obra_id: pedido.obra_id || null,
    obra_nome: pedido.obra_nome || '',
    status: direto ? 'EM_TRANSITO' : 'CONFIRMADO',
    valor_total: valorTotal,
    observacao: observacao || '',
  }, user?.email || null);

  const itensMov = [];
  for (const l of linhas) {
    const it = l.pcItem;
    const qtd = num(l.quantidade_recebida);
    const preco = num(l.preco_unitario ?? it.preco_unitario);
    const itemId = it.insumo_id || it.material_id || null;

    await store.create('RecebimentoItem', {
      recebimento_id: recebimento.id,
      empresa_id: pedido.empresa_id || null,
      pedido_item_id: it.id,
      insumo_id: itemId, material_id: itemId,
      material_nome: it.material_nome || it.insumo_nome || '',
      material_unidade: it.material_unidade || it.insumo_unidade || '',
      quantidade_recebida: qtd,
      preco_unitario: preco,
      total_item: r2(qtd * preco),
    }, user?.email || null);

    // A quantidade "processada" do pedido sobe (foi comprada e despachada). O
    // recebimento REAL (vistoria) acontece na obra, mas para o pedido isto já
    // encerra o item — não se compra de novo o que foi comprado.
    await store.update('PedidoCompraItem', it.id, {
      quantidade_recebida: r2(num(it.quantidade_recebida) + qtd),
      preco_unitario: preco || num(it.preco_unitario),
      total_item: r2(num(it.quantidade_pedida) * (preco || num(it.preco_unitario))),
    });

    itensMov.push({
      insumo_id: itemId,
      insumo_nome: it.material_nome || it.insumo_nome || null,
      insumo_unidade: it.material_unidade || it.insumo_unidade || null,
      qtd,
      custo_unit: preco,
    });
  }

  // 2) Conta a pagar do fornecedor (o pagamento — pelo valor comprado).
  let conta_pagar_id = null;
  if (valorTotal > 0) {
    const dataRec = String(agora).split('T')[0];
    const conta = await store.create('ContaFinanceira', {
      tipo: 'pagar',
      empresa_id: pedido.empresa_id || null,
      obra_id: pedido.obra_id || null,
      obra_nome: pedido.obra_nome || '',
      descricao: `Compra ${pedido.numero || ''} · ${numeroReceb}${numero_nf ? ` · NF ${numero_nf}` : ''} — ${pedido.fornecedor_nome || 'fornecedor'}`.replace(/\s+/g, ' ').trim(),
      categoria: 'Material',
      valor: valorTotal,
      status: 'pendente',
      data_emissao: dataRec,
      data_vencimento: dataRec,
      fornecedor_cliente: pedido.fornecedor_nome || null,
      fornecedor_id: pedido.fornecedor_id || null,
      referencia_tipo: 'recebimento_compra',
      referencia_id: recebimento.id,
    }, user?.email || null);
    conta_pagar_id = conta.id;
  }

  // 3) Destino do material:
  let transito_requisicao_id = null;
  if (direto) {
    // DIRETO PARA A OBRA — nenhuma entrada/saída no Central. origem_local_id null:
    // veio do fornecedor (externo). Na vistoria, o "bom" entra na obra, o "quebrado"
    // vira perda; o que faltar é divergência com o fornecedor (não volta a lugar nenhum).
    const reqTransito = await criarEnvioEmTransito({
      obra,
      destino: destinoObra,
      origemLocalId: null,
      origemLocalNome: pedido.fornecedor_nome || 'Fornecedor',
      itens: itensMov,
      origem: 'compra',
      vinculo: {
        pedido_id: pedido.id,
        pedido_numero: pedido.numero || null,
        numero_nf: numero_nf || null,
        fornecedor_nome: pedido.fornecedor_nome || null,
      },
      user,
    });
    transito_requisicao_id = reqTransito?.id || null;
  } else {
    // Fallback (pedido sem obra): entra no Central, como antes.
    await processarMovimentacaoEstoque({
      body: {
        tipo: 'ENTRADA',
        destino_local_id: central.id,
        documento_ref: `${numeroReceb}${numero_nf ? ` · NF ${numero_nf}` : ''}`,
        observacao: `Recebimento do pedido ${pedido.numero || ''} (Central)`.trim(),
        itens: itensMov,
      },
      user,
    });
  }

  // 4) Status do pedido. Direto: fica "aguardando recebimento na obra" (a obra
  // confirma na vistoria). Central: RECEBIDO/PARCIAL como antes.
  const itensAtualizados = await store.filter('PedidoCompraItem', { pedido_id }, undefined, 1000);
  const totalPedido = itensAtualizados.reduce((s, i) => s + num(i.quantidade_pedida), 0);
  const totalProcessado = itensAtualizados.reduce((s, i) => s + num(i.quantidade_recebida), 0);
  let novoStatus = pedido.status;
  if (totalProcessado > 0) {
    const completo = totalProcessado + 0.001 >= totalPedido;
    novoStatus = direto ? (completo ? 'EM_TRANSITO' : 'PARCIAL') : (completo ? 'RECEBIDO' : 'PARCIAL');
  }
  await store.update('PedidoCompra', pedido.id, { status: novoStatus });

  return { ok: true, recebimento, pedido_status: novoStatus, conta_pagar_id, transito_requisicao_id, direto };
}
