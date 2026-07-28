import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { operation, id_local, data } = body;

    if (operation === 'create_inspection') {
      // Validar idempotência via id_local
      // Verificar se já existe vistoria com este id_local
      const existing = await base44.entities.DiarioObra.filter({
        id_local: id_local
      });

      if (existing.length > 0) {
        return Response.json({
          id: existing[0].id,
          message: 'Vistoria já existe (idempotente)'
        });
      }

      // Criar nova vistoria
      const inspection = await base44.entities.DiarioObra.create({
        ...data,
        id_local: id_local,
        created_by_offline: user.email,
        sync_status: 'synced'
      });

      return Response.json({
        id: inspection.id,
        message: 'Vistoria sincronizada com sucesso'
      });
    }

    return Response.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error) {
    console.error('❌ Erro ao sincronizar:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});