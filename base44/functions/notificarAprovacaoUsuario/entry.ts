import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Verifica se houve mudança de status
    if (event.type === 'update' && old_data?.status !== data?.status) {
      
      // Se foi aprovado
      if (data.status === 'ativo') {
        await base44.asServiceRole.entities.Notificacao.create({
          destinatario_email: data.email,
          tipo: 'usuario_aprovado',
          titulo: '✅ Acesso aprovado!',
          mensagem: 'Sua solicitação de acesso foi aprovada. Bem-vindo ao sistema!',
          link_acao: 'Dashboard'
        });

        // Envia e-mail de aprovação
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: data.email,
            subject: 'Acesso Aprovado - Germanos Construlog',
            body: `
              <h2>🎉 Seu acesso foi aprovado!</h2>
              <p>Olá ${data.full_name || ''},</p>
              <p>Sua solicitação de acesso ao sistema <strong>Germanos Construlog</strong> foi aprovada.</p>
              <p>Você já pode fazer login e utilizar todas as funcionalidades do sistema.</p>
              <br>
              <p>Bem-vindo!</p>
            `
          });
        } catch (emailError) {
          console.error('Erro ao enviar e-mail:', emailError);
        }
      }
      
      // Se foi rejeitado
      if (data.status === 'rejeitado') {
        await base44.asServiceRole.entities.Notificacao.create({
          destinatario_email: data.email,
          tipo: 'usuario_rejeitado',
          titulo: 'Solicitação de acesso não aprovada',
          mensagem: 'Infelizmente sua solicitação de acesso não foi aprovada. Entre em contato com o administrador para mais informações.',
          link_acao: null
        });

        // Envia e-mail de rejeição
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: data.email,
            subject: 'Solicitação de Acesso - Germanos Construlog',
            body: `
              <h2>Solicitação de Acesso</h2>
              <p>Olá ${data.full_name || ''},</p>
              <p>Informamos que sua solicitação de acesso ao sistema não foi aprovada neste momento.</p>
              <p>Para mais informações, entre em contato com o administrador do sistema.</p>
              <br>
              <p>Atenciosamente,<br>Equipe Germanos Construlog</p>
            `
          });
        } catch (emailError) {
          console.error('Erro ao enviar e-mail:', emailError);
        }
      }

      return Response.json({ 
        success: true, 
        status_alterado: `${old_data.status} -> ${data.status}` 
      });
    }

    return Response.json({ success: true, message: 'Nenhuma notificação necessária' });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});