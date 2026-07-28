import { store } from '../entityStore.js';

// Porte de editarApontamentoHora. Não permite editar apontamento aprovado.
// Ao editar, RE-RESOLVE o custo/hora vigente (CustoHoraColaborador) na data do
// apontamento — assim, configurar o custo depois e reeditar recalcula o total.
const getById = async (name, id) => (id ? (await store.filter(name, { id }))[0] : null) || null;

function custoVigente(custos, data) {
  for (const c of (custos || [])) {
    const inicio = new Date(c.vigencia_inicio);
    const fim = c.vigencia_fim ? new Date(c.vigencia_fim) : null;
    const d = new Date(data);
    if (d >= inicio && (!fim || d <= fim)) return c;
  }
  return null;
}

import { requirePermission } from '../rbac.js';

export default async function editarApontamentoHora({ body, user }) {
  requirePermission(user, 'RH_EDIT');
  const { apontamento_id, horas_normais, horas_extras, custo_hora_extra, observacao } = body || {};
  if (!apontamento_id) throw Object.assign(new Error('apontamento_id é obrigatório'), { status: 400 });

  const ap = await getById('ApontamentoHora', apontamento_id);
  if (!ap) throw Object.assign(new Error('Apontamento não encontrado'), { status: 404 });
  if (ap.status === 'aprovado') throw Object.assign(new Error('Não é permitido editar apontamento aprovado'), { status: 400 });

  const updates = {};
  if (horas_normais !== undefined) updates.horas_normais = Number(horas_normais) || 0;
  if (horas_extras !== undefined) updates.horas_extras = Number(horas_extras) || 0;
  if (observacao !== undefined) updates.observacao = observacao;

  // Re-resolve o custo vigente (corrige apontamentos carimbados com custo 0
  // antes de o custo/hora ser cadastrado).
  const custos = await store.filter('CustoHoraColaborador', { colaborador_id: ap.colaborador_id, ativo: true }, '-vigencia_inicio', 100).catch(() => []);
  const cv = custoVigente(custos, ap.data);
  const custo_hora = cv ? Number(cv.custo_hora) || 0 : (Number(ap.custo_hora) || 0);
  const custo_extra = custo_hora_extra != null
    ? Number(custo_hora_extra)
    : (cv?.custo_hora_extra != null ? Number(cv.custo_hora_extra) : custo_hora * 1.5);
  updates.custo_hora = custo_hora;
  updates.custo_hora_extra = custo_extra;

  const h_norm = horas_normais ?? ap.horas_normais;
  const h_extras = horas_extras ?? ap.horas_extras;
  updates.custo_total = (Number(h_norm) * custo_hora) + (Number(h_extras) * custo_extra);

  const atualizado = await store.update('ApontamentoHora', apontamento_id, updates);

  await store.create('LogAuditoria', {
    user_email: user?.email, acao: 'UPDATE', modulo: 'RH',
    entidade: 'ApontamentoHora', entidade_id: apontamento_id,
    dados_anteriores: ap, dados_novos: atualizado, sucesso: true,
  }).catch(() => {});

  return { ok: true, apontamento: atualizado };
}
