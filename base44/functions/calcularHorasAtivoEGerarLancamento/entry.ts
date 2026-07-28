import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { horas_ativo_id } = await req.json();

    if (!horas_ativo_id) {
      return Response.json({ error: 'horas_ativo_id é obrigatório' }, { status: 400 });
    }

    // Buscar HorasAtivo
    const horasAtivo = await base44.asServiceRole.entities.HorasAtivo.read(horas_ativo_id);
    if (!horasAtivo) {
      return Response.json({ error: 'Registro de horas não encontrado' }, { status: 404 });
    }

    // Se já gerou lançamento, retornar
    if (horasAtivo.lancamento_financeiro_id) {
      return Response.json({
        success: true,
        lancamento_financeiro_id: horasAtivo.lancamento_financeiro_id,
        mensagem: 'Lançamento já foi criado'
      });
    }

    // Calcular horas
    const horas_trabalhadas = horasAtivo.horimetro_final - horasAtivo.horimetro_inicial;
    const horas_normais = Math.min(horas_trabalhadas, horasAtivo.horas_normais || 8);
    const horas_extras = Math.max(0, horas_trabalhadas - (horasAtivo.horas_normais || 8));

    const custo_total = 
      (horas_normais * (horasAtivo.custo_hora_normal || 0)) + 
      (horas_extras * (horasAtivo.custo_hora_extra || horasAtivo.custo_hora_normal || 0));

    // Buscar ativo para nome
    const ativo = await base44.asServiceRole.entities.Ativo.read(horasAtivo.ativo_id);
    const nomeAtivo = ativo?.descricao || ativo?.nome || 'Ativo desconhecido';

    // Criar LancamentoFinanceiro
    const lancamento = await base44.asServiceRole.entities.LancamentoFinanceiro.create({
      obra_id: horasAtivo.obra_id,
      data: horasAtivo.data,
      tipo: 'despesa',
      categoria: 'Máquinas/Ativos',
      descricao: `Horas ${nomeAtivo} - ${horasAtivo.data} - Operador: ${horasAtivo.operador}`,
      valor: custo_total,
      status: 'pendente',
      origem_tipo: 'horas_ativo',
      origem_id: horas_ativo_id
    });

    // Atualizar HorasAtivo com cálculos
    await base44.asServiceRole.entities.HorasAtivo.update(horas_ativo_id, {
      horas_trabalhadas,
      horas_normais,
      horas_extras,
      custo_total,
      lancamento_financeiro_id: lancamento.id
    });

    return Response.json({
      success: true,
      lancamento_financeiro_id: lancamento.id,
      horas_trabalhadas,
      horas_normais,
      horas_extras,
      custo_total,
      mensagem: 'Horas calculadas e lançamento financeiro criado'
    });
  } catch (error) {
    console.error('Erro ao calcular horas:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});