import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para obter uma movimentação de veículo com mídias
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { movimentacao_id } = await req.json();
    if (!movimentacao_id) {
      return Response.json({ error: 'movimentacao_id é obrigatório' }, { status: 400 });
    }

    // Obter movimentação
    const movimentacao = await base44.entities.MovimentacaoVeiculo.get(movimentacao_id);
    if (!movimentacao) {
      return Response.json({ error: 'Movimentação não encontrada' }, { status: 404 });
    }

    // Obter mídias da movimentação
    const midias = await base44.entities.MovimentacaoVeiculoMidia.filter({
      movimentacao_id: movimentacao_id
    });

    // Enriquecer com dados do veículo e obras
    const veiculo = await base44.entities.Veiculo.get(movimentacao.veiculo_id);
    const obraOrigem = movimentacao.obra_origem_id ? 
      await base44.entities.Obra.get(movimentacao.obra_origem_id) : null;
    const obraDestino = movimentacao.obra_destino_id ? 
      await base44.entities.Obra.get(movimentacao.obra_destino_id) : null;

    // Calcular quilometragem percorrida
    const km_percorrido = movimentacao.km_final && movimentacao.km_inicial ? 
      movimentacao.km_final - movimentacao.km_inicial : 0;

    // Calcular tempo de uso
    let horas_uso = 0;
    if (movimentacao.saida_hora && movimentacao.retorno_hora) {
      const saida = new Date(movimentacao.saida_hora);
      const retorno = new Date(movimentacao.retorno_hora);
      horas_uso = (retorno - saida) / (1000 * 60 * 60); // em horas
    }

    return Response.json({
      movimentacao: {
        id: movimentacao.id,
        veiculo_id: movimentacao.veiculo_id,
        veiculo_placa: veiculo?.placa || 'Desconhecido',
        veiculo_modelo: veiculo?.modelo || '',
        obra_origem_id: movimentacao.obra_origem_id,
        obra_origem_nome: obraOrigem?.nome || '',
        obra_destino_id: movimentacao.obra_destino_id,
        obra_destino_nome: obraDestino?.nome || '',
        saida_hora: movimentacao.saida_hora,
        retorno_hora: movimentacao.retorno_hora,
        km_inicial: movimentacao.km_inicial,
        km_final: movimentacao.km_final,
        km_percorrido: km_percorrido,
        horas_uso: horas_uso.toFixed(2),
        motivo: movimentacao.motivo,
        responsavel_id: movimentacao.responsavel_id,
        status: movimentacao.status,
        created_at: movimentacao.created_date
      },
      midias: midias
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});