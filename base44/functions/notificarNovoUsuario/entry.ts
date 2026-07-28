import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Verifica se é criação ou atualização de perfil pendente
    if ((event.type === 'create' || event.type === 'update') && data?.status === 'aguardando_aprovacao') {
      
      // Busca todos os administradores
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      
      // Cria notificação para cada admin
      const notificacoes = admins.map(admin => ({
        destinatario_email: admin.email,
        tipo: 'novo_usuario',
        titulo: event.type === 'create' ? 'Novo usuário aguardando aprovação' : 'Usuário atualizou informações',
        mensagem: `${data.full_name || data.email} ${event.type === 'create' ? 'solicitou' : 'atualizou'} acesso ao sistema${data.empresa ? ` - ${data.empresa}` : ''}`,
        link_acao: 'AprovacaoUsuarios',
        usuario_relacionado_id: data.id,
        usuario_relacionado_nome: data.full_name,
        usuario_relacionado_email: data.email
      }));

      await base44.asServiceRole.entities.Notificacao.bulkCreate(notificacoes);

      // Envia e-mail para o primeiro admin (opcional)
      if (admins.length > 0) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admins[0].email,
            subject: `Nova solicitação de acesso - ${data.full_name || data.email}`,
            body: `
              <h2>Nova solicitação de acesso ao sistema</h2>
              <p><strong>Nome:</strong> ${data.full_name || 'Não informado'}</p>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Empresa:</strong> ${data.empresa || 'Não informado'}</p>
              <p><strong>Cargo:</strong> ${data.cargo || 'Não informado'}</p>
              <p><strong>Telefone:</strong> ${data.telefone || 'Não informado'}</p>
              ${data.observacoes ? `<p><strong>Observações:</strong> ${data.observacoes}</p>` : ''}
              <br>
              <p>Acesse o sistema para aprovar ou rejeitar esta solicitação.</p>
            `
          });
        } catch (emailError) {
          console.error('Erro ao enviar e-mail:', emailError);
        }
      }

      return Response.json({ 
        success: true, 
        notificacoes_criadas: notificacoes.length 
      });
    }

    return Response.json({ success: true, message: 'Nenhuma notificação necessária' });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});