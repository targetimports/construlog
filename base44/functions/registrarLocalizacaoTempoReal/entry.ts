import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { latitude, longitude, rota_id } = await req.json();

    if (!latitude || !longitude || !rota_id) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Registra a localização na rota
    try {
      await base44.entities.RotaMotorista.update(rota_id, {
        ultima_latitude: latitude,
        ultima_longitude: longitude,
        ultima_atualizacao_gps: new Date().toISOString()
      });
    } catch (updateErr) {
      // Se a rota não existir ou não puder ser atualizada, apenas loga
      console.warn('Não foi possível atualizar a rota:', updateErr.message);
    }

    return Response.json({
      success: true,
      rota_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao registrar localização:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});