import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Envia e-mail de calendário usando integração Base44
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { to, subject, payload } = await req.json();

    if (!to || !subject || !payload) {
      return Response.json({ error: 'to, subject e payload são obrigatórios' }, { status: 400 });
    }

    // Construir HTML do e-mail
    const html = buildEmailHTML(payload);
    const text = buildEmailText(payload);

    // Enviar usando integração Base44
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'Calendário Construlog Construlog',
        to,
        subject,
        body: html
      });

      return Response.json({ 
        success: true,
        message: 'E-mail enviado com sucesso'
      });

    } catch (emailError) {
      console.error('[sendCalendarEmail] Email send error:', emailError);
      return Response.json({ 
        success: false,
        error: emailError.message || 'Erro ao enviar e-mail'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[sendCalendarEmail] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Constrói HTML do e-mail
 */
function buildEmailHTML(payload) {
  const {
    subject,
    summary,
    event_title,
    event_description,
    event_location,
    event_start,
    event_end,
    obra_name,
    link,
    notification_type
  } = payload;

  // Escolher emoji e cor baseado no tipo
  let headerColor = '#3B82F6';
  let headerEmoji = '📅';
  
  switch (notification_type) {
    case 'EVENT_CREATED':
      headerColor = '#10B981';
      headerEmoji = '📅';
      break;
    case 'EVENT_UPDATED':
      headerColor = '#F59E0B';
      headerEmoji = '🔄';
      break;
    case 'EVENT_CANCELLED':
      headerColor = '#EF4444';
      headerEmoji = '❌';
      break;
    case 'EVENT_REMINDER':
      headerColor = '#8B5CF6';
      headerEmoji = '⏰';
      break;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${headerColor}; padding: 30px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">${headerEmoji}</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${subject}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Summary -->
              <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 16px; line-height: 1.5;">
                ${summary}
              </p>

              <!-- Event Details Box -->
              <div style="background-color: #F9FAFB; border-left: 4px solid ${headerColor}; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 700;">
                  ${event_title}
                </h2>

                ${event_description ? `
                  <p style="margin: 0 0 16px 0; color: #4B5563; font-size: 14px; line-height: 1.6;">
                    ${event_description}
                  </p>
                ` : ''}

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align: top; padding-right: 12px;">
                            <span style="font-size: 20px;">📅</span>
                          </td>
                          <td>
                            <div style="color: #6B7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Início</div>
                            <div style="color: #111827; font-size: 14px; font-weight: 500;">${event_start}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  ${event_end ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align: top; padding-right: 12px;">
                            <span style="font-size: 20px;">🏁</span>
                          </td>
                          <td>
                            <div style="color: #6B7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Término</div>
                            <div style="color: #111827; font-size: 14px; font-weight: 500;">${event_end}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}

                  ${event_location ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align: top; padding-right: 12px;">
                            <span style="font-size: 20px;">📍</span>
                          </td>
                          <td>
                            <div style="color: #6B7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Local</div>
                            <div style="color: #111827; font-size: 14px; font-weight: 500;">${event_location}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}

                  ${obra_name ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align: top; padding-right: 12px;">
                            <span style="font-size: 20px;">🏗️</span>
                          </td>
                          <td>
                            <div style="color: #6B7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Obra</div>
                            <div style="color: #111827; font-size: 14px; font-weight: 500;">${obra_name}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}
                </table>

              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${link}" style="display: inline-block; background-color: ${headerColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Ver no Sistema
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 40px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; color: #6B7280; font-size: 12px;">
                Você está recebendo este e-mail porque está cadastrado como participante deste evento.
              </p>
              <p style="margin: 8px 0 0 0; color: #9CA3AF; font-size: 11px;">
                Construlog Construlog - Sistema de Gestão de Obras
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Constrói versão texto do e-mail (fallback)
 */
function buildEmailText(payload) {
  const {
    event_title,
    event_start,
    event_end,
    event_location,
    event_description,
    obra_name,
    link
  } = payload;

  let text = `${event_title}\n\n`;
  
  if (event_description) {
    text += `${event_description}\n\n`;
  }
  
  text += `📅 Início: ${event_start}\n`;
  
  if (event_end) {
    text += `🏁 Término: ${event_end}\n`;
  }
  
  if (event_location) {
    text += `📍 Local: ${event_location}\n`;
  }
  
  if (obra_name) {
    text += `🏗️ Obra: ${obra_name}\n`;
  }
  
  text += `\nVer detalhes: ${link}\n`;
  
  return text;
}