import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Cria um agendamento de relatório (RelatorioAgendado), calculando o próximo envio.
export default async function agendarRelatorioObra({ body, user }) {
  requirePermission(user, 'RELATORIOS_VIEW');
  const p = body || {};
  const { nome, obra_id, tipo_relatorio, frequencia, dia_semana, dia_mes, hora_envio, stakeholders } = p;

  if (!nome || !obra_id || !tipo_relatorio || !frequencia || !hora_envio || !(stakeholders?.length)) {
    return { error: 'Campos obrigatórios faltando' };
  }

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) return { error: 'Obra não encontrada' };

  const now = new Date();
  const proximo = new Date();
  const [hora, minuto] = String(hora_envio).split(':').map(Number);
  proximo.setHours(hora || 0, minuto || 0, 0, 0);

  if (frequencia === 'semanal' && dia_semana !== undefined && dia_semana !== null) {
    const diaAtual = now.getDay();
    let dias = (Number(dia_semana) - diaAtual + 7) % 7;
    if (dias === 0 && proximo <= now) dias = 7;
    proximo.setDate(proximo.getDate() + dias);
  } else if (frequencia === 'mensal' && dia_mes !== undefined && dia_mes !== null) {
    proximo.setDate(Number(dia_mes));
    if (proximo <= now) proximo.setMonth(proximo.getMonth() + 1);
  } else if (proximo <= now) {
    // diário/outros: se a hora de hoje já passou, vai para amanhã
    proximo.setDate(proximo.getDate() + 1);
  }

  const relatorio = await store.create('RelatorioAgendado', {
    nome, obra_id, obra_nome: obra.nome || '', tipo_relatorio, frequencia,
    dia_semana: dia_semana ?? null, dia_mes: dia_mes ?? null, hora_envio, stakeholders,
    incluir_progresso: p.incluir_progresso !== false,
    incluir_custos: p.incluir_custos !== false,
    incluir_cronograma: p.incluir_cronograma !== false,
    incluir_alertas: p.incluir_alertas !== false,
    formatos_exportacao: p.formatos_exportacao || ['pdf'],
    ativa: true,
    proximo_envio: proximo.toISOString(),
    criado_por: user?.email || null,
  }, user?.email || null);

  return { success: true, relatorio, mensagem: 'Relatório agendado com sucesso' };
}
