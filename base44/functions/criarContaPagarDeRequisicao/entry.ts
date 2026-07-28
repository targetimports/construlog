import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requisicao_id, status_aprovacao, obra_id } = await req.json();

    // Validar se requisição foi aprovada
    if (status_aprovacao !== 'aprovada') {
      return Response.json({ 
        message: 'Requisição não aprovada - nenhum lançamento gerado',
        status: 'skipped'
      });
    }

    if (!requisicao_id || !obra_id) {
      return Response.json({ 
        error: 'requisicao_id e obra_id são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar requisição para obter dados
    const requisicao = await base44.entities.RequisicaoCompra.get(requisicao_id);
    
    if (!requisicao) {
      return Response.json({ 
        error: 'Requisição não encontrada' 
      }, { status: 404 });
    }

    // Verificar se já existe lançamento para esta requisição
    const contasExistentes = await base44.entities.ContaFinanceira.filter({
      referencia_tipo: 'requisicao',
      referencia_id: requisicao_id
    });

    if (contasExistentes.length > 0) {
      return Response.json({ 
        message: 'Conta a pagar já existe para esta requisição',
        status: 'already_exists',
        conta_id: contasExistentes[0].id
      });
    }

    // Criar conta a pagar
    const contaPagar = await base44.entities.ContaFinanceira.create({
      tipo: 'pagar',
      obra_id: obra_id,
      descricao: `Compra - ${requisicao.titulo || 'Solicitação'}`,
      valor: requisicao.valor_total_estimado || 0,
      data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
      status: 'pendente',
      categoria: 'material',
      referencia_tipo: 'requisicao',
      referencia_id: requisicao_id,
      observacao: `Gerado automaticamente de Requisição ${requisicao.id}`
    });

    // Log de auditoria
    await base44.entities.LogAuditoria.create({
      function_name: 'criarContaPagarDeRequisicao',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ requisicao_id, obra_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        conta_id: contaPagar.id,
        requisicao_id: requisicao_id,
        obra_id: obra_id,
        valor: requisicao.valor_total_estimado
      }
    });

    return Response.json({ 
      success: true,
      conta_id: contaPagar.id,
      message: 'Conta a pagar criada automaticamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar conta a pagar:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});