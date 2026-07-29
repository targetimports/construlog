import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    // Só processa criação
    if (!event || event.type !== 'create') {
      return Response.json({ ok: true, skipped: true, reason: 'not a create event' });
    }

    if (!data) {
      return Response.json({ ok: true, skipped: true, reason: 'no data' });
    }

    const boleto = data;

    // Precisamos de vencimento para notificar
    if (!boleto.data_vencimento) {
      return Response.json({ ok: true, skipped: true, reason: 'no vencimento' });
    }

    // Formatar data de vencimento
    const vencFormatado = new Date(boleto.data_vencimento + 'T12:00:00')
      .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Formatar valor
    const valorFormatado = (boleto.valor || 0).toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });

    // Data de emissão (se houver)
    const emissaoFormatado = boleto.data_emissao 
      ? new Date(boleto.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Não informada';

    // Calcular dias até vencimento
    const hoje = new Date();
    const venc = new Date(boleto.data_vencimento + 'T12:00:00');
    const diffMs = venc.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const prazoTexto = diffDias === 0 ? 'HOJE' 
      : diffDias === 1 ? 'amanhã'
      : diffDias > 0 ? `em ${diffDias} dia(s)` 
      : `VENCIDO há ${Math.abs(diffDias)} dia(s)`;

    // Determinar destinatários
    const destinatarios = [];

    // 1) Responsável do boleto
    if (boleto.responsavel_user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: boleto.responsavel_user_id });
      if (users[0]?.email) destinatarios.push(users[0].email);
    }

    // 2) Quem criou o boleto
    if (boleto.created_by && !destinatarios.includes(boleto.created_by)) {
      destinatarios.push(boleto.created_by);
    }

    // 3) Admins financeiros (buscar admins)
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const adm of admins) {
      if (adm.email && !destinatarios.includes(adm.email)) {
        destinatarios.push(adm.email);
      }
    }

    if (destinatarios.length === 0) {
      return Response.json({ ok: true, skipped: true, reason: 'no recipients' });
    }

    // Link direto para o sistema (usa URL base fixa do app)
    const linkSistema = `https://app.base44.com/Financeiro?tab=obrigacoes&boleto_id=${event.entity_id}`;

    // Montar e-mail
    const assunto = `📋 Nova Obrigação Cadastrada — ${boleto.descricao} — Vence ${vencFormatado}`;

    const corpoEmail = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  
  <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">📋 Nova Obrigação Cadastrada</h1>
    <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Uma nova conta/boleto foi registrada no sistema</p>
  </div>

  <div style="padding: 32px;">
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 15px;">
        ⏰ Vencimento: ${vencFormatado} (${prazoTexto})
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; width: 140px; background: #f9fafb; border-radius: 6px 0 0 0;">Descrição</td>
        <td style="padding: 12px 16px; color: #111827;">${boleto.descricao || '-'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Fornecedor</td>
        <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${boleto.fornecedor_nome || 'Não informado'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Obra</td>
        <td style="padding: 12px 16px; color: #111827;">${boleto.obra_nome || 'Não vinculada'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Valor</td>
        <td style="padding: 12px 16px; color: #111827; font-size: 18px; font-weight: 700; color: #dc2626;">${valorFormatado}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Data Vencimento</td>
        <td style="padding: 12px 16px; color: #111827; font-weight: 600;">${vencFormatado}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Data Emissão</td>
        <td style="padding: 12px 16px; color: #111827;">${emissaoFormatado}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Forma Pgto.</td>
        <td style="padding: 12px 16px; color: #111827;">${boleto.forma_pagamento || 'boleto'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb;">Responsável</td>
        <td style="padding: 12px 16px; color: #111827;">${boleto.responsavel_nome || 'Não atribuído'}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: 600; color: #374151; background: #f9fafb; border-radius: 0 0 0 6px;">Status</td>
        <td style="padding: 12px 16px; color: #111827;">
          <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${boleto.status || 'ABERTO'}</span>
        </td>
      </tr>
    </table>

    ${boleto.observacoes ? `
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0 0 4px; font-weight: 600; color: #374151; font-size: 13px;">Observações:</p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${boleto.observacoes}</p>
    </div>` : ''}

    ${boleto.anexo_boleto_url ? `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1e40af; font-size: 14px;">📎 Anexo do Boleto</p>
      <a href="${boleto.anexo_boleto_url}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Baixar Boleto / Anexo
      </a>
    </div>` : ''}

    <div style="text-align: center; margin: 24px 0 16px;">
      <a href="${linkSistema}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37,99,238,0.3);">
        🔗 Acessar no Sistema
      </a>
      <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">Clique para ver detalhes completos desta obrigação</p>
    </div>

    <div style="text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Este e-mail foi gerado automaticamente pelo sistema Construlog Construlog.<br>
        Acesse o sistema para gerenciar suas obrigações financeiras.
      </p>
    </div>
  </div>
</div>
`;

    // Enviar para todos os destinatários
    let emailsEnviados = 0;
    for (const email of destinatarios) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: assunto,
          body: corpoEmail,
          from_name: 'Construlog Construlog — Financeiro'
        });
        emailsEnviados++;
      } catch (err) {
        console.error(`Erro ao enviar e-mail para ${email}:`, err.message);
      }
    }

    // Criar notificação in-app para o responsável
    const notifEmail = boleto.responsavel_user_id 
      ? destinatarios[0] 
      : (boleto.created_by || destinatarios[0]);

    if (notifEmail) {
      await base44.asServiceRole.entities.Notificacao.create({
        destinatario_email: notifEmail,
        tipo: 'info',
        titulo: `📋 Nova obrigação: ${boleto.descricao}`,
        mensagem: `Boleto de ${valorFormatado} para ${boleto.fornecedor_nome || 'fornecedor não informado'} com vencimento em ${vencFormatado} foi cadastrado.`,
        lida: false,
        link_acao: `ContasPagar?tab=boletos&boleto_id=${event.entity_id}`,
        referencia_tipo: 'BoletoPagar',
        referencia_id: event.entity_id
      });
    }

    return Response.json({ 
      ok: true, 
      emailsEnviados,
      destinatarios,
      boleto_id: event.entity_id 
    });

  } catch (error) {
    console.error('Erro em notificarNovoBoleto:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});