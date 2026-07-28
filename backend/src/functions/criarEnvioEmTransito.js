import { store } from '../entityStore.js';

// MOTOR ÚNICO do "envio em trânsito → obra", compartilhado por dois fluxos:
//   • REQUISIÇÃO de material (atenderRequisicaoObra): puxa do estoque interno;
//   • COMPRA (registrarRecebimentoCompra): o que chegou do fornecedor ao Central.
//
// Em ambos o material JÁ saiu da origem (a requisição faz SAIDA; a compra deu
// ENTRADA no Central e agora sai dele) e precisa virar um envio que a obra RECEBE
// com conferência/fotos/quebra pela MESMA aba "Receber" (receberTransferenciaObra).
//
// Modelo: o documento de trânsito é uma RequisicaoObra com status EM_TRANSITO. Para
// a compra, criamos uma requisição "sombra" (origem = 'compra', com pedido_id/NF),
// que difere só na etiqueta — o recebimento é idêntico. Assim não há um segundo
// mecanismo de recebimento para manter.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export async function criarEnvioEmTransito({
  obra, destino, origemLocalId, origemLocalNome, itens, origem = 'estoque', vinculo = {}, user,
}) {
  // itens: [{ insumo_id, insumo_nome, insumo_unidade, qtd }]
  const linhas = (itens || []).filter((i) => num(i.qtd) > 0);
  if (linhas.length === 0) return null;

  const req = await store.create('RequisicaoObra', {
    obra_id: obra.id,
    obra_nome: obra.nome || '',
    empresa_id: obra.empresa_id || null,
    status: 'EM_TRANSITO',
    origem_tipo: origem, // 'estoque' (requisição) ou 'compra'
    ...vinculo,          // pedido_id, pedido_numero, numero_nf, fornecedor_nome (compra)
    local_estoque_id: destino.id,
    destino_local_id: destino.id,
    destino_local_nome: destino.nome || null,
    data_envio: new Date().toISOString().split('T')[0],
    enviado_por_user_id: user?.email || null,
    solicitante_nome: origem === 'compra' ? (vinculo.fornecedor_nome || 'Compra') : (vinculo.solicitante_nome || null),
  }, user?.email || null);

  for (const it of linhas) {
    await store.create('RequisicaoObraItem', {
      requisicao_id: req.id,
      insumo_id: it.insumo_id,
      material_id: it.insumo_id,
      material_nome: it.insumo_nome || null,
      material_unidade: it.insumo_unidade || null,
      quantidade_solicitada: r2(it.qtd),
      quantidade_enviada: r2(it.qtd),
      quantidade_recebida: 0,
      quantidade_atendida: 0,
      origem_local_id: origemLocalId || null,
      origem_local_nome: origemLocalNome || null,
    }, user?.email || null);
  }

  return req;
}
