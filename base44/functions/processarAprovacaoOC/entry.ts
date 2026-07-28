import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BUILD_ID = `PROC-APROV-${Date.now()}`;

// Utility: log auditoria inline (sem libs externas)
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
    const isDirector = userRole === 'diretor' || user.role === 'admin';
    const hasPermission = isDirector || ['diretor', 'compras', 'financeiro', 'admin'].includes(userRole);
    
    if (!hasPermission) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Parse input
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
      novoStatusAprovacao = 'aprovado';
      camposAtualizacao = {
        status: 'aprovado',
        decidido_por: user.email,
        decidido_em: agora,
        motivo: comentario || null
      };
    } else {
      novoStatusAprovacao = 'rejeitado';
      camposAtualizacao = {
        status: 'rejeitado',
        decidido_por: user.email,
        decidido_em: agora,
        motivo: comentario
      };
    }

    // Update Aprovacao
    await base44.asServiceRole.entities.Aprovacao.update(aprovacao_id, camposAtualizacao);

    // 3. Atualizar OrdemCompra
    const oc_id = aprovacao.referencia_id;
    let statusOC;

    if (novoStatusAprovacao === 'aprovado') {
      statusOC = 'aprovada';
    } else {
      statusOC = 'reprovada';
    }

    // Update OC
    const ocUpdate = {
      status: statusOC,
      aprovado_por: user.email,
      data_aprovacao: new Date().toISOString().split('T')[0]
    };

    await base44.asServiceRole.entities.OrdemCompra.update(oc_id, ocUpdate);

    // 4. Persistência: validar com releitura
    const aprovacaoCheck = await base44.asServiceRole.entities.Aprovacao.filter({ id: aprovacao_id });
    if (!aprovacaoCheck || aprovacaoCheck.length === 0 || aprovacaoCheck[0].status !== novoStatusAprovacao) {
      console.error('[PERSISTENCE-FAIL] Aprovacao status não foi persistida');
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        aprovacao_id,
        stage: 'aprovacao_check'
      }, { status: 500 });
    }

    const ocCheck = await base44.asServiceRole.entities.OrdemCompra.filter({ id: oc_id });
    if (!ocCheck || ocCheck.length === 0 || ocCheck[0].status !== statusOC) {
      console.error('[PERSISTENCE-FAIL] OC status não foi persistida');
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        oc_id,
        stage: 'oc_check'
      }, { status: 500 });
    }

    // 5. Auditoria
    await logAuditoria(base44, user, `${acao}_aprovacao`, 'compras', 'Aprovacao', aprovacao_id, {
      acao,
      aprovacao_id,
      oc_id,
      status_novo: novoStatusAprovacao,
      comentario,
      decidido_por: user.email
    });

    return Response.json({
      ok: true,
      build_id: BUILD_ID,
      aprovacao_id,
      status_aprovacao: novoStatusAprovacao,
      oc_id,
      status_oc: statusOC,
      timestamp: agora
    });

  } catch (error) {
    console.error('[PROCESSARAPROVACAO-ERRO]', error);
    return Response.json({ error: error.message, build_id: BUILD_ID }, { status: 500 });
  }
});