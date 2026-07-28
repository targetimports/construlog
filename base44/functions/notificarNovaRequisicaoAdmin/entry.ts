import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { requisicao_id, requisicao_titulo, empresa_id, criador_nome } = payload;

    // Buscar todos os admins da empresa
    const admins = await base44.asServiceRole.entities.User.filter({ 
      role: 'admin',
      empresa_id: empresa_id 
    });

    // Para cada admin, verificar preferência e enviar email
    for (const admin of admins) {
      try {
        // Buscar preferência de notificação
        const prefs = await base44.asServiceRole.entities.PreferenciaNotificacao.filter({
          user_email: admin.email,
          empresa_id: empresa_id
        });

        const pref = prefs[0];
        
        // Se não tem preferência, usa padrão (true)
        const deveEnviarEmail = !pref || pref.email_nova_requisicao !== false;

        if (deveEnviarEmail) {
          // Enviar email
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Nova Requisição de Compra: ${requisicao_titulo}`,
            body: `
Olá ${admin.full_name},

Uma nova requisição de compra foi criada por ${criador_nome}:

Título: ${requisicao_titulo}

Acesse o sistema para revisar e aprovar.

---
Germanos Construlog
            `
          });
        }
      } catch (error) {
        console.error(`Erro ao notificar admin ${admin.email}:`, error);
      }
    }

    return Response.json({ success: true, notificados: admins.length });
  } catch (error) {
    console.error('Erro ao enviar notificações:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});