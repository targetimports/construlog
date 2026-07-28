import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('[criarSolicitacaoMaquina] Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { 
      obra_id, 
      tipo_maquina, 
      data_inicio, 
      data_fim, 
      horas_previstas, 
      custo_hora_previsto,
      justificativa_urgencia,
      observacoes 
    } = payload;

    console.log('[criarSolicitacaoMaquina] Payload:', payload);

    // Validações
    if (!obra_id || !tipo_maquina || !data_inicio || !data_fim) {
      console.error('[criarSolicitacaoMaquina] Missing required fields');
      return Response.json({ 
        error: 'Campos obrigatórios: obra_id, tipo_maquina, data_inicio, data_fim' 
      }, { status: 400 });
    }

    // Buscar obra
    const obra = await base44.asServiceRole.entities.Obra.get(obra_id);
    if (!obra) {
      console.error('[criarSolicitacaoMaquina] Obra not found:', obra_id);
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Calcular antecedência (comparando apenas datas, sem horas)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataInicio = new Date(data_inicio);
    dataInicio.setHours(0, 0, 0, 0);
    const diasAntecedencia = Math.floor((dataInicio - hoje) / (1000 * 60 * 60 * 24));
    const urgente = diasAntecedencia < 15;

    console.log('[criarSolicitacaoMaquina] Dias antecedência:', diasAntecedencia, 'urgente:', urgente);

    // Calcular custo total
    const horasNum = parseFloat(horas_previstas) || 0;
    const custoHoraNum = parseFloat(custo_hora_previsto) || 0;
    const custoTotal = horasNum * custoHoraNum;

    // Criar solicitação
    const solicitacao = await base44.asServiceRole.entities.SolicitacaoMaquina.create({
      obra_id,
      tipo_maquina,
      data_inicio,
      data_fim,
      horas_previstas: horasNum,
      custo_hora_previsto: custoHoraNum,
      urgente,
      justificativa_urgencia: justificativa_urgencia || null,
      observacoes: observacoes || null,
      status: 'enviada',
      antecedencia_min_dias: 15
    });

    console.log('[criarSolicitacaoMaquina] Created:', solicitacao.id);

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'criar',
      modulo: 'solicitacao_maquinas',
      entidade: 'SolicitacaoMaquina',
      entidade_id: solicitacao.id,
      dados_novos: solicitacao,
      detalhes: `Solicitação de ${tipo_maquina} para obra ${obra.nome} - ${urgente ? 'URGENTE' : 'Normal'}`,
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      solicitacao,
      calculado: {
        dias_antecedencia: diasAntecedencia,
        urgente,
        custo_total: custoTotal
      }
    });
  } catch (error) {
    console.error('[criarSolicitacaoMaquina] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});