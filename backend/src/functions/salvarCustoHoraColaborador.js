import { store } from '../entityStore.js';

// Porte de salvarCustoHoraColaborador: cria um custo/hora vigente para o colaborador
// e desativa custos anteriores que se sobrepõem ao novo período.
const getById = async (name, id) => (id ? (await store.filter(name, { id }))[0] : null) || null;

import { requirePermission } from '../rbac.js';

export default async function salvarCustoHoraColaborador({ body, user }) {
  requirePermission(user, 'RH_EDIT');
  const { colaborador_id, vigencia_inicio, vigencia_fim, custo_hora, custo_hora_extra, observacao } = body || {};

  if (!colaborador_id) throw Object.assign(new Error('colaborador_id é obrigatório'), { status: 400 });
  if (!vigencia_inicio) throw Object.assign(new Error('vigencia_inicio é obrigatória'), { status: 400 });
  if (custo_hora === undefined || custo_hora === null || custo_hora === '') {
    throw Object.assign(new Error('custo_hora é obrigatório'), { status: 400 });
  }

  const colab = await getById('Colaborador', colaborador_id);
  if (!colab) throw Object.assign(new Error('Colaborador não encontrado'), { status: 404 });

  const dataNovaInicio = new Date(vigencia_inicio);
  const dataNovaFim = vigencia_fim ? new Date(vigencia_fim) : null;

  // Desativar custos vigentes que se sobrepõem ao novo período
  const custos = await store.filter('CustoHoraColaborador', { colaborador_id, ativo: true }, '-vigencia_inicio', 100);
  for (const c of (custos || [])) {
    const ini = new Date(c.vigencia_inicio);
    const fim = c.vigencia_fim ? new Date(c.vigencia_fim) : null;
    const sobrepoe = (!dataNovaFim || ini <= dataNovaFim) && (!fim || fim >= dataNovaInicio);
    if (sobrepoe) {
      await store.update('CustoHoraColaborador', c.id, { ativo: false });
    }
  }

  const novoCusto = await store.create('CustoHoraColaborador', {
    colaborador_id,
    vigencia_inicio,
    vigencia_fim: vigencia_fim || null,
    custo_hora: Number(custo_hora) || 0,
    custo_hora_extra: custo_hora_extra != null && custo_hora_extra !== '' ? Number(custo_hora_extra) : null,
    ativo: true,
    observacao: observacao || null,
  }, user?.email || null);

  await store.create('LogAuditoria', {
    user_email: user?.email, acao: 'CREATE', modulo: 'RH',
    entidade: 'CustoHoraColaborador', entidade_id: novoCusto.id, dados_novos: novoCusto, sucesso: true,
  }).catch(() => {});

  return { ok: true, custo: novoCusto };
}
