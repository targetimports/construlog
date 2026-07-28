import { store } from '../entityStore.js';

// Porte de criarApontamentoHora. Resolve custo vigente em CustoHoraColaborador;
// se não houver custo configurado, usa custo 0 (custo_total fica 0 até configurar),
// para não travar o lançamento de horas. Idempotente por (obra, colaborador, data, origem, ref).
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

export default async function criarApontamentoHora({ body, user }) {
  requirePermission(user, 'RH_EDIT');
  const {
    obra_id, colaborador_id, equipe_id, data,
    horas_normais = 0, horas_extras = 0, custo_hora_extra,
    origem = 'manual', referencia_tipo, referencia_id, observacao,
  } = body || {};

  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });
  if (!colaborador_id) throw Object.assign(new Error('colaborador_id é obrigatório'), { status: 400 });
  if (!data) throw Object.assign(new Error('data é obrigatória'), { status: 400 });

  const colab = await getById('Colaborador', colaborador_id);
  if (!colab) throw Object.assign(new Error('Colaborador não encontrado'), { status: 400 });

  const custos = await store.filter('CustoHoraColaborador', { colaborador_id, ativo: true }, '-vigencia_inicio', 100).catch(() => []);
  const cv = custoVigente(custos, data);
  const custo_hora = cv ? Number(cv.custo_hora) || 0 : 0;
  const custo_extra = custo_hora_extra != null
    ? Number(custo_hora_extra)
    : (cv?.custo_hora_extra != null ? Number(cv.custo_hora_extra) : custo_hora * 1.5);
  const custo_total = (Number(horas_normais) * custo_hora) + (Number(horas_extras) * custo_extra);

  // Idempotência
  const filtro = { obra_id, colaborador_id, data };
  if (origem) filtro.origem = origem;
  if (referencia_id) filtro.referencia_id = referencia_id;
  const existentes = await store.filter('ApontamentoHora', filtro, '-created_date', 10);
  if (existentes && existentes.length) {
    return { ok: true, noop: true, id_existente: existentes[0].id, message: 'Apontamento já existe para este dia' };
  }

  const apontamento = await store.create('ApontamentoHora', {
    obra_id, colaborador_id, equipe_id, data,
    horas_normais: Number(horas_normais) || 0,
    horas_extras: Number(horas_extras) || 0,
    custo_hora, custo_hora_extra: custo_extra, custo_total,
    origem, referencia_tipo, referencia_id,
    status: 'rascunho', observacao,
  }, user?.email || null);

  await store.create('LogAuditoria', {
    user_email: user?.email, acao: 'CREATE', modulo: 'RH',
    entidade: 'ApontamentoHora', entidade_id: apontamento.id, dados_novos: apontamento, sucesso: true,
  }).catch(() => {});

  return { ok: true, apontamento };
}
