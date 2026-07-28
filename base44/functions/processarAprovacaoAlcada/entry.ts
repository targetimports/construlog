import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { registrarAuditoria } from './_lib/auditoria.js';

/**
 * Processa aprovação ou rejeição de alçada
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { 
      aprovacao_id, 
      acao, // 'aprovar' ou 'rejeitar'
      observacao 
    } = await req.json();

    if (!aprovacao_id || !acao) {
      return Response.json({ 
        error: 'Campos obrigatórios: aprovacao_id, acao' 
      }, { status: 400 });
    }

    // Buscar aprovação
    const aprovacao = await base44.entities.AprovacaoPendente.get(aprovacao_id);
    if (!aprovacao) {
      return Response.json({ error: 'Aprovação não encontrada' }, { status: 404 });
    }

    if (aprovacao.status !== 'pendente') {
      return Response.json({ 
        error: `Aprovação já foi ${aprovacao.status}` 
      }, { status: 400 });
    }

    // Buscar alçada do nível atual
    const alcadas = await base44.entities.AlcadaAprovacao.filter({
      tipo_operacao: aprovacao.tipo_operacao,
      ordem_nivel: aprovacao.nivel_atual,
      ativo: true
    });

    if (alcadas.length === 0) {
      return Response.json({ 
        error: 'Alçada não encontrada para este nível' 
      }, { status: 404 });
    }

    // Verificar se usuário tem perfil para aprovar
    const alcada = alcadas[0];
    const perfilUsuario = user.cargo || user.role;
    
    if (perfilUsuario !== alcada.perfil_aprovador && user.role !== 'admin') {
      return Response.json({ 
        error: `Apenas ${alcada.perfil_aprovador} pode aprovar neste nível` 
      }, { status: 403 });
    }

    // Processar ação
    if (acao === 'rejeitar') {
      // Rejeitar
      const dadosAtualizados = {
        status: 'rejeitado',
        usuario_aprovou: user.email,
        data_aprovacao: new Date().toISOString(),
        motivo_rejeicao: observacao || 'Rejeitado',
        historico: [
          ...(aprovacao.historico || []),
          {
            nivel: aprovacao.nivel_atual,
            usuario: user.email,
            acao: 'rejeitado',
            data: new Date().toISOString(),
            observacao
          }
        ]
      };
      
      await base44.asServiceRole.entities.AprovacaoPendente.update(aprovacao_id, dadosAtualizados);

      // AUDITORIA: Aprovação rejeitada
      await registrarAuditoria(base44, {
        entidade: 'AprovacaoPendente',
        entidade_id: aprovacao_id,
        operacao: 'rejeitar',
        dados_antes: aprovacao,
        dados_depois: { ...aprovacao, ...dadosAtualizados },
        usuario_id: user.email,
        obra_id: aprovacao.obra_id,
        origem_funcao: 'processarAprovacaoAlcada'
      });

      return Response.json({
        success: true,
        mensagem: 'Aprovação rejeitada',
        status: 'rejeitado'
      });
    }

    // Aprovar
    const proximoNivel = aprovacao.nivel_atual + 1;
    const nivelCompleto = proximoNivel > aprovacao.nivel_requerido;

    const dadosAtualizados = {
      nivel_atual: proximoNivel,
      status: nivelCompleto ? 'aprovado' : 'pendente',
      usuario_aprovou: nivelCompleto ? user.email : null,
      data_aprovacao: nivelCompleto ? new Date().toISOString() : null,
      historico: [
        ...(aprovacao.historico || []),
        {
          nivel: aprovacao.nivel_atual,
          usuario: user.email,
          acao: 'aprovado',
          data: new Date().toISOString(),
          observacao
        }
      ]
    };

    await base44.asServiceRole.entities.AprovacaoPendente.update(aprovacao_id, dadosAtualizados);

    // AUDITORIA: Aprovação processada
    await registrarAuditoria(base44, {
      entidade: 'AprovacaoPendente',
      entidade_id: aprovacao_id,
      operacao: 'aprovar',
      dados_antes: aprovacao,
      dados_depois: { ...aprovacao, ...dadosAtualizados },
      usuario_id: user.email,
      obra_id: aprovacao.obra_id,
      origem_funcao: 'processarAprovacaoAlcada'
    });

    return Response.json({
      success: true,
      mensagem: nivelCompleto 
        ? 'Aprovação concluída - todos os níveis aprovados' 
        : `Aprovado nível ${aprovacao.nivel_atual} - aguardando nível ${proximoNivel}`,
      status: nivelCompleto ? 'aprovado' : 'pendente',
      nivel_atual: proximoNivel,
      nivel_requerido: aprovacao.nivel_requerido
    });

  } catch (error) {
    console.error('Erro ao processar aprovação:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});