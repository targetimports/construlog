import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getHistoricoEntidade } from './_lib/auditoria.js';

/**
 * Consulta histórico completo de auditoria
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { entidade, entidade_id } = await req.json();

    if (!entidade || !entidade_id) {
      return Response.json({ 
        error: 'Campos obrigatórios: entidade, entidade_id' 
      }, { status: 400 });
    }

    const historico = await getHistoricoEntidade(base44, entidade, entidade_id);

    return Response.json({
      entidade,
      entidade_id,
      total_eventos: historico.length,
      historico
    });

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});