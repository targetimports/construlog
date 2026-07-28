import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();

    // Criar nova rota
    if (action === 'criar_rota') {
      const novaRota = {
        nome: data.nome,
        motorista_id: data.motorista_id,
        veiculo_id: data.veiculo_id,
        endereco_origem: data.endereco_origem,
        endereco_destino: data.endereco_destino,
        latitude_origem: data.latitude_origem,
        longitude_origem: data.longitude_origem,
        latitude_destino: data.latitude_destino,
        longitude_destino: data.longitude_destino,
        data_planejada: data.data_planejada,
        frequencia: data.frequencia || 'unica',
        status: 'planejada',
        observacoes: data.observacoes
      };

      const rota = await base44.entities.RotaPlanejada.create(novaRota);
      return Response.json({ success: true, rota });
    }

    // Atualizar status da rota
    if (action === 'atualizar_status') {
      const rota = await base44.entities.RotaPlanejada.update(data.rota_id, {
        status: data.status,
        latitude_atual: data.latitude_atual,
        longitude_atual: data.longitude_atual
      });
      return Response.json({ success: true, rota });
    }

    // Listar rotas do motorista
    if (action === 'listar_rotas_motorista') {
      const rotas = await base44.entities.RotaPlanejada.filter({
        motorista_id: data.motorista_id
      }, '-data_planejada');
      return Response.json({ success: true, rotas });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});