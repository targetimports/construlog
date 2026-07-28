import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Motor de decisão de alçadas
 * Avalia se operação precisa aprovação e cria registro pendente
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { 
      tipo_operacao, 
      referencia_id, 
      valor, 
      obra_id 
    } = await req.json();

    if (!tipo_operacao || !referencia_id || !valor) {
      return Response.json({ 
        error: 'Campos obrigatórios: tipo_operacao, referencia_id, valor' 
      }, { status: 400 });
    }

    // Buscar alçadas ativas para este tipo de operação
    const alcadas = await base44.entities.AlcadaAprovacao.filter({
      tipo_operacao,
      ativo: true
    });

    if (alcadas.length === 0) {
      // Sem alçadas configuradas = aprovação automática
      return Response.json({
        requer_aprovacao: false,
        mensagem: 'Nenhuma alçada configurada - aprovação automática'
      });
    }

    // Filtrar alçadas aplicáveis ao valor
    const alcadasAplicaveis = alcadas.filter(a => {
      const dentroMin = valor >= (a.valor_min || 0);
      const dentroMax = !a.valor_max || valor <= a.valor_max;
      return dentroMin && dentroMax;
    });

    if (alcadasAplicaveis.length === 0) {
      // Valor abaixo de todas as alçadas = aprovação automática
      return Response.json({
        requer_aprovacao: false,
        mensagem: 'Valor abaixo dos limites de alçada - aprovação automática'
      });
    }

    // Ordenar por nível
    alcadasAplicaveis.sort((a, b) => a.ordem_nivel - b.ordem_nivel);
    const nivelMaximo = Math.max(...alcadasAplicaveis.map(a => a.ordem_nivel));

    // Verificar se já existe aprovação pendente
    const aprovacaoExistente = await base44.entities.AprovacaoPendente.filter({
      tipo_operacao,
      referencia_id
    });

    if (aprovacaoExistente.length > 0) {
      const existente = aprovacaoExistente[0];
      return Response.json({
        requer_aprovacao: true,
        ja_existe: true,
        aprovacao_id: existente.id,
        status: existente.status,
        nivel_atual: existente.nivel_atual,
        nivel_requerido: existente.nivel_requerido
      });
    }

    // Criar aprovação pendente
    const aprovacao = await base44.asServiceRole.entities.AprovacaoPendente.create({
      tipo_operacao,
      referencia_id,
      valor,
      obra_id,
      nivel_atual: 1,
      nivel_requerido: nivelMaximo,
      status: 'pendente',
      usuario_solicitante: user.email,
      data_solicitacao: new Date().toISOString(),
      historico: [{
        nivel: 0,
        usuario: user.email,
        acao: 'solicitado',
        data: new Date().toISOString(),
        observacao: 'Aprovação criada automaticamente'
      }]
    });

    return Response.json({
      requer_aprovacao: true,
      aprovacao_id: aprovacao.id,
      nivel_requerido: nivelMaximo,
      alcadas_aplicaveis: alcadasAplicaveis.map(a => ({
        nivel: a.ordem_nivel,
        perfil: a.perfil_aprovador,
        valor_min: a.valor_min,
        valor_max: a.valor_max
      }))
    });

  } catch (error) {
    console.error('Erro ao avaliar alçada:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});