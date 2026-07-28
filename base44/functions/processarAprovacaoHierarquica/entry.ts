import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Processar Aprovação Hierárquica
 * 
 * Processa aprovação no nível atual, e se necessário escala para o próximo nível.
 * Atualiza entidade referenciada quando aprovação completa.
 * Gera notificações e logs de auditoria.
 * 
 * Input: { aprovacao_id, acao ('aprovar'|'reprovar'), comentario }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { aprovacao_id, acao, comentario } = await req.json();

    if (!aprovacao_id || !acao) {
      return Response.json({ error: 'aprovacao_id e acao são obrigatórios' }, { status: 400 });
    }

    if (!['aprovar', 'reprovar'].includes(acao)) {
      return Response.json({ error: 'Ação inválida. Use: aprovar ou reprovar' }, { status: 400 });
    }

    if (acao === 'reprovar' && !comentario) {
      return Response.json({ error: 'Comentário obrigatório para reprovação' }, { status: 400 });
    }

    // 1. Ler aprovação
    const aprovacoes = await base44.asServiceRole.entities.Aprovacao.filter({ id: aprovacao_id });
    if (!aprovacoes || aprovacoes.length === 0) {
      return Response.json({ error: 'Aprovação não encontrada' }, { status: 404 });
    }

    const aprovacao = aprovacoes[0];

    if (aprovacao.status !== 'pendente' && aprovacao.status !== 'escalado') {
      return Response.json({ 
        error: `Aprovação já foi ${aprovacao.status}` 
      }, { status: 422 });
    }

    // 2. Verificar se o usuário está autorizado a aprovar no nível atual
    const userEmail = user.email;
    const userCargo = user.cargo || user.role || '';
    
    // Buscar alçada atual
    let alcadaAtual = null;
    if (aprovacao.alcada_id_atual) {
      const alcadas = await base44.asServiceRole.entities.AlcadaAprovacao.filter({ id: aprovacao.alcada_id_atual });
      if (alcadas.length > 0) alcadaAtual = alcadas[0];
    }

    // Verificar permissão
    let autorizado = false;
    
    // Admin sempre pode
    if (user.role === 'admin') autorizado = true;

    // Está na lista de aprovadores pendentes?
    if (!autorizado && aprovacao.aprovadores_pendentes && aprovacao.aprovadores_pendentes.includes(userEmail)) {
      autorizado = true;
    }

    // Tem cargo aprovador?
    if (!autorizado && alcadaAtual && alcadaAtual.cargos_aprovadores) {
      if (alcadaAtual.cargos_aprovadores.includes(userCargo)) {
        autorizado = true;
      }
    }

    // Fallback: diretor/financeiro sempre podem
    if (!autorizado && ['diretor', 'admin'].includes(userCargo)) {
      autorizado = true;
    }

    if (!autorizado) {
      return Response.json({ 
        error: `Você não tem permissão para aprovar neste nível (N${aprovacao.nivel_atual}). Cargos aceitos: ${alcadaAtual?.cargos_aprovadores?.join(', ') || 'diretor, admin'}` 
      }, { status: 403 });
    }

    const agora = new Date().toISOString();
    const historicoAtual = aprovacao.historico_aprovacoes || [];

    // 3. Processar ação
    if (acao === 'reprovar') {
      // Rejeição: encerra todo o fluxo
      historicoAtual.push({
        nivel: aprovacao.nivel_atual,
        nivel_label: `N${aprovacao.nivel_atual}`,
        usuario_email: userEmail,
        usuario_nome: user.full_name || userEmail,
        acao: 'rejeitado',
        comentario: comentario || '',
        data: agora
      });

      await base44.asServiceRole.entities.Aprovacao.update(aprovacao_id, {
        status: 'rejeitado',
        decidido_por: userEmail,
        decidido_em: agora,
        motivo: comentario,
        historico_aprovacoes: historicoAtual
      });

      // Atualizar entidade referenciada
      await atualizarEntidadeReferenciada(base44, aprovacao, 'rejeitado', userEmail);

      // Notificar solicitante
      await criarNotificacao(base44, aprovacao.solicitado_por, 
        'alerta',
        `Solicitação Rejeitada - N${aprovacao.nivel_atual}`,
        `Sua solicitação "${aprovacao.descricao}" foi rejeitada por ${user.full_name || userEmail}. Motivo: ${comentario}`,
        aprovacao_id
      );

      // Auditoria
      await registrarAuditoria(base44, user, aprovacao, 'rejeitar', comentario);

      return Response.json({
        ok: true,
        status: 'rejeitado',
        nivel: aprovacao.nivel_atual,
        mensagem: 'Solicitação rejeitada com sucesso'
      });
    }

    // APROVAÇÃO
    historicoAtual.push({
      nivel: aprovacao.nivel_atual,
      nivel_label: `N${aprovacao.nivel_atual}`,
      usuario_email: userEmail,
      usuario_nome: user.full_name || userEmail,
      acao: 'aprovado',
      comentario: comentario || '',
      data: agora
    });

    // Verificar se precisa escalar para próximo nível
    if (aprovacao.nivel_atual < aprovacao.nivel_maximo) {
      // Escalar para próximo nível
      const proximoNivel = aprovacao.nivel_atual + 1;

      // Buscar alçada do próximo nível
      const todasAlcadas = await base44.asServiceRole.entities.AlcadaAprovacao.filter({ ativa: true });
      const tipoOp = aprovacao.referencia_tipo === 'SolicitacaoCompra' ? 'solicitacao_compra' 
        : aprovacao.referencia_tipo === 'OrdemCompra' ? 'ordem_compra' 
        : 'pagamento';
      
      const proximaAlcada = todasAlcadas.find(a => 
        a.nivel === proximoNivel && 
        (a.tipo_operacao === 'todas' || a.tipo_operacao === tipoOp) &&
        Number(aprovacao.valor) >= (a.valor_minimo || 0) &&
        (!a.valor_maximo || a.valor_maximo === 0 || Number(aprovacao.valor) <= a.valor_maximo)
      );

      let novosAprovadores = [];
      if (proximaAlcada) {
        if (proximaAlcada.aprovadores_especificos && proximaAlcada.aprovadores_especificos.length > 0) {
          novosAprovadores = proximaAlcada.aprovadores_especificos.map(a => a.user_email);
        } else if (proximaAlcada.cargos_aprovadores && proximaAlcada.cargos_aprovadores.length > 0) {
          const todosUsuarios = await base44.asServiceRole.entities.User.list();
          novosAprovadores = todosUsuarios
            .filter(u => proximaAlcada.cargos_aprovadores.includes(u.cargo || u.role))
            .map(u => u.email);
        }
      }

      const prazoHoras = proximaAlcada?.prazo_horas || 48;
      const prazoExpira = new Date(Date.now() + prazoHoras * 60 * 60 * 1000).toISOString();

      await base44.asServiceRole.entities.Aprovacao.update(aprovacao_id, {
        nivel_atual: proximoNivel,
        nivel: `N${proximoNivel}`,
        status: 'pendente',
        aprovadores_pendentes: novosAprovadores,
        alcada_id_atual: proximaAlcada?.id || '',
        prazo_expira_em: prazoExpira,
        historico_aprovacoes: historicoAtual
      });

      // Notificar aprovadores do próximo nível
      for (const emailAprov of novosAprovadores) {
        await criarNotificacao(base44, emailAprov,
          'alerta',
          `Aprovação Escalada - N${proximoNivel}`,
          `Solicitação "${aprovacao.descricao}" aprovada no N${aprovacao.nivel_atual} e escalada para seu nível. Valor: R$ ${Number(aprovacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          aprovacao_id
        );
      }

      // Notificar solicitante do escalonamento
      await criarNotificacao(base44, aprovacao.solicitado_por,
        'info',
        `Aprovação Parcial - N${aprovacao.nivel_atual} OK`,
        `Sua solicitação "${aprovacao.descricao}" foi aprovada no nível ${aprovacao.nivel_atual} e encaminhada para o nível ${proximoNivel}.`,
        aprovacao_id
      );

      await registrarAuditoria(base44, user, aprovacao, 'aprovar_escalar', comentario);

      return Response.json({
        ok: true,
        status: 'escalado',
        nivel_anterior: aprovacao.nivel_atual,
        nivel_novo: proximoNivel,
        aprovadores_proximos: novosAprovadores,
        mensagem: `Aprovado no N${aprovacao.nivel_atual}, escalado para N${proximoNivel}`
      });
    }

    // Aprovação FINAL (último nível)
    await base44.asServiceRole.entities.Aprovacao.update(aprovacao_id, {
      status: 'aprovado',
      decidido_por: userEmail,
      decidido_em: agora,
      motivo: comentario || 'Aprovado',
      historico_aprovacoes: historicoAtual
    });

    // Atualizar entidade referenciada
    await atualizarEntidadeReferenciada(base44, aprovacao, 'aprovado', userEmail);

    // Notificar solicitante
    await criarNotificacao(base44, aprovacao.solicitado_por,
      'sucesso',
      'Solicitação Aprovada ✅',
      `Sua solicitação "${aprovacao.descricao}" foi aprovada em todos os níveis por ${user.full_name || userEmail}.`,
      aprovacao_id
    );

    await registrarAuditoria(base44, user, aprovacao, 'aprovar_final', comentario);

    return Response.json({
      ok: true,
      status: 'aprovado',
      nivel_final: aprovacao.nivel_atual,
      mensagem: 'Aprovação completa em todos os níveis'
    });

  } catch (error) {
    console.error('[PROC-APROV-HIER-ERRO]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helpers

async function atualizarEntidadeReferenciada(base44, aprovacao, resultado, userEmail) {
  try {
    const ref = aprovacao.referencia_tipo;
    const refId = aprovacao.referencia_id;
    const dataAprov = new Date().toISOString().split('T')[0];

    if (ref === 'OrdemCompra') {
      await base44.asServiceRole.entities.OrdemCompra.update(refId, {
        status: resultado === 'aprovado' ? 'aprovada' : 'reprovada',
        aprovado_por: userEmail,
        data_aprovacao: dataAprov
      });
    } else if (ref === 'SolicitacaoCompra') {
      await base44.asServiceRole.entities.SolicitacaoCompra.update(refId, {
        status: resultado === 'aprovado' ? 'aprovada' : 'reprovada'
      });
    } else if (ref === 'BoletoPagar') {
      if (resultado === 'aprovado') {
        await base44.asServiceRole.entities.BoletoPagar.update(refId, {
          status: 'ABERTO'
        });
      } else {
        await base44.asServiceRole.entities.BoletoPagar.update(refId, {
          status: 'CANCELADO'
        });
      }
    } else if (ref === 'ContaFinanceira') {
      await base44.asServiceRole.entities.ContaFinanceira.update(refId, {
        status: resultado === 'aprovado' ? 'pendente' : 'reprovada'
      });
    }
  } catch (e) {
    console.error('[UPDATE-REF-ERRO]', e.message);
  }
}

async function criarNotificacao(base44, email, tipo, titulo, mensagem, aprovacaoId) {
  try {
    await base44.asServiceRole.entities.Notificacao.create({
      destinatario_email: email,
      tipo,
      titulo,
      mensagem,
      lida: false,
      link_acao: '/Aprovacoes',
      referencia_tipo: 'Aprovacao',
      referencia_id: aprovacaoId
    });
  } catch (e) {
    console.log('[NOTIF-WARN]', e.message);
  }
}

async function registrarAuditoria(base44, user, aprovacao, acao, comentario) {
  try {
    await base44.asServiceRole.entities.LogAuditoriaSistema.create({
      entidade: 'Aprovacao',
      entidade_id: aprovacao.id || '',
      operacao: acao.startsWith('aprovar') ? 'aprovar' : 'rejeitar',
      dados_antes: { status: aprovacao.status, nivel: aprovacao.nivel_atual },
      dados_depois: { acao, comentario, nivel: aprovacao.nivel_atual },
      usuario_id: user.email,
      obra_id: aprovacao.obra_id || '',
      data_hora: new Date().toISOString(),
      origem_funcao: 'processarAprovacaoHierarquica',
      campos_alterados: ['status', 'nivel_atual', 'historico_aprovacoes']
    });
  } catch (e) {
    console.log('[AUDIT-WARN]', e.message);
  }
}