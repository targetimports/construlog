import { store } from '../entityStore.js';

// Porte de ativarObraAPartirDoOrcamento: promove o orçamento a "vigente" e
// coloca a obra em execução, liberando todos os módulos da obra.
export default async function ativarObraAPartirDoOrcamento({ body }) {
  const { orcamento_id } = body || {};
  if (!orcamento_id) {
    throw Object.assign(new Error('orcamento_id obrigatório'), { status: 400 });
  }

  const orcamentos = (await store.filter('Orcamento', { id: orcamento_id })) || [];
  const orcamento = orcamentos[0];
  if (!orcamento) {
    throw Object.assign(new Error('Orçamento não encontrado'), { status: 404 });
  }

  const obraId = orcamento.obra_id;
  if (!obraId) {
    throw Object.assign(new Error('Orçamento não está vinculado a uma obra'), { status: 400 });
  }

  // 1. Orçamento → vigente
  await store.update('Orcamento', orcamento_id, {
    status: 'vigente',
    data_ativacao: new Date().toISOString(),
  });

  // 2. Obra → em execução, com os totais do orçamento espelhados
  await store.update('Obra', obraId, {
    status: 'em_andamento',
    orcamento_aprovado: true,
    orcamento_ativo_id: orcamento_id,
    valor_orcado: orcamento.valor_total || 0,
    total_orcamento: orcamento.valor_total || 0,
  });

  return { obra_id: obraId, orcamento_id, status: 'vigente' };
}
