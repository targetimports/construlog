import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';
import processarMovimentacaoEstoque from './processarMovimentacaoEstoque.js';

// RECEBIMENTO na obra do material que o "Atender" mandou (2º passo do fluxo).
//
// O envio (atenderRequisicaoObra) TIROU o material da Central/Empresa e deixou "em
// trânsito" — não creditou a obra. Aqui o RESPONSÁVEL DA OBRA confere e recebe,
// classificando o que veio EM TRÊS DESTINOS (a soma tem que dar o enviado):
//   • RECEBIDO (bom)   → entra no almoxarifado da obra;
//   • QUEBRADO (perda) → NÃO volta para a origem (seria estoque fantasma) nem entra
//                        na obra: é registrado como PERDA (baixa definitiva, com
//                        rastro EstoqueMovimentacao na obra). O material acabou.
//   • FALTOU (não veio)→ volta para a ORIGEM (ainda existe lá / a conferir); o item
//                        continua pendente e pode ser reenviado.
//
// Foi o cliente que separou os casos: material quebrado se PERDE — devolver ao
// estoque de origem inflaria a Central com material que não existe mais.
//
// Fecha a requisição (BAIXADA) quando todo o pedido foi recebido; se sobrou para
// enviar (faltou ou quebrou), volta para APROVADA e o restante pode ser reenviado.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function receberTransferenciaObra({ body, user }) {
  const { requisicao_id, itens = [], fotos = [], observacao } = body || {};
  if (!requisicao_id) throw Object.assign(new Error('requisicao_id obrigatório'), { status: 400 });

  const req = (await store.filter('RequisicaoObra', { id: requisicao_id }))[0];
  if (!req) throw Object.assign(new Error('Requisição não encontrada'), { status: 404 });
  if (req.status !== 'EM_TRANSITO') {
    throw Object.assign(new Error('Não há material em trânsito para receber nesta requisição.'), { status: 400 });
  }

  const obra = (await store.filter('Obra', { id: req.obra_id }))[0];
  if (!obra) throw Object.assign(new Error('Obra da requisição não encontrada'), { status: 404 });
  if (!podeEditarObra(user, obra)) {
    throw Object.assign(new Error('Apenas responsáveis pela obra podem receber material.'), { status: 403 });
  }

  const destino = req.destino_local_id ? (await store.filter('LocalEstoque', { id: req.destino_local_id }))[0] : null;
  if (!destino) throw Object.assign(new Error('Almoxarifado de destino da obra não encontrado.'), { status: 400 });

  const reqItens = await store.filter('RequisicaoObraItem', { requisicao_id }, undefined, 1000);
  const itemById = Object.fromEntries(reqItens.map((i) => [i.id, i]));
  const recebidoInput = Object.fromEntries((Array.isArray(itens) ? itens : []).map((l) => [l.requisicao_item_id, l]));

  const docRef = `REC ${String(requisicao_id).slice(0, 8)}`;
  const agora = new Date().toISOString();
  const entradasObra = [];         // o que efetivamente entra na obra (bom)
  const devolucoesPorOrigem = {};  // o que FALTOU volta para cada origem
  let totalPerdido = 0;

  for (const ri of reqItens) {
    const emTransito = r2(num(ri.quantidade_enviada) - num(ri.quantidade_recebida));
    if (emTransito <= 0.0001) continue;

    const insumoId = ri.insumo_id || ri.material_id;
    const base = { insumo_id: insumoId, insumo_nome: ri.material_nome || ri.insumo_nome || null, insumo_unidade: ri.material_unidade || null };

    // Três destinos, com clamp para a soma nunca passar do enviado:
    //   recebido (default = tudo) → obra ; quebrado → perda ; resto → volta à origem.
    const pedido = recebidoInput[ri.id] || {};
    let recebido = pedido.quantidade_recebida != null ? r2(num(pedido.quantidade_recebida)) : emTransito;
    let quebrado = pedido.quantidade_quebrada != null ? r2(num(pedido.quantidade_quebrada)) : 0;
    if (recebido < 0) recebido = 0;
    if (recebido > emTransito) recebido = emTransito;
    if (quebrado < 0) quebrado = 0;
    if (quebrado > emTransito - recebido) quebrado = r2(emTransito - recebido);
    const faltou = r2(emTransito - recebido - quebrado);

    if (recebido > 0.0001) entradasObra.push({ ...base, qtd: recebido });
    if (faltou > 0.0001 && ri.origem_local_id) {
      (devolucoesPorOrigem[ri.origem_local_id] ||= []).push({ ...base, qtd: faltou });
    }
    // PERDA: material quebrado não volta a nenhum saldo. Fica só o rastro de
    // auditoria (movimento tipo PERDA, ligado à obra), para a perda ser visível.
    if (quebrado > 0.0001) {
      totalPerdido += quebrado;
      await store.create('EstoqueMovimentacao', {
        tipo: 'PERDA',
        empresa_id: obra.empresa_id || null,
        obra_id: obra.id,
        origem_local_id: ri.origem_local_id || null,
        destino_local_id: null,
        insumo_id: insumoId, insumo_nome: base.insumo_nome, insumo_unidade: base.insumo_unidade,
        material_id: insumoId, material_nome: base.insumo_nome, material_unidade: base.insumo_unidade,
        quantidade: quebrado, qtd_itens: 1,
        documento_ref: docRef,
        observacao: `Perda no recebimento (material quebrado/danificado) — obra ${obra.nome || ''}`.trim(),
        data_mov: agora,
        registrado_por: user?.email || null,
      }, user?.email || null);
    }

    // Sai de trânsito o que foi resolvido (recebido + quebrado + faltou = tudo).
    // enviada reduz por quebrado+faltou (voltou/perdeu-se) e recebida sobe por recebido.
    await store.update('RequisicaoObraItem', ri.id, {
      quantidade_recebida: r2(num(ri.quantidade_recebida) + recebido),
      quantidade_atendida: r2(num(ri.quantidade_recebida) + recebido), // o que está na obra
      quantidade_perdida: r2(num(ri.quantidade_perdida) + quebrado),
      quantidade_enviada: r2(num(ri.quantidade_enviada) - quebrado - faltou),
    });
  }

  // Credita a obra com o recebido bom.
  if (entradasObra.length) {
    await processarMovimentacaoEstoque({
      body: { tipo: 'ENTRADA', destino_local_id: destino.id, documento_ref: docRef, observacao: `Recebimento de material — obra ${obra.nome || ''}`.trim(), itens: entradasObra },
      user,
    });
  }
  // Devolve o que FALTOU (não chegou) para cada origem — isso ainda existe.
  for (const [origemId, itensDev] of Object.entries(devolucoesPorOrigem)) {
    await processarMovimentacaoEstoque({
      body: { tipo: 'ENTRADA', destino_local_id: origemId, documento_ref: docRef, observacao: `Devolução — não recebido na obra ${obra.nome || ''}`.trim(), itens: itensDev },
      user,
    });
  }

  // Status final: BAIXADA se todo o pedido já foi recebido; senão APROVADA (pode
  // enviar o que faltou). Enquanto ainda houver algo em trânsito, segue EM_TRANSITO.
  const atualizados = await store.filter('RequisicaoObraItem', { requisicao_id }, undefined, 1000);
  const aindaEmTransito = atualizados.some((i) => num(i.quantidade_enviada) - num(i.quantidade_recebida) > 0.001);
  const tudoRecebido = atualizados.every((i) => num(i.quantidade_recebida) + 0.001 >= num(i.quantidade_solicitada));
  // COMPRA: a vistoria ENCERRA (BAIXADA) assim que nada mais está em trânsito —
  // quebra é sinistro com o fornecedor, não vira re-pedido automático.
  // REQUISIÇÃO interna: o que faltou voltou ao Central e pode ser reenviado, então
  // reabre APROVADA se não recebeu tudo que foi pedido.
  const ehCompra = req.origem_tipo === 'compra';
  const novoStatus = aindaEmTransito
    ? 'EM_TRANSITO'
    : (ehCompra || tudoRecebido) ? 'BAIXADA' : 'APROVADA';

  const fotosAntes = Array.isArray(req.fotos_recebimento) ? req.fotos_recebimento : [];
  await store.update('RequisicaoObra', requisicao_id, {
    status: novoStatus,
    data_recebimento: new Date().toISOString().split('T')[0],
    recebido_por_user_id: user?.email || null,
    fotos_recebimento: [...fotosAntes, ...(Array.isArray(fotos) ? fotos : [])].filter(Boolean),
    observacao_recebimento: observacao || req.observacao_recebimento || null,
  });

  // Compra concluída: quando a vistoria fecha o trânsito (BAIXADA), o Pedido vira
  // RECEBIDO — é a obra que dá a compra por recebida.
  if (novoStatus === 'BAIXADA' && ehCompra && req.pedido_id) {
    await store.update('PedidoCompra', req.pedido_id, { status: 'RECEBIDO' }).catch(() => {});
  }

  return {
    ok: true,
    status: novoStatus,
    requisicao_id,
    itens_recebidos: entradasObra.length,
    devolucoes: Object.keys(devolucoesPorOrigem).length,
    total_perdido: r2(totalPerdido),
  };
}
