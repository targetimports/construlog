import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uso_id, km_final, observacao } = await req.json();

    if (!uso_id || km_final === undefined) {
      return Response.json({ error: 'Campos obrigatórios: uso_id, km_final' }, { status: 400 });
    }

    // Buscar uso
    const usos = await base44.entities.UsoVeiculo.filter({ id: uso_id });
    const uso = usos[0];

    if (!uso) {
      return Response.json({ error: 'Uso não encontrado' }, { status: 404 });
    }

    if (uso.status !== 'ativo') {
      return Response.json({ error: 'Uso não está ativo' }, { status: 400 });
    }

    // Validar km final
    if (km_final < uso.km_inicial) {
      return Response.json({ error: 'KM final não pode ser menor que KM inicial' }, { status: 400 });
    }

    const kmPercorrido = km_final - uso.km_inicial;

    // Atualizar uso
    await base44.entities.UsoVeiculo.update(uso_id, {
      km_final: Number(km_final),
      km_percorrido: kmPercorrido,
      data_hora_fim: new Date().toISOString(),
      observacao: observacao || null,
      status: 'encerrado'
    });

    // Atualizar status do veículo para DISPONÍVEL
    await base44.entities.Veiculo.update(uso.veiculo_id, {
      status: 'DISPONÍVEL'
    });

    return Response.json({
      success: true,
      message: 'Uso finalizado com sucesso',
      km_percorrido: kmPercorrido,
      tempo_uso: calcularTempoUso(uso.data_hora_inicio, new Date().toISOString())
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calcularTempoUso(dataInicio, dataFim) {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  const diffMs = fim - inicio;
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHoras}h ${diffMinutos}min`;
}