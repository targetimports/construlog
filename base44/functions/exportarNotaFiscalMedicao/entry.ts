import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id, numero_nf, data_nf } = await req.json();

    if (!medicao_id) {
      return Response.json({ error: 'medicao_id é obrigatório' }, { status: 400 });
    }

    // Buscar medição
    const medicao = await base44.entities.Medicao.get(medicao_id);
    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    if (medicao.status !== 'aprovada') {
      return Response.json({ 
        error: 'Medição deve estar aprovada para exportar NF',
        status: 'nao_aprovada'
      }, { status: 400 });
    }

    // Buscar contrato
    const contrato = await base44.entities.Contrato.get(medicao.contrato_id);
    if (!contrato) {
      return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    // Buscar fornecedor
    const fornecedor = await base44.entities.Fornecedor.get(contrato.fornecedor_id);

    // Verificar se NF já existe
    const nfExistente = await base44.entities.NotaFiscal.filter({
      referencia_vinculo: medicao_id,
      vinculado_a: 'medicao'
    });

    let nf;
    if (nfExistente.length > 0) {
      nf = nfExistente[0];
      return Response.json({
        success: true,
        message: 'Nota fiscal já existe para esta medição',
        nf_id: nf.id,
        numero_nf: nf.numero_nf
      });
    }

    // Criar nota fiscal
    nf = await base44.entities.NotaFiscal.create({
      numero_nf: numero_nf || `MED-${medicao.numero}-${Date.now()}`,
      data: data_nf || new Date().toISOString().split('T')[0],
      obra_id: medicao.obra_id,
      fornecedor_id: contrato.fornecedor_id,
      centro_custo_id: contrato.centro_custo_id,
      categoria: 'outro',
      descricao: `Medição ${medicao.numero} - Contrato ${contrato.numero}`,
      valor_bruto: medicao.valor_total_realizado,
      valor_liquido: medicao.valor_liquido,
      forma_pagamento: 'transferencia',
      vinculado_a: 'medicao',
      referencia_vinculo: medicao_id,
      status: 'registrada'
    });

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'exportarNotaFiscalMedicao',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ medicao_id, numero_nf }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        medicao_id,
        nf_id: nf.id,
        numero_nf: nf.numero_nf,
        valor_liquido: medicao.valor_liquido
      }
    });

    return Response.json({
      success: true,
      message: 'Nota fiscal criada com sucesso',
      nf: {
        id: nf.id,
        numero_nf: nf.numero_nf,
        data: nf.data,
        valor_liquido: nf.valor_liquido,
        status: nf.status
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao exportar NF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});