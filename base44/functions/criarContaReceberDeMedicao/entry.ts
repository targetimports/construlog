import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id, status, obra_id } = await req.json();

    // Validar se medição foi aprovada
    if (status !== 'aprovada') {
      return Response.json({ 
        message: 'Medição não aprovada - nenhum lançamento gerado',
        status: 'skipped'
      });
    }

    if (!medicao_id || !obra_id) {
      return Response.json({ 
        error: 'medicao_id e obra_id são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar medição para obter dados
    const medicao = await base44.entities.Medicao.get(medicao_id);
    
    if (!medicao) {
      return Response.json({ 
        error: 'Medição não encontrada' 
      }, { status: 404 });
    }

    // Verificar se já existe lançamento para esta medição
    const contasExistentes = await base44.entities.ContaFinanceira.filter({
      referencia_tipo: 'medicao',
      referencia_id: medicao_id
    });

    if (contasExistentes.length > 0) {
      return Response.json({ 
        message: 'Conta a receber já existe para esta medição',
        status: 'already_exists',
        conta_id: contasExistentes[0].id
      });
    }

    // Criar conta a receber
    const contaReceber = await base44.entities.ContaFinanceira.create({
      tipo: 'receber',
      obra_id: obra_id,
      descricao: `Medição ${medicao.numero || ''} - Contrato`,
      valor: medicao.valor_liquido || medicao.valor_total_realizado || 0,
      data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
      status: 'pendente',
      categoria: 'medicao',
      referencia_tipo: 'medicao',
      referencia_id: medicao_id,
      observacao: `Gerado automaticamente de Medição ${medicao.id}`
    });

    // Log de auditoria
    await base44.entities.LogAuditoria.create({
      function_name: 'criarContaReceberDeMedicao',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ medicao_id, obra_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        conta_id: contaReceber.id,
        medicao_id: medicao_id,
        obra_id: obra_id,
        valor: medicao.valor_liquido || medicao.valor_total_realizado
      }
    });

    return Response.json({ 
      success: true,
      conta_id: contaReceber.id,
      message: 'Conta a receber criada automaticamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar conta a receber:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});