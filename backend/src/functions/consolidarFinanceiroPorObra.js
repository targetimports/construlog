import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Consolida o financeiro de UMA obra num período (diário/mensal) a partir do razão
// (ContaFinanceira) e PERSISTE um registro ConsolidacaoFinanceiraPorObra (a tela lê a
// entidade). Faz upsert por (obra, tipo_periodo, periodo). Conserta o 404.
const num = (x) => Number(x) || 0;
const r2 = (x) => Math.round(num(x) * 100) / 100;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const bucket = (cat) => {
  const s = norm(cat);
  if (/material|insumo|compra/.test(s)) return 'material';
  if (/mao|m_o|folha|salario|pessoal|diaria|rh/.test(s)) return 'folha';
  if (/frete|transporte|logistica|combust|viagem/.test(s)) return 'logistica';
  if (/equip|maquina|frota|veiculo|aluguel|locac/.test(s)) return 'equipamentos';
  return 'outros';
};

export default async function consolidarFinanceiroPorObra({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');
  const { obra_id, tipo_periodo = 'mensal', periodo } = body || {};
  if (!obra_id || !periodo) return { success: false, error: 'obra_id e periodo são obrigatórios' };

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) return { success: false, error: 'Obra não encontrada' };
  if (!isGlobal(user) && obra.empresa_id && obra.empresa_id !== empresaIdDe(user)) {
    return { success: false, error: 'Obra de outra empresa' };
  }

  // Janela do período.
  let ini, fim;
  if (tipo_periodo === 'diario') { ini = fim = String(periodo).slice(0, 10); }
  else { const ym = String(periodo).slice(0, 7); ini = `${ym}-01`; fim = `${ym}-31`; }
  const dentro = (d) => { if (!d) return false; const ds = String(d).slice(0, 10); return ds >= ini && ds <= fim; };

  const contas = await store.filter('ContaFinanceira', { obra_id }, undefined, 100000).catch(() => []);
  const dataRel = (c) => (c.tipo === 'receber' ? (c.data_recebimento || c.data_vencimento || c.updated_date) : (c.data_pagamento || c.data_vencimento || c.updated_date));

  let receita = 0, despesa = 0;
  const buckets = { material: 0, folha: 0, logistica: 0, equipamentos: 0, outros: 0 };
  for (const c of contas) {
    if (c.status === 'cancelado' || !dentro(dataRel(c))) continue;
    if (c.tipo === 'receber') receita += num(c.valor);
    else if (c.tipo === 'pagar') { const v = num(c.valor); despesa += v; buckets[bucket(c.categoria)] += v; }
  }
  receita = r2(receita); despesa = r2(despesa);
  const lucro = r2(receita - despesa);
  const margem = receita > 0 ? r2((lucro / receita) * 100) : 0;
  let margem_status = 'critica';
  if (margem >= 20) margem_status = 'excelente'; else if (margem >= 10) margem_status = 'normal'; else if (margem >= 5) margem_status = 'alerta';

  const dados = {
    obra_id, obra_nome: obra.nome || '', empresa_id: obra.empresa_id || null,
    tipo_periodo, periodo,
    receita_total: receita, despesa_total: despesa, lucro_bruto: lucro,
    margem_lucro: margem, margem_status,
    despesa_material: r2(buckets.material), despesa_folha_pagamento: r2(buckets.folha),
    despesa_logistica: r2(buckets.logistica), despesa_equipamentos: r2(buckets.equipamentos),
    cidade: obra.cidade || obra.endereco_cidade || null,
    responsavel: obra.responsavel || obra.responsavel_nome || null,
    calculado_em: new Date().toISOString(),
  };

  const existentes = await store.filter('ConsolidacaoFinanceiraPorObra', { obra_id, tipo_periodo, periodo }, undefined, 5).catch(() => []);
  const saved = existentes[0]
    ? await store.update('ConsolidacaoFinanceiraPorObra', existentes[0].id, dados)
    : await store.create('ConsolidacaoFinanceiraPorObra', dados, user?.email || null);

  return { success: true, consolidacao: saved };
}
