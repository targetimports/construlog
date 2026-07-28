import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Fase 3 — CONCLUI a manutenção gravando os campos REAIS (data/custo/medidor de execução)
// — conserta o bug histórico em que o form gravava só agendamento e a UI lia campos de
// execução que ninguém escrevia. Libera o ativo, atualiza o medidor e gera a despesa de
// manutenção como conta a pagar da MATRIZ (dona da frota).
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const hoje = () => new Date().toISOString().slice(0, 10);
const ehVeiculo = (t) => /veiculo|carro|moto|caminh/.test(String(t || '').toLowerCase());

export default async function concluirManutencaoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const { manutencao_id, data_realizada, medidor_realizado, custo_pecas, custo_mao_obra, custo_real, oficina, observacoes, gerar_conta = true } = body || {};
  if (!manutencao_id) return { success: false, error: 'manutencao_id é obrigatório' };

  const m = (await store.filter('ManutencaoAtivo', { id: manutencao_id }))[0];
  if (!m) return { success: false, error: 'Manutenção não encontrada' };
  if (['concluida', 'cancelada'].includes(m.status)) return { success: false, error: `Manutenção já ${m.status}` };

  const pecas = num(custo_pecas ?? m.custo_pecas);
  const mo = num(custo_mao_obra ?? m.custo_mao_obra);
  const total = custo_real != null ? num(custo_real) : r2(pecas + mo);
  const dataR = data_realizada || hoje();

  const patch = {
    status: 'concluida', data_realizada: dataR,
    custo_pecas: pecas, custo_mao_obra: mo, custo_real: total,
  };
  if (medidor_realizado != null) patch.medidor_realizado = num(medidor_realizado);
  if (oficina != null) patch.oficina = oficina;
  if (observacoes != null) patch.observacoes = observacoes;
  await store.update('ManutencaoAtivo', manutencao_id, patch);

  // Libera o ativo + atualiza medidor (km p/ veículo, horímetro p/ máquina).
  const ativo = m.ativo_id ? (await store.filter('Ativo', { id: m.ativo_id }))[0] : null;
  if (ativo) {
    const ap = {};
    if (ativo.status === 'manutencao') ap.status = 'disponivel';
    if (medidor_realizado != null) {
      if (ehVeiculo(ativo.tipo)) ap.km_atual = num(medidor_realizado); else ap.horimetro_atual = num(medidor_realizado);
    }
    if (Object.keys(ap).length) await store.update('Ativo', ativo.id, ap);
  }

  // Despesa de manutenção = conta a pagar da MATRIZ (dona da frota).
  let conta_id = null;
  if (gerar_conta && total > 0) {
    const matriz = (await store.filter('Empresa', { tipo: 'matriz' }))[0];
    const conta = await store.create('ContaFinanceira', {
      tipo: 'pagar', empresa_id: matriz?.id || null, obra_id: null,
      descricao: `Manutenção ${m.tipo || ''}: ${m.ativo_nome || 'ativo'} — ${m.descricao || m.categoria || ''}`.trim(),
      categoria: 'Manutenção', valor: total, status: 'pendente', data_vencimento: dataR,
      fornecedor_cliente: oficina || m.oficina || null,
      referencia_tipo: 'ManutencaoAtivo', referencia_id: manutencao_id,
    }, user?.email || null);
    conta_id = conta.id;
    await store.update('ManutencaoAtivo', manutencao_id, { conta_financeira_id: conta_id });
  }

  return { success: true, custo_real: total, conta_financeira_id: conta_id };
}
