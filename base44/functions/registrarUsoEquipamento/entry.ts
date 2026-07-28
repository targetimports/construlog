import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { equipamento_id, obra_id, data_inicio, data_fim, tipo_uso, observacoes } = await req.json();

    if (!equipamento_id || !obra_id || !data_inicio) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Verificar se equipamento está disponível (não em uso simultâneo)
    const usosAtivos = await base44.entities.RegistroUsoEquipamento.filter({
      equipamento_id,
      status: 'registrado'
    });

    for (const uso of usosAtivos) {
      const inicioExistente = new Date(uso.data_inicio);
      const fimExistente = uso.data_fim ? new Date(uso.data_fim) : new Date();
      const inicioNovo = new Date(data_inicio);
      const fimNovo = data_fim ? new Date(data_fim) : new Date();

      if (inicioNovo < fimExistente && fimNovo > inicioExistente) {
        return Response.json({ 
          error: `Equipamento já está em uso em outra obra neste período` 
        }, { status: 409 });
      }
    }

    const equipamento = await base44.asServiceRole.entities.Equipamento.list();
    const equip = equipamento.find(e => e.id === equipamento_id);

    if (!equip) return Response.json({ error: 'Equipamento não encontrado' }, { status: 404 });

    // Calcular horas
    const inicio = new Date(data_inicio);
    const fim = data_fim ? new Date(data_fim) : new Date();
    const horas = (fim - inicio) / (1000 * 60 * 60);

    // Calcular custo
    let custo_total = 0;
    if (horas <= 8 && equip.custo_diaria > 0) {
      custo_total = equip.custo_diaria;
    } else {
      custo_total = horas * (equip.custo_hora || 0);
    }

    // Criar registro de uso
    const registroUso = await base44.entities.RegistroUsoEquipamento.create({
      equipamento_id,
      obra_id,
      data_inicio,
      data_fim: data_fim || new Date().toISOString(),
      horas_trabalhadas: parseFloat(horas.toFixed(2)),
      tipo_uso: tipo_uso || 'proprio',
      custo_total,
      observacoes,
      status: 'registrado'
    });

    // Gerar lançamento financeiro
    const lancamento = await base44.entities.LancamentoFinanceiro.create({
      obra_id,
      categoria: 'equipamento',
      descricao: `${equip.nome} - ${horas.toFixed(2)}h - ${tipo_uso}`,
      valor: custo_total,
      tipo: 'despesa',
      data: new Date().toISOString().split('T')[0],
      registrado_por: user.email,
      vinculado_a: 'RegistroUsoEquipamento',
      referencia_vinculo: registroUso.id
    });

    // Atualizar registro com ID do lançamento
    await base44.entities.RegistroUsoEquipamento.update(registroUso.id, {
      lancamento_financeiro_id: lancamento.id
    });

    return Response.json({
      success: true,
      registro_id: registroUso.id,
      lancamento_id: lancamento.id,
      custo_total
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});