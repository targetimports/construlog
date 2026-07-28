import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

/**
 * Gera alertas com deduplicação ATÔMICA por 24 horas
 * Previne corrida de threads: check + create é seguro
 * 
 * Usa fingerprint_date_bucket (fingerprint + YYYY-MM-DD) como chave única
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
      severidade = 'INFO'
    } = body;

    if (!tipo_alerta || !codigo_problema) {
      return Response.json({ 
        error: 'tipo_alerta e codigo_problema são obrigatórios' 
      }, { status: 400 });
    }

    const agora = new Date();

    // 1. Calcular fingerprint (estável, sem timestamp)
    const fingerprint = createHash('sha256')
      .update(`${tipo_alerta}|${obra_id || 'global'}|${codigo_problema}|${mensagem_base}`)
      .digest('hex');

    // 2. Calcular date bucket (YYYY-MM-DD) para garantir unicidade no dia
    const dateBucket = agora.toISOString().split('T')[0]; // YYYY-MM-DD
    const fingerprintDateBucket = `${fingerprint}#${dateBucket}`;

    console.log('🔔 Gerando alerta com dedup atômico:', {
      tipo_alerta,
      obra_id,
      codigo_problema,
      fingerprint: fingerprint.substring(0, 8) + '...',
      date_bucket: dateBucket
    });

    // 3. Buscar alertas com ESSE fingerprint nos últimos 24h
    const alertasRecentes = await base44.asServiceRole.entities.NotificationLog.filter({
      fingerprint: fingerprint
    });

    const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    let alertaHoje = alertasRecentes.find(log => {
      const logData = new Date(log.created_at);
      return logData >= umDiaAtras;
    });

    // 4. DEDUP ATÔMICO: se existe alerta hoje com esse fingerprint → atualizar
    if (alertaHoje) {
      console.log('⚠️ Alerta já existe neste período de 24h, atualizando last_seen_at');

      await base44.asServiceRole.entities.NotificationLog.update(alertaHoje.id, {
        last_seen_at: agora.toISOString()
        // NÃO incrementar contador, NÃO enviar novo toast
      });

      return Response.json({
        sucesso: true,
        acao: 'atualizado_dedup',
        alerta_id: alertaHoje.id,
        fingerprint,
        mensagem: 'Alerta existente atualizado (dedup 24h ativo, sem novo toast)'
      });
    }

    // 5. Se não existe → CRIAR NOVO alerta (thread-safe via fingerprint_date_bucket)
    console.log('✅ Criando novo alerta (primeira ocorrência no período de 24h)');

    try {
      const novoAlerta = await base44.asServiceRole.entities.NotificationLog.create({
        fingerprint,
        fingerprint_date_bucket: fingerprintDateBucket,
        tipo_alerta,
        obra_id: obra_id || null,
        codigo_problema,
        mensagem_base,
        user_email: user.email,
        severidade,
        is_read: false,
        last_seen_at: agora.toISOString(),
        last_notified_at: agora.toISOString(),
        is_resolved: false
      });

      console.log('✅ Alerta criado com sucesso:', novoAlerta.id);

      return Response.json({
        sucesso: true,
        acao: 'criado',
        alerta_id: novoAlerta.id,
        fingerprint,
        mensagem: 'Novo alerta criado'
      });

    } catch (createError) {
      // Se falhar por constraint único (improvável), retornar sucesso
      // pois significa outro thread criou
      if (createError.message?.includes('unique') || createError.message?.includes('duplicate')) {
        console.warn('⚠️ Falha por constraint único (outro thread criou), voltando a buscar...');
        
        // Refetch para garantir
        const alertasRefetch = await base44.asServiceRole.entities.NotificationLog.filter({
          fingerprint: fingerprint
        });
        const alertaExistente = alertasRefetch.find(log => {
          const logData = new Date(log.created_at);
          return logData >= umDiaAtras;
        });

        if (alertaExistente) {
          return Response.json({
            sucesso: true,
            acao: 'criado_por_outro_thread',
            alerta_id: alertaExistente.id,
            fingerprint,
            mensagem: 'Alerta já criado por outro thread (dedup garantido)'
          });
        }
      }

      throw createError;
    }

  } catch (error) {
    console.error('❌ Erro ao gerar alerta:', error);
    return Response.json({ 
      error: error.message,
      sucesso: false
    }, { status: 500 });
  }
});