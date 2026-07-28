import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.js';
import { logAuditoria } from './_lib/logAuditoria.js';

/**
 * Processar Aprovação (Aprovar/Rejeitar)
 * 
 * RBAC: verifica se user tem role aprovador para o nível
 * Atualiza status da entidade referenciada
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user } = await requireRole(base44, ['diretor', 'compras', 'financeiro']);

    const { aprovacao_id, acao, motivo = '' } = await req.json();

    if (!aprovacao_id || !acao) {
      return Response.json({ error: 'aprovacao_id e acao são obrigatórios' }, { status: 400 });
    }

    if (!['aprovar', 'rejeitar'].includes(acao)) {
      return Response.json({ error: 'acao deve ser "aprovar" ou "rejeitar"' }, { status: 400 });
    }

    // Buscar aprovação
    const aprovacoes = await base44.asServiceRole.entities.Aprovacao.filter({ id: aprovacao_id });
    if (!aprovacoes || aprovacoes.length === 0) {
      return Response.json({ error: 'Aprovação não encontrada' }, { status: 404 });
    }

    const aprovacao = aprovacoes[0];

    if (aprovacao.status !== 'pendente') {
      return Response.json({ 
        error: `Aprovação já foi ${aprovacao.status}` 
      }, { status: 422 });
    }

    // Buscar configurações de aprovadores
    const configAprovadores = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: `aprovadores_${aprovacao.nivel.toLowerCase()}_roles`
    });

    let rolesPermitidas = ['diretor']; // default
    if (configAprovadores && configAprovadores.length > 0) {
      try {
        rolesPermitidas = JSON.parse(configAprovadores[0].valor);
      } catch {
        rolesPermitidas = ['diretor'];
      }
    }

    // Verificar se user tem role permitida
    const userRole = user.cargo || 'user';
    if (!rolesPermitidas.includes(userRole) && userRole !== 'diretor') {
      return Response.json({ 
        error: `Sem permissão para aprovar nível ${aprovacao.nivel}. Roles permitidas: ${rolesPermitidas.join(', ')}` 
      }, { status: 403 });
    }

    // Atualizar aprovação
    const novoStatus = acao === 'aprovar' ? 'aprovado' : 'rejeitado';
    await base44.asServiceRole.entities.Aprovacao.update(aprovacao_id, {
      status: novoStatus,
      decidido_por: user.email,
      decidido_em: new Date().toISOString(),
      motivo: motivo || (acao === 'aprovar' ? 'Aprovado' : 'Rejeitado')
    });

    // Atualizar entidade referenciada
    if (aprovacao.referencia_tipo === 'OrdemCompra') {
      const statusOC = acao === 'aprovar' ? 'aprovada' : 'rejeitada';
      await base44.asServiceRole.entities.OrdemCompra.update(aprovacao.referencia_id, {
        status: statusOC
      });
    } else if (aprovacao.referencia_tipo === 'ContaFinanceira') {
      // Não muda status da conta, apenas registra aprovação
      // A conta só vira "pago" quando finalmente pagar
    }

    // Auditoria
    await logAuditoria(base44, {
      entidade_tipo: 'Aprovacao',
      entidade_id: aprovacao_id,
      acao: acao === 'aprovar' ? 'APROVAR' : 'REJEITAR',
      resumo: `${aprovacao.modulo} ${aprovacao.referencia_tipo} ${acao === 'aprovar' ? 'aprovado' : 'rejeitado'} - Nível ${aprovacao.nivel}`,
      dados_anteriores: { status: 'pendente' },
      dados_novos: { status: novoStatus, decidido_por: user.email, motivo },
      user_email: user.email,
      role: userRole,
      origem: 'ui',
      modulo: aprovacao.modulo
    });

    return Response.json({
      ok: true,
      status: novoStatus,
      message: `${aprovacao.referencia_tipo} ${acao === 'aprovar' ? 'aprovada' : 'rejeitada'} com sucesso`
    });

  } catch (error) {
    console.error('[ERROR] processarAprovacao:', error);
    return Response.json({
      error: error.message || 'Erro ao processar aprovação'
    }, { status: 500 });
  }
});