import { store } from '../entityStore.js';

// Cria uma SolicitacaoMaquina (status 'enviada'), calculando urgência
// (antecedência < 15 dias) e custo total. Usada por /SolicitacoesMaquinas.

export default async function criarSolicitacaoMaquina({ body, user }) {
  const {
    obra_id, tipo_maquina, data_inicio, data_fim,
    horas_previstas, custo_hora_previsto, justificativa_urgencia, observacoes
  } = body || {};

  if (!obra_id || !tipo_maquina || !data_inicio || !data_fim) {
    throw Object.assign(new Error('Campos obrigatórios: obra_id, tipo_maquina, data_inicio, data_fim'), { status: 400 });
  }

  const [obra] = await store.filter('Obra', { id: obra_id }, null, 1);
  if (!obra) {
    throw Object.assign(new Error('Obra não encontrada'), { status: 404 });
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dataInicio = new Date(data_inicio); dataInicio.setHours(0, 0, 0, 0);
  const diasAntecedencia = Math.floor((dataInicio - hoje) / (1000 * 60 * 60 * 24));
  const urgente = diasAntecedencia < 15;

  const horasNum = parseFloat(horas_previstas) || 0;
  const custoHoraNum = parseFloat(custo_hora_previsto) || 0;
  const custoTotal = horasNum * custoHoraNum;

  const solicitacao = await store.create('SolicitacaoMaquina', {
    obra_id,
    tipo_maquina,
    data_inicio,
    data_fim,
    horas_previstas: horasNum,
    custo_hora_previsto: custoHoraNum,
    urgente,
    justificativa_urgencia: justificativa_urgencia || null,
    observacoes: observacoes || null,
    solicitante_email: user?.email,
    solicitante_nome: user?.full_name || user?.email,
    status: 'enviada',
    antecedencia_min_dias: 15
  }, user?.email || null);

  // Auditoria (best-effort).
  try {
    await store.create('LogAuditoria', {
      user_email: user?.email,
      acao: 'criar',
      modulo: 'solicitacao_maquinas',
      entidade: 'SolicitacaoMaquina',
      entidade_id: solicitacao.id,
      dados_novos: solicitacao,
      detalhes: `Solicitação de ${tipo_maquina} para obra ${obra.nome || obra_id} - ${urgente ? 'URGENTE' : 'Normal'}`,
      sucesso: true
    }, user?.email || null);
  } catch { /* auditoria é best-effort */ }

  return { ok: true, solicitacao, calculado: { dias_antecedencia: diasAntecedencia, urgente, custo_total: custoTotal } };
}
