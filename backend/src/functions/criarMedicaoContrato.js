import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Cria uma medição de um contrato (com terceiro/fornecedor).
// Persistida como MedicaoContrato — entidade canônica usada por
// ContratosObraTab e CentroCustosObraTab (medições aprovadas viram custo).

const num = (v) => Number(v) || 0;

export default async function criarMedicaoContrato({ body, user }) {
  requirePermission(user, 'MEDICOES_EDIT');
  const d = body || {};
  if (!d.contrato_id) {
    throw Object.assign(new Error('Selecione um contrato.'), { status: 400 });
  }

  const contratos = await store.filter('Contrato', { id: d.contrato_id }, undefined, 1);
  const contrato = contratos[0];
  if (!contrato) {
    throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  }

  const valorTotal = num(d.valor_total);

  // Trava: a medição não pode ultrapassar o saldo do contrato. Para medir mais,
  // é preciso um ADITIVO (aumentar o valor do contrato).
  const totalContrato = num(contrato.valor_total);
  if (totalContrato > 0) {
    const existentes = (await store.filter('MedicaoContrato', { contrato_id: d.contrato_id })) || [];
    const jaMedido = existentes
      .filter((m) => String(m.status || '').toLowerCase() !== 'rejeitada')
      .reduce((s, m) => s + num(m.valor_medido ?? m.valor_total), 0);
    const saldo = totalContrato - jaMedido;
    if (valorTotal > saldo + 0.01) {
      throw Object.assign(new Error(`Medição (R$ ${valorTotal.toFixed(2)}) excede o saldo do contrato (R$ ${saldo.toFixed(2)}). Para medir mais, faça um aditivo aumentando o valor do contrato.`), { status: 400 });
    }
  }

  const medicao = await store.create('MedicaoContrato', {
    contrato_id: d.contrato_id,
    obra_id: contrato.obra_id || null,
    fornecedor_id: contrato.fornecedor_id || null,
    titulo: d.titulo || null,
    data_medicao: d.data_medicao || new Date().toISOString().split('T')[0],
    items: Array.isArray(d.items) ? d.items : [],
    valor_total: valorTotal,
    valor_medido: valorTotal,
    percentual_acumulado: num(d.percentual_acumulado),
    status: d.status || 'pendente',
  }, user?.email || null);

  return { ok: true, medicao };
}
