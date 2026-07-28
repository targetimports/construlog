import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    if (!medicao_id) {
      return Response.json({ error: 'medicao_id obrigatório' }, { status: 400 });
    }

    // Buscar medição
    const medicoes = await base44.entities.Medicao.filter({ id: medicao_id });
    if (!medicoes || medicoes.length === 0) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    const medicao = medicoes[0];

    // Só processar se status é confirmada ou processada
    if (medicao.status !== 'confirmada' && medicao.status !== 'processada') {
      return Response.json({ error: 'Medição deve estar confirmada ou processada' }, { status: 400 });
    }

    // Verificar se já tem conta criada
    const contasExistentes = await base44.entities.ContaFinanceira.filter({
      medicao_id: medicao_id
    });

    if (contasExistentes && contasExistentes.length > 0) {
      return Response.json({ 
        success: true, 
        message: 'Conta já existe para esta medição',
        conta_id: contasExistentes[0].id
      });
    }

    // Criar conta a receber (cliente deve pagar pela medição)
    const conta = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'receber',
      descricao: `Medição #${medicao.numero || medicao.id.substring(0, 8)} - Faturamento`,
      valor: medicao.valor_total_realizado || 0,
      data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendente',
      obra_id: medicao.obra_id || null,
      categoria: 'medicao',
      fornecedor_cliente: 'Cliente',
      centro_custo: medicao.obra_id || 'geral',
      medicao_id: medicao.id,
      observacao: `Auto-gerado de Medição ${medicao.numero || medicao.id.substring(0, 8)}`
    });

    return Response.json({ 
      success: true, 
      message: 'Conta a receber criada automaticamente',
      conta_id: conta.id
    });

  } catch (error) {
    console.error('Erro ao gerar conta de medição:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});