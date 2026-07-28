import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WHATSAPP_SERVICE_URL = Deno.env.get('WHATSAPP_SERVICE_URL');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Operação de serviço — não requer usuário autenticado (chamada por automação agendada)
    const serviceRole = base44.asServiceRole;

    console.log('🔔 [v2] Iniciando envio de alertas críticos via WhatsApp...');

    // Buscar alertas críticos não lidos / não enviados
    const alertas = await serviceRole.entities.AlertaSupervisor.filter({
      lido: false
    });

    const alertasCriticos = alertas.filter(a =>
      a.nivel === 'critico' || a.nivel === 'urgente' || a.prioridade === 'alta' || a.prioridade === 'urgente'
    );

    console.log(`📋 ${alertasCriticos.length} alertas críticos encontrados de ${alertas.length} não lidos.`);

    if (alertasCriticos.length === 0) {
      return Response.json({ success: true, message: 'Nenhum alerta crítico para enviar', enviados: 0 });
    }

    if (!WHATSAPP_SERVICE_URL) {
      console.warn('⚠️ WHATSAPP_SERVICE_URL não configurada. Alertas registrados mas não enviados via WhatsApp.');
      return Response.json({
        success: false,
        message: 'Serviço WhatsApp não configurado (WHATSAPP_SERVICE_URL ausente)',
        alertas_encontrados: alertasCriticos.length
      }, { status: 503 });
    }

    // Buscar usuários admin para notificar
    const usuarios = await serviceRole.entities.User.list();
    const admins = usuarios.filter(u => u.role === 'admin' || u.role === 'programador');
    const numerosNotificar = admins
      .map(u => u.telefone || u.whatsapp)
      .filter(Boolean);

    if (numerosNotificar.length === 0) {
      console.warn('⚠️ Nenhum número de WhatsApp cadastrado nos usuários admin.');
      return Response.json({
        success: false,
        message: 'Nenhum número de WhatsApp configurado para admins',
        alertas_encontrados: alertasCriticos.length
      });
    }

    // Montar mensagem resumo
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const linhasAlertas = alertasCriticos.slice(0, 10).map((a, i) =>
      `${i + 1}. ${a.titulo || a.mensagem || 'Alerta sem título'}`
    ).join('\n');

    const mensagem =
      `🚨 *ALERTAS CRÍTICOS - ${dataHoje}*\n\n` +
      `Foram encontrados *${alertasCriticos.length} alertas críticos* no sistema:\n\n` +
      `${linhasAlertas}` +
      (alertasCriticos.length > 10 ? `\n...e mais ${alertasCriticos.length - 10} alertas.` : '') +
      `\n\n⚠️ Acesse o sistema para verificar.`;

    // Enviar para cada número admin
    let enviados = 0;
    let erros = 0;

    for (const numero of numerosNotificar) {
      try {
        const response = await fetch(`${WHATSAPP_SERVICE_URL}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: numero.replace(/\D/g, ''),
            mensagem
          })
        });

        if (response.ok) {
          enviados++;
          console.log(`✅ WhatsApp enviado para ${numero}`);
        } else {
          erros++;
          console.warn(`⚠️ Falha ao enviar para ${numero}: ${response.status}`);
        }
      } catch (err) {
        erros++;
        console.error(`❌ Erro ao enviar para ${numero}:`, err.message);
      }
    }

    // Registrar notificação no sistema
    try {
      await serviceRole.entities.Notificacao.create({
        tipo: 'alerta_whatsapp',
        titulo: `Alertas WhatsApp - ${dataHoje}`,
        mensagem: `${alertasCriticos.length} alertas críticos enviados via WhatsApp para ${enviados} destinatário(s).`,
        lida: false
      });
    } catch (notifErr) {
      console.warn('⚠️ Erro ao registrar notificação:', notifErr.message);
    }

    console.log(`✅ Concluído: ${enviados} enviados, ${erros} erros.`);

    return Response.json({
      success: true,
      alertas_encontrados: alertasCriticos.length,
      destinatarios: numerosNotificar.length,
      enviados,
      erros
    });

  } catch (error) {
    console.error('❌ Erro em enviarAlertasWhatsApp:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});