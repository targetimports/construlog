import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { solicitacao_id, veiculo_id, motorista_user_id } = await req.json();

    if (!solicitacao_id || !veiculo_id || !motorista_user_id) {
      return Response.json({
        error: 'solicitacao_id, veiculo_id e motorista_user_id são obrigatórios'
      }, { status: 400 });
    }

    // Buscar solicitação
    const solicitacao = await base44.asServiceRole.entities.SolicitacaoTransporte.read(solicitacao_id);
    if (!solicitacao) {
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    // Validar status
    if (solicitacao.status !== 'aprovada') {
      return Response.json({
        error: 'Solicitação deve estar aprovada para gerar viagem'
      }, { status: 400 });
    }

    // Buscar veículo
    const veiculo = await base44.asServiceRole.entities.Veiculo.read(veiculo_id);
    if (!veiculo) {
      return Response.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Buscar motorista
    const motorista = await base44.asServiceRole.entities.Motorista.filter({
      user_id: motorista_user_id
    });
    if (!motorista || motorista.length === 0) {
      return Response.json({ error: 'Motorista não encontrado' }, { status: 404 });
    }

    // Gerar número sequencial
    const ultimasViagens = await base44.asServiceRole.entities.Viagem.filter(
      {},
      '-created_date',
      1
    );
    const proximoNum = (ultimasViagens.length > 0 && ultimasViagens[0].numero)
      ? parseInt(ultimasViagens[0].numero.split('-')[1]) + 1
      : 1;
    const novoNumero = `VG-${String(proximoNum).padStart(6, '0')}`;

    // Criar Viagem
    const viagem = await base44.asServiceRole.entities.Viagem.create({
      numero: novoNumero,
      solicitacao_id,
      obra_id: solicitacao.obra_id,
      veiculo_id,
      motorista_user_id,
      status: 'pendente'
    });

    // Atualizar solicitação
    await base44.asServiceRole.entities.SolicitacaoTransporte.update(solicitacao_id, {
      status: 'em_execucao',
      viagem_id: viagem.id
    });

    return Response.json({
      success: true,
      viagem_id: viagem.id,
      numero: viagem.numero,
      mensagem: 'Viagem criada com sucesso. Motorista pode iniciar.'
    });
  } catch (error) {
    console.error('Erro ao gerar viagem:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});