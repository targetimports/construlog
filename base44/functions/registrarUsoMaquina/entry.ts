import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('[registrarUsoMaquina] Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      solicitacao_id, 
      horas_reais, 
      custo_hora_real,
      data_uso,
      operador_id,
      observacoes 
    } = await req.json();

    console.log('[registrarUsoMaquina] Payload:', { solicitacao_id, horas_reais, custo_hora_real });

    if (!solicitacao_id || !horas_reais || !custo_hora_real) {
      return Response.json({ 
        error: 'Campos obrigatórios: solicitacao_id, horas_reais, custo_hora_real' 
      }, { status: 400 });
    }

    const solicitacao = await base44.asServiceRole.entities.SolicitacaoMaquina.get(solicitacao_id);
    if (!solicitacao) {
      console.error('[registrarUsoMaquina] Not found:', solicitacao_id);
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    if (solicitacao.status !== 'aprovada' && solicitacao.status !== 'alocada') {
      console.error('[registrarUsoMaquina] Invalid status:', solicitacao.status);
      return Response.json({ 
        error: `Solicitação precisa estar aprovada (status atual: ${solicitacao.status})` 
      }, { status: 400 });
    }

    // Calcular custo real
    const horasNum = parseFloat(horas_reais);
    const custoHoraNum = parseFloat(custo_hora_real);
    const custoTotalReal = horasNum * custoHoraNum;

    // Atualizar solicitação com dados reais
    const atualizado = await base44.asServiceRole.entities.SolicitacaoMaquina.update(solicitacao_id, {
      status: 'em_execucao',
      horas_reais: horasNum,
      custo_hora_real: custoHoraNum,
      custo_total_real: custoTotalReal,
      operador_id: operador_id || null,
      observacoes: observacoes || solicitacao.observacoes
    });

    console.log('[registrarUsoMaquina] Updated - Real cost:', custoTotalReal);

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'registrar_uso',
      modulo: 'solicitacao_maquinas',
      entidade: 'SolicitacaoMaquina',
      entidade_id: solicitacao_id,
      dados_anteriores: solicitacao,
      dados_novos: atualizado,
      detalhes: `Uso registrado: ${horasNum}h × R$ ${custoHoraNum}/h = R$ ${custoTotalReal.toFixed(2)}`,
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      solicitacao: atualizado,
      calculado: {
        custo_total_real: custoTotalReal,
        diferenca_previsto: custoTotalReal - (solicitacao.horas_previstas * solicitacao.custo_hora_previsto)
      }
    });
  } catch (error) {
    console.error('[registrarUsoMaquina] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});