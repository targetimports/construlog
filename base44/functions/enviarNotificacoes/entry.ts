import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tipo, destinatario, titulo, mensagem, dados } = await req.json();

    // Email
    if (tipo === 'email') {
      await base44.integrations.Core.SendEmail({
        to: destinatario,
        subject: titulo,
        body: mensagem
      });
    }

    // WhatsApp
    if (tipo === 'whatsapp') {
      const telefone = dados?.telefone;
      if (telefone) {
        // Integrar com serviço de WhatsApp
        console.log(`Enviando WhatsApp para ${telefone}: ${mensagem}`);
      }
    }

    // Push Notification
    if (tipo === 'push') {
      await base44.asServiceRole.entities.Notificacao?.create({
        user_email: destinatario,
        titulo,
        mensagem,
        lida: false,
        data_criacao: new Date().toISOString()
      });
    }

    return Response.json({ sucesso: true, tipo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});