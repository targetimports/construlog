import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BUILD_ID = `SOLICIT-PAG-v2-${Date.now()}`;

async function logAuditoria(base44, userData, acao, modulo, entidade, entidade_id, detalhes) {
  try {
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: userData.email,
      acao,
      modulo,
      entidade,
      entidade_id,
      detalhes: JSON.stringify(detalhes),
      sucesso: true
    });
  } catch (err) {
    console.log('[AUDITORIA-ERRO]', err.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validar permissões
    const userRole = user.cargo || user.role || 'leitura';
    const hasPermission = ['diretor', 'financeiro', 'admin'].includes(userRole) || user.role === 'admin';
    
    if (!hasPermission) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { conta_id, motivo } = await req.json();

    if (!conta_id) {
      return Response.json({ error: 'Parâmetro faltando: conta_id' }, { status: 400 });
    }

    // 1. Ler ContaFinanceira
    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contas || contas.length === 0) {
      return Response.json({ error: 'Conta não encontrada', build_id: BUILD_ID }, { status: 404 });
    }

    const conta = contas[0];

    // Validar tipo
    if (conta.tipo !== 'pagar') {
      return Response.json({
        error: 'Esta função só processa contas a pagar',
        tipo_conta: conta.tipo
      }, { status: 400 });
    }

    // Validar status
    if (conta.status === 'pago') {
      return Response.json({
        error: 'Conta já foi paga',
        build_id: BUILD_ID
      }, { status: 400 });
    }

    // 2. Ler threshold
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'financeiro_threshold_n1'
    });
    const thresholdN1 = configs && configs.length > 0 ? parseFloat(configs[0].valor) : 5000;

    const valorConta = conta.valor || 0;

    // 3. Se valor <= threshold -> DIRECT
    if (valorConta <= thresholdN1) {
      await logAuditoria(base44, user, 'solicitar_aprovacao_direto', 'financeiro', 'ContaFinanceira', conta_id, {
        conta_id,
        valor: valorConta,
        threshold_n1: thresholdN1,
        branch: 'DIRECT_ALLOWED'
      });

      return Response.json({
        ok: true,
        build_id: BUILD_ID,
        branch: 'DIRECT_ALLOWED',
        conta_id,
        valor: valorConta,
        threshold_n1: thresholdN1,
        status_conta: conta.status
      });
    }

    // 4. Se valor > threshold -> criar Aprovacao pendente (idempotente)
    const aprovacoes = await base44.asServiceRole.entities.Aprovacao.filter({
      referencia_id: conta_id,
      modulo: 'financeiro',
      status: 'pendente'
    });

    let aprovacao_id;
    if (aprovacoes && aprovacoes.length > 0) {
      // Já existe, reutilizar
      aprovacao_id = aprovacoes[0].id;
    } else {
      // Criar nova
      const novaAprov = await base44.asServiceRole.entities.Aprovacao.create({
        modulo: 'financeiro',
        referencia_tipo: 'ContaFinanceira',
        referencia_id: conta_id,
        obra_id: conta.obra_id || null,
        valor: valorConta,
        nivel: 'N1',
        status: 'pendente',
        solicitado_por: user.email,
        solicitado_em: new Date().toISOString(),
        descricao: `Conta ${conta.descricao || ''} - R$ ${valorConta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
      });
      aprovacao_id = novaAprov.id;
    }

    // 5. Atualizar ContaFinanceira status = em_aprovacao
    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, {
      status: 'em_aprovacao'
    });

    // 6. Persistência: validar
    const contaCheck = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contaCheck || contaCheck.length === 0 || contaCheck[0].status !== 'em_aprovacao') {
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        stage: 'conta_check'
      }, { status: 500 });
    }

    const aprovacaoCheck = await base44.asServiceRole.entities.Aprovacao.filter({ id: aprovacao_id });
    if (!aprovacaoCheck || aprovacaoCheck.length === 0) {
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        stage: 'aprovacao_check'
      }, { status: 500 });
    }

    // 7. Auditoria
    await logAuditoria(base44, user, 'solicitar_aprovacao_alçada', 'financeiro', 'ContaFinanceira', conta_id, {
      conta_id,
      valor: valorConta,
      threshold_n1: thresholdN1,
      aprovacao_id,
      branch: 'REQUIRES_APPROVAL'
    });

    return Response.json({
      ok: true,
      build_id: BUILD_ID,
      branch: 'REQUIRES_APPROVAL',
      conta_id,
      valor: valorConta,
      threshold_n1: thresholdN1,
      status_conta: 'em_aprovacao',
      aprovacao_id
    });

  } catch (error) {
    console.error('[SOLICITARPAGAMENTO-ERRO]', error);
    return Response.json({ error: error.message, build_id: BUILD_ID }, { status: 500 });
  }
});