import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { veiculo_id, km_inicial, obra_id, destino } = await req.json();

    if (!veiculo_id || km_inicial === undefined) {
      return Response.json({ error: 'Campos obrigatórios: veiculo_id, km_inicial' }, { status: 400 });
    }

    // Buscar veículo
    const veiculos = await base44.entities.Veiculo.filter({ id: veiculo_id });
    const veiculo = veiculos[0];

    if (!veiculo) {
      return Response.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Verificar se veículo já está em uso
    if (veiculo.status === 'EM_USO') {
      return Response.json({ error: 'Veículo já está em uso por outro motorista' }, { status: 409 });
    }

    // Verificar se há uso ativo não encerrado
    const usos = await base44.entities.UsoVeiculo.filter({
      veiculo_id: veiculo_id,
      status: 'ativo'
    });

    if (usos.length > 0) {
      return Response.json({ error: 'Veículo tem uso ativo não encerrado' }, { status: 409 });
    }

    // Criar novo uso
    const novoUso = await base44.entities.UsoVeiculo.create({
      veiculo_id,
      veiculo_placa: veiculo.placa,
      motorista_email: user.email,
      motorista_nome: user.full_name,
      obra_id: obra_id || null,
      destino: destino || null,
      data_hora_inicio: new Date().toISOString(),
      km_inicial: Number(km_inicial),
      status: 'ativo'
    });

    // Atualizar status do veículo para EM_USO
    await base44.entities.Veiculo.update(veiculo_id, {
      status: 'EM_USO'
    });

    return Response.json({
      success: true,
      message: 'Uso iniciado com sucesso',
      uso_id: novoUso.id,
      veiculo_placa: veiculo.placa
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});