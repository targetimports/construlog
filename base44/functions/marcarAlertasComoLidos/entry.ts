import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Marca alertas como lidos (for counter sino)
 * Não deleta alertas, apenas marca is_read=true e read_at=now
 * Histórico é preservado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { alerta_ids = [], marcar_todos_nao_resolvidos = false } = body;

    console.log('📖 Marcando alertas como lidos:', {
      alerta_ids: alerta_ids.length,
      marcar_todos: marcar_todos_nao_resolvidos
    });

    const agora = new Date();
    let atualizados = 0;

    if (marcar_todos_nao_resolvidos) {
      // Marcar TODOS os alertas não resolvidos como lidos
      const alertas = await base44.asServiceRole.entities.NotificationLog.filter({
        is_resolved: false
      });

      for (const alerta of alertas) {
        if (!alerta.is_read) {
          await base44.asServiceRole.entities.NotificationLog.update(alerta.id, {
            is_read: true,
            read_at: agora.toISOString()
          });
          atualizados++;
        }
      }

      console.log(`✅ ${atualizados} alertas marcados como lidos (todos não-resolvidos)`);

      return Response.json({
        sucesso: true,
        atualizados,
        mensagem: `${atualizados} alerta(s) marcado(s) como lido(s)`
      });
    }

    // Marcar específicos
    for (const alertaId of alerta_ids) {
      try {
        await base44.asServiceRole.entities.NotificationLog.update(alertaId, {
          is_read: true,
          read_at: agora.toISOString()
        });
        atualizados++;
      } catch (err) {
        console.error(`Erro ao marcar alerta ${alertaId}:`, err);
      }
    }

    console.log(`✅ ${atualizados} alertas marcados como lidos`);

    return Response.json({
      sucesso: true,
      atualizados,
      mensagem: `${atualizados} alerta(s) marcado(s) como lido(s)`
    });

  } catch (error) {
    console.error('❌ Erro ao marcar alertas:', error);
    return Response.json({ 
      error: error.message,
      sucesso: false
    }, { status: 500 });
  }
});