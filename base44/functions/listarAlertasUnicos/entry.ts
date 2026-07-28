import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Lista alertas únicos para o usuário (sem duplicação 24h)
 * Ordenados por severidade e data
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { limite = 100, apenas_ultimas_24h = true } = body;

    console.log('📋 Listando alertas únicos para user:', user.email);

    // Buscar logs de notificação - SOMENTE NÃO RESOLVIDOS
    const logs = await base44.asServiceRole.entities.NotificationLog.filter({
      is_resolved: false
    });

    if (!logs || logs.length === 0) {
      return Response.json({
        sucesso: true,
        alertas: [],
        total: 0,
        nao_lidos: 0
      });
    }

    // Filtrar por período
    let alertasFiltrados = logs;

    if (apenas_ultimas_24h) {
      const agora = new Date();
      const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
      alertasFiltrados = logs.filter(log => {
        const logData = new Date(log.created_at);
        return logData >= umDiaAtras;
      });
    }

    // Contar não-lidos
    const naoLidos = alertasFiltrados.filter(a => !a.is_read).length;

    // Ordenar por severidade (CRITICO > ATENCAO > INFO) e depois por data
    const severidadeScore = { 'CRITICO': 3, 'ATENCAO': 2, 'INFO': 1 };
    alertasFiltrados.sort((a, b) => {
      const scoreA = severidadeScore[a.severidade] || 0;
      const scoreB = severidadeScore[b.severidade] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.last_seen_at || b.created_at) - new Date(a.last_seen_at || a.created_at);
    });

    // Pegar apenas os primeiros 'limite'
    const alertas = alertasFiltrados.slice(0, limite);

    console.log(`✅ Retornando ${alertas.length} alertas únicos (filtrados de ${alertasFiltrados.length})`);

    return Response.json({
      sucesso: true,
      alertas: alertas.map(log => ({
        id: log.id,
        tipo: log.tipo_alerta,
        severidade: log.severidade,
        obra_id: log.obra_id,
        mensagem: log.mensagem_base,
        codigo_problema: log.codigo_problema,
        created_at: log.created_at,
        last_seen_at: log.last_seen_at,
        last_notified_at: log.last_notified_at,
        is_read: log.is_read,
        is_resolved: log.is_resolved,
        fingerprint: log.fingerprint
      })),
      total: alertasFiltrados.length,
      nao_lidos: naoLidos,
      periodo: apenas_ultimas_24h ? 'últimas 24h' : 'todos'
    });

  } catch (error) {
    console.error('❌ Erro ao listar alertas:', error);
    return Response.json({ 
      error: error.message,
      sucesso: false
    }, { status: 500 });
  }
});