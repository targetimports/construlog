import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Registra uso de equipamento numa obra e lança o custo em ContaFinanceira (pagar/pago).
export default async function registrarUsoEquipamento({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const { equipamento_id, obra_id, data_inicio, data_fim, tipo_uso, observacoes } = body || {};
  if (!equipamento_id || !obra_id || !data_inicio) throw new Error('Campos obrigatórios faltando');

  // Conflito: mesmo equipamento em uso (status registrado) com período sobreposto.
  const ativos = await store.filter('RegistroUsoEquipamento', { equipamento_id, status: 'registrado' }, undefined, 5000).catch(() => []);
  const iniNovo = new Date(data_inicio);
  const fimNovo = data_fim ? new Date(data_fim) : new Date();
  for (const u of ativos) {
    const iniE = new Date(u.data_inicio);
    const fimE = u.data_fim ? new Date(u.data_fim) : new Date();
    if (iniNovo < fimE && fimNovo > iniE) throw new Error('Equipamento já está em uso em outra obra neste período');
  }

  const equip = (await store.filter('Equipamento', { id: equipamento_id }))[0];
  if (!equip) throw new Error('Equipamento não encontrado');
  const obra = (await store.filter('Obra', { id: obra_id }))[0];

  const horas = (fimNovo - iniNovo) / 3600000;
  let custo_total = (horas <= 8 && num(equip.custo_diaria) > 0) ? num(equip.custo_diaria) : horas * num(equip.custo_hora);
  custo_total = r2(custo_total);

  const registro = await store.create('RegistroUsoEquipamento', {
    equipamento_id, obra_id,
    data_inicio,
    data_fim: data_fim || new Date().toISOString(),
    horas_trabalhadas: r2(horas),
    tipo_uso: tipo_uso || 'proprio',
    custo_total,
    observacoes: observacoes || null,
    status: 'registrado',
  }, user?.email || null);

  // Custo -> ContaFinanceira (pagar/pago), integrando ao financeiro/DRE.
  let conta_id = null;
  if (custo_total > 0) {
    const hoje = new Date().toISOString().slice(0, 10);
    const conta = await store.create('ContaFinanceira', {
      tipo: 'pagar', obra_id, obra_nome: obra?.nome || '',
      descricao: `${equip.nome || 'Equipamento'} - ${r2(horas)}h - ${tipo_uso || 'proprio'}`,
      categoria: 'Equipamento', valor: custo_total,
      status: 'pago', data_vencimento: hoje, data_pagamento: hoje, valor_pago: custo_total,
      referencia_tipo: 'RegistroUsoEquipamento', referencia_id: registro.id,
    }, user?.email || null);
    conta_id = conta.id;
    await store.update('RegistroUsoEquipamento', registro.id, { conta_financeira_id: conta_id });
  }

  return { success: true, registro_id: registro.id, conta_id, custo_total };
}
