import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissão (supervisor/admin)
    if (!['admin', 'supervisor'].includes(user.role)) {
      return Response.json({ error: 'Apenas supervisores podem trocar motorista' }, { status: 403 });
    }

    const { veiculo_id, novo_motorista_email, novo_motorista_nome, motivo_troca, km_na_troca } = await req.json();

    if (!veiculo_id || !novo_motorista_email) {
      return Response.json({ error: 'Campos obrigatórios: veiculo_id, novo_motorista_email' }, { status: 400 });
    }

    // Buscar uso ativo
    const usos = await base44.entities.UsoVeiculo.filter({
      veiculo_id: veiculo_id,
      status: 'ativo'
    });

    if (usos.length === 0) {
      return Response.json({ error: 'Nenhum uso ativo para este veículo' }, { status: 404 });
    }

    const usoAtual = usos[0];

    // Encerrar uso anterior com motivo "Troca de motorista"
    await base44.entities.UsoVeiculo.update(usoAtual.id, {
      km_final: km_na_troca || usoAtual.km_inicial,
      km_percorrido: km_na_troca ? km_na_troca - usoAtual.km_inicial : 0,
      data_hora_fim: new Date().toISOString(),
      status: 'encerrado',
      motivo_encerramento: 'Troca de motorista',
      encerrado_por: user.email
    });

    // Criar novo uso para novo motorista
    const novoUso = await base44.entities.UsoVeiculo.create({
      veiculo_id,
      veiculo_placa: usoAtual.veiculo_placa,
      motorista_email: novo_motorista_email,
      motorista_nome: novo_motorista_nome,
      obra_id: usoAtual.obra_id,
      destino: usoAtual.destino,
      data_hora_inicio: new Date().toISOString(),
      km_inicial: km_na_troca || usoAtual.km_inicial,
      status: 'ativo'
    });

    // Registrar relatório de troca
    const relatorio = await base44.entities.RelatorioTrocaMotorista.create({
      veiculo_id,
      veiculo_placa: usoAtual.veiculo_placa,
      motorista_anterior_email: usoAtual.motorista_email,
      motorista_anterior_nome: usoAtual.motorista_nome,
      motorista_novo_email: novo_motorista_email,
      motorista_novo_nome: novo_motorista_nome,
      data_hora_troca: new Date().toISOString(),
      km_na_troca: km_na_troca || usoAtual.km_inicial,
      motivo_troca: motivo_troca || 'Troca de motorista autorizada',
      autorizado_por: user.email,
      uso_anterior_id: usoAtual.id,
      uso_novo_id: novoUso.id
    });

    return Response.json({
      success: true,
      message: 'Motorista trocado com sucesso',
      relatorio_id: relatorio.id,
      novo_uso_id: novoUso.id
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});