import { store } from '../entityStore.js';

// Fatura uma medição APROVADA (entidade MedicaoObra): cria a ContaFinanceira
// (receber) vinculada, garante a categoria de receita e marca a medição como faturada.
export default async function faturarMedicaoObra({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  // Guard de safe-mode (Ops)
  const sysConfig = {};
  try {
    const cfgs = await store.filter('ConfiguracaoSistema', {}, undefined, 100);
    (cfgs || []).forEach((c) => { sysConfig[c.chave] = c.valor; });
  } catch { /* ignore */ }
  if (sysConfig.system_mode === 'safe') {
    throw Object.assign(new Error('Escrita bloqueada (SAFE_MODE)'), { status: 403 });
  }

  const { medicao_id, cliente_id, categoria_nome, centro_custo_id, data_vencimento } = body || {};
  if (!medicao_id) throw Object.assign(new Error('medicao_id é obrigatório'), { status: 400 });

  const medicaoList = await store.filter('MedicaoObra', { id: medicao_id }, null, 1);
  const medicao = medicaoList[0];
  if (!medicao) throw Object.assign(new Error('Medição não encontrada'), { status: 404 });
  if (medicao.status !== 'aprovada') {
    throw Object.assign(new Error(`Medição deve estar 'aprovada' para faturar. Status atual: '${medicao.status}'`), { status: 400 });
  }
  if (!medicao.obra_id) throw Object.assign(new Error('Medição deve ter obra_id vinculada para faturamento'), { status: 400 });

  // Categoria de receita (busca ou cria)
  const categoriaNome = categoria_nome || 'Receita de Obra';
  let categoria_id = null;
  const categoriaList = await store.filter('CategoriaFinanceira', { nome: categoriaNome });
  if (categoriaList && categoriaList.length > 0) {
    categoria_id = categoriaList[0].id;
  } else {
    const nova = await store.create('CategoriaFinanceira', { nome: categoriaNome, tipo: 'receita', grupo: 'servico', ativo: true });
    categoria_id = nova.id;
  }

  const conta = await store.create('ContaFinanceira', {
    descricao: `Faturamento Medição ${medicao.numero} - Obra`,
    valor: medicao.valor_total_medido,
    valor_recebido: 0,
    data_vencimento: data_vencimento || new Date().toISOString().split('T')[0],
    tipo: 'receber',
    status: 'pendente',
    obra_id: medicao.obra_id,
    cliente_id: cliente_id || null,
    categoria: categoria_id || 'Receita de Obra',
    centro_custo: centro_custo_id || null,
    referencia_tipo: 'medicao_obra',
    referencia_id: medicao_id,
    forma_pagamento: 'transferencia',
    observacao: `Gerada automaticamente da Medição de Obra ${medicao.numero}`,
    fornecedor_cliente: 'Cliente - Medição de Obra'
  });

  const medicaoAtualizada = await store.update('MedicaoObra', medicao_id, { status: 'faturada' });

  try {
    await store.create('LogAuditoria', {
      user_email: user.email, acao: 'faturar', modulo: 'medicao',
      entidade: 'MedicaoObra', entidade_id: medicao_id,
      dados_novos: { status: 'faturada', conta_receber_id: conta.id }, sucesso: true
    });
  } catch { /* auditoria best-effort */ }

  return { ok: true, medicao: medicaoAtualizada, conta, message: 'Medição faturada com sucesso' };
}
