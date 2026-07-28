import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { obraNome, tipoMaquina, dataInicio, dataFim, horasPrevistas, custoHora, custoTotal, urgente, solicitanteNome, observacoes } = payload;

    // Buscar todos os admins
    const allUsers = await base44.asServiceRole.entities.User.list();
    const admins = allUsers.filter(u => u.role === 'admin');

    const custoFormatado = custoTotal ? custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
    const dataInicioFormatada = dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : '-';
    const dataFimFormatada = dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : '-';

    const subject = `${urgente ? '🚨 URGENTE - ' : ''}Nova Solicitação de Máquina - ${obraNome || 'Obra'}`;
    const body = `
      <h2 style="color:#1d4ed8;">Nova Solicitação de Máquina</h2>
      ${urgente ? '<p style="color:red;font-weight:bold;">⚠️ SOLICITAÇÃO URGENTE (menos de 15 dias)</p>' : ''}
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px;font-weight:bold">Obra:</td><td style="padding:6px">${obraNome || '-'}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Tipo de Máquina:</td><td style="padding:6px">${tipoMaquina || '-'}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Período:</td><td style="padding:6px">${dataInicioFormatada} até ${dataFimFormatada}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Horas Previstas:</td><td style="padding:6px">${horasPrevistas || '-'}h</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Custo/Hora:</td><td style="padding:6px">R$ ${custoHora || '-'}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Custo Total Estimado:</td><td style="padding:6px;color:#1d4ed8;font-weight:bold">${custoFormatado}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Solicitante:</td><td style="padding:6px">${solicitanteNome || '-'}</td></tr>
        ${observacoes ? `<tr><td style="padding:6px;font-weight:bold">Observações:</td><td style="padding:6px">${observacoes}</td></tr>` : ''}
      </table>
    `;

    // Enviar e-mail e notificação para cada admin
    const notificacaoTitulo = `${urgente ? '🚨 Urgente - ' : ''}Nova Solicitação de Máquina`;
    const notificacaoMsg = `${solicitanteNome || 'Alguém'} solicitou ${tipoMaquina} para a obra ${obraNome || ''} de ${dataInicioFormatada} a ${dataFimFormatada}. Custo estimado: ${custoFormatado}`;

    for (const admin of admins) {
      await Promise.all([
        base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body
        }),
        base44.asServiceRole.entities.Notificacao.create({
          destinatario_email: admin.email,
          tipo: urgente ? 'alerta' : 'info',
          titulo: notificacaoTitulo,
          mensagem: notificacaoMsg,
          lida: false,
          link_acao: 'SolicitacoesMaquinas'
        })
      ]);
    }

    return Response.json({ success: true, admins_notificados: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});