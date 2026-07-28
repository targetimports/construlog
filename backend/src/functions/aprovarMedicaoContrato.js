import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Aprova ou rejeita uma medição de contrato. Ao APROVAR, gera a CONTA A PAGAR do
// contratado (fornecedor/terceirizado) — espelha as diárias e o faturarMedicaoObra.
// Idempotente: não duplica a conta. Rejeição não gera nada.

const num = (v) => Number(v) || 0;

export default async function aprovarMedicaoContrato({ body, user }) {
  requirePermission(user, 'MEDICOES_EDIT');
  const { medicaoId, status } = body || {};
  if (!medicaoId) {
    throw Object.assign(new Error('Medição não informada.'), { status: 400 });
  }
  const novoStatus = status === 'rejeitada' ? 'rejeitada' : 'aprovada';

  const med = (await store.filter('MedicaoContrato', { id: medicaoId }))[0];
  if (!med) {
    throw Object.assign(new Error('Medição não encontrada.'), { status: 404 });
  }
  const contrato = med.contrato_id ? (await store.filter('Contrato', { id: med.contrato_id }))[0] : null;
  const valor = num(med.valor_total ?? med.valor_medido);

  // Trava: não aprovar medição que ultrapassa o valor do contrato (exige aditivo).
  if (novoStatus === 'aprovada' && contrato && num(contrato.valor_total) > 0) {
    const outras = (await store.filter('MedicaoContrato', { contrato_id: med.contrato_id })) || [];
    const aprovadasSemEsta = outras
      .filter((m) => m.id !== medicaoId && String(m.status || '').toLowerCase() === 'aprovada')
      .reduce((s, m) => s + num(m.valor_medido ?? m.valor_total), 0);
    const saldo = num(contrato.valor_total) - aprovadasSemEsta;
    if (valor > saldo + 0.01) {
      throw Object.assign(new Error(`Aprovar esta medição (R$ ${valor.toFixed(2)}) ultrapassa o saldo do contrato (R$ ${saldo.toFixed(2)}). Faça um aditivo (aumente o valor do contrato) antes de aprovar.`), { status: 400 });
    }
  }

  const patch = {
    status: novoStatus,
    aprovado_por: user?.email || null,
    data_aprovacao: new Date().toISOString(),
  };
  const medicao = await store.update('MedicaoContrato', medicaoId, patch);

  // Conta a pagar do contratado (só ao aprovar; idempotente por referência).
  let conta_pagar_id = null;
  if (novoStatus === 'aprovada') {
    const existentes = await store.filter('ContaFinanceira', {
      referencia_tipo: 'medicao_contrato', referencia_id: medicaoId,
    }).catch(() => []);
    if (existentes.length) {
      conta_pagar_id = existentes[0].id;
    } else {
      if (valor > 0) {
        let contratado = contrato?.contratado_nome || null;
        if (!contratado && contrato?.fornecedor_id) {
          const f = (await store.filter('Fornecedor', { id: contrato.fornecedor_id }))[0];
          contratado = f?.nome || f?.razao_social || null;
        }
        const data = medicao.data_medicao || new Date().toISOString().split('T')[0];
        const conta = await store.create('ContaFinanceira', {
          tipo: 'pagar',
          obra_id: medicao.obra_id || contrato?.obra_id || null,
          descricao: `Medição de contrato ${contrato?.numero || ''} — ${contratado || 'contratado'} (${data})`.replace(/\s+/g, ' ').trim(),
          categoria: 'Serviço',
          valor,
          status: 'pendente',
          data_emissao: data,
          data_vencimento: data,
          fornecedor_cliente: contratado || null,
          referencia_tipo: 'medicao_contrato',
          referencia_id: medicaoId,
        }, user?.email || null);
        conta_pagar_id = conta.id;
      }
    }
  }

  return { ok: true, medicao, conta_pagar_id };
}
