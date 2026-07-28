import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para obter uma vistoria com todos os seus itens e mídias
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { vistoria_id } = await req.json();
    if (!vistoria_id) {
      return Response.json({ error: 'vistoria_id é obrigatório' }, { status: 400 });
    }

    // Obter vistoria
    const vistoria = await base44.entities.Vistoria.get(vistoria_id);
    if (!vistoria) {
      return Response.json({ error: 'Vistoria não encontrada' }, { status: 404 });
    }

    // Obter itens da vistoria
    const itens = await base44.entities.VistoriaItem.filter({
      vistoria_id: vistoria_id
    });

    // Obter mídias da vistoria
    const midias = await base44.entities.VistoriaMidia.filter({
      vistoria_id: vistoria_id
    });

    // Enriquecer com dados do veículo
    const veiculo = await base44.entities.Veiculo.get(vistoria.veiculo_id);

    return Response.json({
      vistoria: {
        id: vistoria.id,
        veiculo_id: vistoria.veiculo_id,
        veiculo_placa: veiculo?.placa || 'Desconhecido',
        veiculo_modelo: veiculo?.modelo || '',
        obra_id: vistoria.obra_id,
        data_hora: vistoria.data_hora,
        tipo: vistoria.tipo,
        km: vistoria.km,
        responsavel_id: vistoria.responsavel_id,
        observacao: vistoria.observacao,
        created_at: vistoria.created_date
      },
      itens: itens,
      midias: midias
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});