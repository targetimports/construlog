import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

/**
 * Gera alertas com deduplicação por 24 horas
 * Evita spam: mesmo problema/obra = apenas 1 alerta por dia
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      tipo_alerta, 
      obra_id, 
      codigo_problema, 
      mensagem_base,
      severidade = 'INFO',
      dados_alerta = {}
    } = body;

    if (!tipo_alerta || !codigo_problema) {
      return Response.json({ 
        error: 'tipo_alerta e codigo_problema são obrigatórios' 
      }, { status: 400 });
    }

    // 1. Calcular fingerprint
    const fingerprint = createHash('sha256')
      .update(`${tipo_alerta}|${obra_id || 'global'}|${codigo_problema}|${mensagem_base}`)
      .digest('hex');

    console.log('🔔 Gerando alerta:', { tipo_alerta, obra_id, codigo_problema, fingerprint });

    // 2. Verificar se já existe alerta com esse fingerprint criado nas últimas 24h
    const agora = new Date();
    const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    const alertasExistentes = await base44.asServiceRole.entities.NotificationLog.filter({
      fingerprint: fingerprint
    });

    let alertaRecente = alertasExistentes.find(log => {
      const logData = new Date(log.created_at);
      return logData >= umDiaAtras;
    });

    // 3. Se existe alerta recente, apenas atualizar o last_notified_at e retornar
    if (alertaRecente) {
      console.log('⚠️ Alerta com fingerprint recente já existe, atualizando last_notified_at');
      
      await base44.asServiceRole.entities.NotificationLog.update(alertaRecente.id, {
        last_notified_at: agora.toISOString()
      });

      return Response.json({
        sucesso: true,
        acao: 'atualizado',
        fingerprint,
        mensagem: 'Alerta existente atualizado (dedup 24h ativo)'
      });
    }

    // 4. Se não existe, criar novo alerta
    console.log('✅ Criando novo alerta (primeiro da série ou >24h da última ocorrência)');

    const novoAlerta = await base44.asServiceRole.entities.NotificationLog.create({
      fingerprint,
      tipo_alerta,
      obra_id: obra_id || null,
      codigo_problema,
      mensagem_base,
      user_email: user.email,
      last_notified_at: agora.toISOString(),
      notificacao_enviada: false,
      severidade
    });

    return Response.json({
      sucesso: true,
      acao: 'criado',
      alerta_id: novoAlerta.id,
      fingerprint,
      mensagem: 'Novo alerta criado'
    });

  } catch (error) {
    console.error('❌ Erro ao gerar alerta:', error);
    return Response.json({ 
      error: error.message,
      sucesso: false
    }, { status: 500 });
  }
});