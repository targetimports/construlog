import { store } from '../entityStore.js';

// Duplica uma composição (status rascunho, origem manual) junto com todos os seus itens.
export default async function duplicarComposicao({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { composicao_id } = body || {};
  if (!composicao_id) throw Object.assign(new Error('composicao_id é obrigatório'), { status: 400 });

  const [original] = await store.filter('Composicao', { id: composicao_id }, null, 1);
  if (!original) throw Object.assign(new Error('Composição não encontrada'), { status: 404 });

  const novaCodigo = `${original.codigo}_CÓPIA_${Date.now()}`.substring(0, 50);
  const novaComp = await store.create('Composicao', {
    codigo: novaCodigo,
    descricao: `${original.descricao} (Cópia)`,
    unidade: original.unidade,
    tipo: original.tipo,
    origem: 'manual',
    status: 'rascunho',
    data_referencia: original.data_referencia,
    estado: original.estado,
    desonerado: original.desonerado,
    atualizado_por: user.email
  });

  const itensOriginais = await store.filter('ComposicaoItem', { composicao_id });
  for (const item of itensOriginais) {
    await store.create('ComposicaoItem', {
      composicao_id: novaComp.id,
      insumo_id: item.insumo_id,
      codigo_insumo_snapshot: item.codigo_insumo_snapshot,
      descricao_insumo_snapshot: item.descricao_insumo_snapshot,
      unidade_snapshot: item.unidade_snapshot,
      grupo_snapshot: item.grupo_snapshot,
      preco_unitario_snapshot: item.preco_unitario_snapshot,
      coeficiente: item.coeficiente,
      perda_percent: item.perda_percent,
      custo_total_item: item.custo_total_item,
      ordem: item.ordem
    });
  }

  return {
    status: 'sucesso',
    composicao_original_id: composicao_id,
    composicao_nova_id: novaComp.id,
    composicao_nova: novaComp,
    itens_duplicados: itensOriginais.length
  };
}
