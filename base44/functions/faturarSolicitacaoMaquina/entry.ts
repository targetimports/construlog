import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('[faturarSolicitacaoMaquina] Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { solicitacao_id, data_vencimento, fornecedor } = await req.json();

    console.log('[faturarSolicitacaoMaquina] Payload:', { solicitacao_id, data_vencimento, fornecedor });

    if (!solicitacao_id) {
      return Response.json({ error: 'solicitacao_id obrigatório' }, { status: 400 });
    }

    const solicitacao = await base44.asServiceRole.entities.SolicitacaoMaquina.get(solicitacao_id);
    if (!solicitacao) {
      console.error('[faturarSolicitacaoMaquina] Not found:', solicitacao_id);
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    if (solicitacao.status !== 'em_execucao') {
      console.error('[faturarSolicitacaoMaquina] Invalid status:', solicitacao.status);
      return Response.json({ 
        error: `Solicitação precisa estar em execução (status atual: ${solicitacao.status})` 
      }, { status: 400 });
    }

    // Calcular valor final (usar real se existir, senão previsto)
    const horas = solicitacao.horas_reais || solicitacao.horas_previstas;
    const custoHora = solicitacao.custo_hora_real || solicitacao.custo_hora_previsto;
    const valorTotal = horas * custoHora;

    // Buscar obra
    const obra = await base44.asServiceRole.entities.Obra.get(solicitacao.obra_id);

    // Criar conta a pagar
    const conta = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'pagar',
      descricao: `Aluguel de ${solicitacao.tipo_maquina} - ${horas}h`,
      valor: valorTotal,
      data_vencimento: data_vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendente',
      obra_id: solicitacao.obra_id,
      categoria: 'equipamento',
      fornecedor_cliente: fornecedor || 'Locadora de Equipamentos',
      referencia_tipo: 'SolicitacaoMaquina',
      referencia_id: solicitacao_id
    });

    console.log('[faturarSolicitacaoMaquina] Created conta:', conta.id);

    // Atualizar solicitação
    const atualizado = await base44.asServiceRole.entities.SolicitacaoMaquina.update(solicitacao_id, {
      status: 'concluida'
    });

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'faturar',
      modulo: 'solicitacao_maquinas',
      entidade: 'SolicitacaoMaquina',
      entidade_id: solicitacao_id,
      dados_anteriores: solicitacao,
      dados_novos: atualizado,
      detalhes: `Faturado: R$ ${valorTotal.toFixed(2)} - Conta a pagar criada: ${conta.id}`,
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      solicitacao: atualizado,
      conta,
      faturamento: {
        horas,
        custo_hora: custoHora,
        valor_total: valorTotal
      }
    });
  } catch (error) {
    console.error('[faturarSolicitacaoMaquina] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});