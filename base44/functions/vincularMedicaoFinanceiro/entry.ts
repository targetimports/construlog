import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    if (!medicao_id) {
      return Response.json({ error: 'medicao_id é obrigatório' }, { status: 400 });
    }

    // Buscar a medição
    const medicoes = await base44.entities.Medicao.filter({ id: medicao_id });
    const medicao = medicoes[0];

    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    // Verificar se medição está aprovada
    if (medicao.status !== 'aprovada') {
      return Response.json({ error: 'Apenas medições aprovadas geram contas financeiras' }, { status: 400 });
    }

    // Verificar se já existe conta vinculada
    if (medicao.conta_financeira_id) {
      return Response.json({ error: 'Esta medição já possui conta financeira vinculada' }, { status: 400 });
    }

    // Buscar obra para pegar informações
    const obras = await base44.entities.Obra.filter({ id: medicao.obra_id });
    const obra = obras[0];

    // Criar conta a receber
    const contaCriada = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'receber',
      descricao: `Medição ${medicao.numero} - ${obra?.nome || 'Obra'}`,
      valor: medicao.valor_medido,
      data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
      status: 'pendente',
      obra_id: medicao.obra_id,
      categoria: 'medicao',
      medicao_id: medicao.id,
      fornecedor_cliente: obra?.cliente || 'Cliente',
      observacao: `Conta gerada automaticamente pela medição ${medicao.numero}`
    });

    // Atualizar medição com ID da conta
    await base44.asServiceRole.entities.Medicao.update(medicao.id, {
      conta_financeira_id: contaCriada.id
    });

    // Calcular e criar impostos vinculados
    const impostos = await base44.entities.Imposto.filter({ 
      obra_id: medicao.obra_id, 
      base_calculo: 'medicao' 
    });

    const impostosGerados = [];
    for (const imposto of impostos) {
      const valorImposto = (medicao.valor_medido * imposto.aliquota) / 100;
      
      const contaImposto = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        descricao: `${imposto.nome} - Medição ${medicao.numero}`,
        valor: valorImposto,
        data_vencimento: imposto.data_vencimento || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        obra_id: medicao.obra_id,
        categoria: 'imposto',
        medicao_id: medicao.id,
        imposto_id: imposto.id,
        observacao: `Imposto gerado automaticamente pela medição ${medicao.numero}`
      });

      impostosGerados.push(contaImposto);
    }

    return Response.json({
      sucesso: true,
      conta_receber: contaCriada,
      impostos_gerados: impostosGerados,
      mensagem: `Conta a receber criada: R$ ${medicao.valor_medido.toFixed(2)} + ${impostosGerados.length} impostos`
    });
  } catch (error) {
    console.error('Erro ao vincular medição ao financeiro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});