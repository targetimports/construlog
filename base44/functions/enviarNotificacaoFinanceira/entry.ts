import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo, destinatario, mensagem, detalhes } = await req.json();

    // Criar notificação no sistema
    await base44.asServiceRole.entities.Notificacao.create({
      destinatario_email: destinatario || user.email,
      tipo: 'alerta',
      titulo: getTitulo(tipo),
      mensagem: mensagem || getMensagemPadrao(tipo, detalhes),
      lida: false
    });

    // Enviar email se configurado
    if (tipo !== 'teste') {
      const preferencias = user.notificacoes_financeiras || {};
      
      if (preferencias.notificar_email !== false) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: destinatario || user.email,
          subject: getTitulo(tipo),
          body: formatarEmailHTML(tipo, mensagem, detalhes)
        });
      }
    } else {
      // Sempre enviar email de teste
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: destinatario || user.email,
        subject: 'Notificação de Teste - Sistema Financeiro',
        body: `
          <h2>Teste de Notificação</h2>
          <p>${mensagem}</p>
          <p>Este é um email de teste do sistema de notificações financeiras.</p>
        `
      });
    }

    return Response.json({ 
      success: true,
      message: 'Notificação enviada com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getTitulo(tipo) {
  const titulos = {
    'vencimento': '⏰ Contas a Vencer',
    'vencidas': '🚨 Contas Vencidas',
    'fluxo_negativo': '⚠️ Alerta de Fluxo de Caixa',
    'teste': '🔔 Notificação de Teste'
  };
  return titulos[tipo] || 'Notificação Financeira';
}

function getMensagemPadrao(tipo, detalhes = {}) {
  switch (tipo) {
    case 'vencimento':
      return `Você tem ${detalhes.quantidade || 0} contas vencendo nos próximos dias.`;
    case 'vencidas':
      return `Você tem ${detalhes.quantidade || 0} contas vencidas. Total: ${detalhes.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}`;
    case 'fluxo_negativo':
      return `Seu fluxo de caixa está negativo: ${detalhes.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}`;
    default:
      return 'Nova notificação financeira';
  }
}

function formatarEmailHTML(tipo, mensagem, detalhes) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
        .footer { background: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; color: #6B7280; }
        .button { background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${getTitulo(tipo)}</h1>
      </div>
      <div class="content">
        <p>${mensagem}</p>
        ${detalhes.contas ? `
          <div class="alert">
            <h3>Detalhes:</h3>
            <ul>
              ${detalhes.contas.map(c => `
                <li>
                  ${c.descricao} - ${c.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <br>Vencimento: ${new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
        <p style="margin-top: 30px;">
          <a href="${Deno.env.get('BASE_URL') || ''}/FinanceiroOtimizado" class="button">
            Acessar Financeiro
          </a>
        </p>
      </div>
      <div class="footer">
        <p>Você está recebendo este email porque está inscrito nas notificações financeiras.</p>
        <p>Para alterar suas preferências, acesse as configurações do sistema.</p>
      </div>
    </body>
    </html>
  `;
}