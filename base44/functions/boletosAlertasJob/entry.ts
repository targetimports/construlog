import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    const diasAlerta = [7, 3, 1, 0]; // dias antes do vencimento

    // Buscar boletos ABERTOS e RASCUNHO
    const boletosList = await base44.asServiceRole.entities.BoletoPagar.filter({ status: 'ABERTO' });
    
    let notificacoesCriadas = 0;
    let emailsEnviados = 0;

    for (const boleto of boletosList) {
      if (!boleto.data_vencimento) continue;
      
      const venc = new Date(boleto.data_vencimento + 'T12:00:00');
      const diffMs = venc.getTime() - hoje.getTime();
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      // Determinar tipo de alerta
      let tipoAlerta = null;
      let titulo = '';
      let mensagem = '';

      if (diffDias < 0) {
        // Vencido
        const diasAtraso = Math.abs(diffDias);
        tipoAlerta = 'VENCIDO';
        titulo = `⚠️ Boleto vencido há ${diasAtraso} dia(s)`;
        mensagem = `Boleto "${boleto.descricao}" de R$ ${(boleto.valor||0).toFixed(2)} venceu em ${new Date(boleto.data_vencimento).toLocaleDateString('pt-BR')}.`;
      } else if (diasAlerta.includes(diffDias)) {
        tipoAlerta = 'VENCIMENTO_PROXIMO';
        if (diffDias === 0) {
          titulo = '🔴 Boleto vence HOJE';
        } else {
          titulo = `🟡 Boleto vence em ${diffDias} dia(s)`;
        }
        mensagem = `Boleto "${boleto.descricao}" de R$ ${(boleto.valor||0).toFixed(2)}${boleto.fornecedor_nome ? ` (${boleto.fornecedor_nome})` : ''} vence em ${new Date(boleto.data_vencimento).toLocaleDateString('pt-BR')}.`;
      }

      if (!tipoAlerta) continue;

      // Verificar se já enviou esse alerta hoje
      const alertasHoje = (boleto.alertas_enviados || []).filter(a => 
        a.data && a.data.startsWith(hojeStr) && a.tipo === tipoAlerta
      );
      if (alertasHoje.length > 0) continue;

      // Determinar destinatário
      let emailDest = '';
      if (boleto.responsavel_user_id) {
        const users = await base44.asServiceRole.entities.User.filter({ id: boleto.responsavel_user_id });
        if (users[0]) emailDest = users[0].email;
      }
      if (!emailDest) emailDest = boleto.created_by || '';
      if (!emailDest) continue;

      // Criar notificação in-app
      await base44.asServiceRole.entities.Notificacao.create({
        destinatario_email: emailDest,
        tipo: tipoAlerta,
        titulo,
        mensagem,
        lida: false,
        link_acao: `ContasPagar?tab=boletos&boleto_id=${boleto.id}`,
        referencia_tipo: 'BoletoPagar',
        referencia_id: boleto.id
      });
      notificacoesCriadas++;

      // Enviar e-mail
      const assunto = tipoAlerta === 'VENCIDO' 
        ? `[URGENTE] Boleto vencido - ${boleto.descricao}`
        : `Lembrete: Boleto vence em ${diffDias} dia(s) - ${boleto.descricao}`;

      const corpoEmail = `
<h2>${titulo}</h2>
<table style="border-collapse:collapse;width:100%;max-width:500px;">
  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Descrição</td><td style="padding:8px;border:1px solid #ddd;">${boleto.descricao}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Fornecedor</td><td style="padding:8px;border:1px solid #ddd;">${boleto.fornecedor_nome || '-'}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Obra</td><td style="padding:8px;border:1px solid #ddd;">${boleto.obra_nome || '-'}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Valor</td><td style="padding:8px;border:1px solid #ddd;">R$ ${(boleto.valor||0).toFixed(2)}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Vencimento</td><td style="padding:8px;border:1px solid #ddd;">${new Date(boleto.data_vencimento).toLocaleDateString('pt-BR')}</td></tr>
</table>
<p style="margin-top:16px;">Acesse o sistema para mais detalhes.</p>
`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: emailDest,
        subject: assunto,
        body: corpoEmail
      });
      emailsEnviados++;

      // Registrar no log de alertas
      const novoAlerta = { data: new Date().toISOString(), tipo: tipoAlerta, canal: 'email+app' };
      await base44.asServiceRole.entities.BoletoPagar.update(boleto.id, {
        alertas_enviados: [...(boleto.alertas_enviados || []), novoAlerta]
      });
    }

    return Response.json({ 
      ok: true, 
      boletosProcessados: boletosList.length, 
      notificacoesCriadas, 
      emailsEnviados 
    });
  } catch (error) {
    console.error('Erro em boletosAlertasJob:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});