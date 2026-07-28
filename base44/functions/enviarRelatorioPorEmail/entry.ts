import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin' && user?.role !== 'programador') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json();
    const { relatorio_id } = payload;

    if (!relatorio_id) {
      return Response.json({ error: 'relatorio_id é obrigatório' }, { status: 400 });
    }

    // Buscar configuração de agendamento
    const relatorio = await base44.entities.RelatorioAgendado.read(relatorio_id);
    if (!relatorio) {
      return Response.json({ error: 'Relatório não encontrado' }, { status: 404 });
    }

    if (!relatorio.ativa) {
      return Response.json({ error: 'Relatório não está ativo' }, { status: 400 });
    }

    // Gerar relatório PDF
    const relatorioResponse = await base44.asServiceRole.functions.invoke('gerarRelatorioObra', {
      obra_id: relatorio.obra_id,
      tipo_relatorio: relatorio.tipo_relatorio,
      opcoes: {
        incluir_progresso: relatorio.incluir_progresso,
        incluir_custos: relatorio.incluir_custos,
        incluir_cronograma: relatorio.incluir_cronograma,
        incluir_alertas: relatorio.incluir_alertas
      }
    });

    // Enviar email para cada stakeholder
    const emailsEnviados = [];
    for (const stakeholder of relatorio.stakeholders) {
      try {
        await base44.integrations.Core.SendEmail({
          to: stakeholder.email,
          subject: `Relatório de Obra - ${relatorio.obra_nome}`,
          body: `
            <h2>Relatório de Obra</h2>
            <p>Olá ${stakeholder.nome},</p>
            <p>Segue em anexo o relatório de progresso da obra <strong>${relatorio.obra_nome}</strong>.</p>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
            <p>Atenciosamente,<br/>Sistema de Gestão de Obras</p>
          `
        });
        emailsEnviados.push(stakeholder.email);
      } catch (err) {
        console.error(`Erro ao enviar email para ${stakeholder.email}:`, err);
      }
    }

    // Atualizar data do último envio
    await base44.asServiceRole.entities.RelatorioAgendado.update(relatorio_id, {
      ultimo_envio: new Date().toISOString()
    });

    return Response.json({
      success: true,
      emailsEnviados,
      mensagem: `Relatório enviado para ${emailsEnviados.length} stakeholder(s)`
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});