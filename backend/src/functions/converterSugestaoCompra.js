import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Converte (parcial ou totalmente) uma SugestaoCompra em uma SolicitacaoCompra.
// Marca a sugestão como 'convertida' (ou 'parcial' se nem todos os itens foram).

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function converterSugestaoCompra({ body, user }) {
  requirePermission(user, 'COMPRAS_VIEW');

  const { sugestao_id, tipo, obra_id, obra_nome, itens_selecionados } = body || {};
  if (!sugestao_id) return { success: false, error: 'Sugestão não informada.' };

  const sug = (await store.filter('SugestaoCompra', { id: sugestao_id }))[0];
  if (!sug) return { success: false, error: 'Sugestão não encontrada.' };

  const sel = new Set(Array.isArray(itens_selecionados) ? itens_selecionados : []);
  const itens = (sug.itens || []).filter((i) => sel.size === 0 || sel.has(i.material_id));
  if (itens.length === 0) return { success: false, error: 'Nenhum item selecionado.' };

  const valorTotal = r2(itens.reduce((s, i) => s + num(i.valor_estimado), 0));
  const obraIdLimpo = (obra_id && String(obra_id).trim()) ? String(obra_id).trim() : null;

  const sc = await store.create('SolicitacaoCompra', {
    origem: 'sugestao_estoque',
    sugestao_id,
    tipo: tipo || 'solicitacao_compra',
    obra_id: obraIdLimpo,
    obra_nome: obra_nome || null,
    status: tipo === 'ordem_compra' ? 'pre_aprovada' : 'pendente',
    qtd_itens: itens.length,
    valor_total_estimado: valorTotal,
    solicitante_user_id: user?.id || null,
    solicitante_nome: user?.full_name || user?.email || null,
    data_solicitacao: new Date().toISOString(),
    itens: itens.map((i) => ({
      material_id: i.material_id,
      material_nome: i.material_nome,
      unidade: i.unidade,
      quantidade: num(i.sugerido),
      valor_estimado: num(i.valor_estimado),
      motivo: i.motivo,
    })),
  }, user?.email || null);

  const totalItens = (sug.itens || []).length;
  const novoStatus = itens.length >= totalItens ? 'convertida' : 'parcial';
  await store.update('SugestaoCompra', sugestao_id, {
    status: novoStatus,
    convertida_em: new Date().toISOString(),
    solicitacao_compra_id: sc.id,
  });

  const tipoLabel = tipo === 'ordem_compra' ? 'SC pré-aprovada' : 'Solicitação de Compra';
  return { success: true, message: `${tipoLabel} criada com ${itens.length} item(ns).`, solicitacao_id: sc.id, status: novoStatus };
}
