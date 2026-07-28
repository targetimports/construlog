import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * STATUS DO SISTEMA: healthcheck + últimos erros
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, code: 'FORBIDDEN', message: 'Apenas admins' }, { status: 403 });
    }
    
    const status = {
      timestamp: new Date().toISOString(),
      sistema: 'online',
      database: 'online',
      ultimos_erros: [],
      ultimas_execucoes: [],
      stats: { total_obras: 0, total_usuarios: 0, total_ocs: 0, total_medicoes: 0 }
    };
    
    try {
      const [obras, usuarios, ocs, medicoes] = await Promise.all([
        base44.entities.Obra.list('-created_date', 1),
        base44.entities.User.list('-created_date', 1),
        base44.entities.OrdemCompra.list('-created_date', 1),
        base44.entities.Medicao.list('-created_date', 1)
      ]);
      status.stats.total_obras = obras?.length || 0;
      status.stats.total_usuarios = usuarios?.length || 0;
      status.stats.total_ocs = ocs?.length || 0;
      status.stats.total_medicoes = medicoes?.length || 0;
    } catch (e) {
      status.database = 'erro';
    }
    
    try {
      const logs = await base44.entities.LogAuditoriaSistema.filter({});
      status.ultimas_execucoes = (logs || [])
        .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
        .slice(0, 10)
        .map(log => ({ operacao: log.operacao, entidade: log.entidade, data: log.data_hora, usuario: log.usuario_id, funcao: log.origem_funcao }));
    } catch (e) {}
    
    try {
      const erros = await base44.entities.LogIntegridadeSistema.filter({});
      status.ultimos_erros = (erros || [])
        .sort((a, b) => new Date(b.data_bloqueio) - new Date(a.data_bloqueio))
        .slice(0, 10)
        .map(err => ({ tipo_impacto: err.tipo_impacto, entidade: err.entidade, erro: err.erro, data: err.data_bloqueio, usuario: err.usuario_id, funcao: err.funcao }));
    } catch (e) {}
    
    return Response.json({ ok: true, data: status });
  } catch (error) {
    console.error('[getStatusSistema] erro:', error?.message);
    return Response.json({ ok: false, code: 'ERRO_INTERNO', message: 'Erro ao obter status' }, { status: 500 });
  }
});