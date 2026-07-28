import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BUILD_ID = `PROC-PAG-${Date.now()}`;

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

    const { aprovacao_id, acao, comentario } = await req.json();

    if (!aprovacao_id || !acao) {
      return Response.json({ error: 'Parâmetros faltando: aprovacao_id, acao' }, { status: 400 });
    }

    if (!['aprovar', 'reprovar'].includes(acao)) {
      return Response.json({ error: 'Ação inválida. Use: aprovar ou reprovar' }, { status: 400 });
    }

    // 1. Ler Aprovacao
    const aprovacoes = await base44.asServiceRole.entities.Aprovacao.filter({ id: aprovacao_id });
    if (!aprovacoes || aprovacoes.length === 0) {
      return Response.json({ error: 'Aprovacao não encontrada' }, { status: 404 });
    }

    const aprovacao = aprovacoes[0];

    // Validar módulo
    if (aprovacao.modulo !== 'financeiro') {
      return Response.json({
        error: 'Esta função só processa aprovações de financeiro',
        modulo: aprovacao.modulo
      }, { status: 400 });
    }

    // Validar status
    if (aprovacao.status !== 'pendente') {
      return Response.json({
        error: `Aprovacao já foi ${aprovacao.status}. Não pode ser alterada.`,
        status_atual: aprovacao.status
      }, { status: 400 });
    }

    // Reprovar requer comentário
    if (acao === 'reprovar' && !comentario) {
      return Response.json({
        error: 'Comentário obrigatório para reprovação',
        acao: 'reprovar'
      }, { status: 400 });
    }

    // 2. Atualizar Aprovacao
    const agora = new Date().toISOString();
    let novoStatusAprovacao, camposAtualizacao;

    if (acao === 'aprovar') {
      novoStatusAprovacao = 'aprovada';
      camposAtualizacao = {
        status: 'aprovada',
        decidido_por: user.email,
        decidido_em: agora,
        motivo: comentario || null
      };
    } else {
      novoStatusAprovacao = 'reprovada';
      camposAtualizacao = {
        status: 'reprovada',
        decidido_por: user.email,
        decidido_em: agora,
        motivo: comentario
      };
    }

    await base44.asServiceRole.entities.Aprovacao.update(aprovacao_id, camposAtualizacao);

    // 3. Atualizar ContaFinanceira
    const conta_id = aprovacao.referencia_id;
    let statusConta;

    if (novoStatusAprovacao === 'aprovada') {
      statusConta = 'pendente'; // Libera para pagar
    } else {
      statusConta = 'reprovada'; // Trava
    }

    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, {
      status: statusConta
    });

    // 4. Persistência: validar
    const aprovacaoCheck = await base44.asServiceRole.entities.Aprovacao.filter({ id: aprovacao_id });
    if (!aprovacaoCheck || aprovacaoCheck.length === 0 || aprovacaoCheck[0].status !== novoStatusAprovacao) {
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        stage: 'aprovacao_check'
      }, { status: 500 });
    }

    const contaCheck = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contaCheck || contaCheck.length === 0 || contaCheck[0].status !== statusConta) {
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        stage: 'conta_check'
      }, { status: 500 });
    }

    // 5. Auditoria
    await logAuditoria(base44, user, `${acao}_pagamento`, 'financeiro', 'Aprovacao', aprovacao_id, {
      acao,
      aprovacao_id,
      conta_id,
      status_novo: novoStatusAprovacao,
      comentario,
      decidido_por: user.email
    });

    return Response.json({
      ok: true,
      build_id: BUILD_ID,
      aprovacao_id,
      status_aprovacao: novoStatusAprovacao,
      conta_id,
      status_conta: statusConta,
      timestamp: agora
    });

  } catch (error) {
    console.error('[PROCESSARPAGAMENTO-ERRO]', error);
    return Response.json({ error: error.message, build_id: BUILD_ID }, { status: 500 });
  }
});