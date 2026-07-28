import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role === 'admin') {
      return Response.json({ error: 'Apenas admins podem processar provisões' }, { status: 403 });
    }

    const { contratoId, medicaoId } = await req.json();

    // 1. Buscar medição
    const medicoes = await base44.entities.ItemMedicao?.filter?.({
      id: medicaoId,
      status: 'aprovada'
    });
    const medicao = medicoes?.[0];

    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    // 2. Buscar contrato
    const contratos = await base44.entities.Contrato.filter({ id: contratoId });
    const contrato = contratos[0];

    // 3. Gerar contas a receber automaticamente
    const contas = [];

    // Conta principal
    contas.push({
      tipo: 'receber',
      descricao: `Medição ${medicao.numero} - Contrato ${contrato.numero}`,
      valor: medicao.valor_total - (medicao.descontos?.reduce((a, d) => a + d.valor, 0) || 0),
      data_vencimento: medicao.data_medicao ? 
        new Date(new Date(medicao.data_medicao).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] :
        new Date().toISOString().split('T')[0],
      status: 'pendente',
      contrato_id: contratoId,
      medicao_id: medicaoId,
      categoria: 'medicao'
    });

    // Retenção técnica (se houver)
    const retencaoTecnica = medicao.retencoes?.find(r => r.tipo === 'retencao_tecnica');
    if (retencaoTecnica) {
      contas.push({
        tipo: 'receber',
        descricao: `Retenção Técnica - Medição ${medicao.numero}`,
        valor: retencaoTecnica.valor,
        data_vencimento: new Date(new Date(medicao.data_medicao).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        contrato_id: contratoId,
        medicao_id: medicaoId,
        categoria: 'medicao',
        observacao: '2ª parcela - retenção técnica'
      });
    }

    // 4. Criar contas
    const resultado = {
      contas_criadas: [],
      erros: []
    };

    for (const conta of contas) {
      try {
        const contaCriada = await base44.entities.ContaFinanceira.create(conta);
        resultado.contas_criadas.push(contaCriada.id);
      } catch (error) {
        resultado.erros.push({ conta: conta.descricao, erro: error.message });
      }
    }

    // 5. Atualizar medição com referência de contas
    if (resultado.contas_criadas.length > 0) {
      await base44.entities.ItemMedicao?.update?.(medicaoId, {
        provisao_realizada: true,
        contas_geradas: resultado.contas_criadas,
        data_provisao: new Date().toISOString()
      });
    }

    return Response.json({
      sucesso: resultado.erros.length === 0,
      contas_criadas: resultado.contas_criadas.length,
      erros: resultado.erros,
      detalhes: `${resultado.contas_criadas.length} conta(s) criada(s) com sucesso`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});