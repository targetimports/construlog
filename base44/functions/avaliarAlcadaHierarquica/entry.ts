import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Motor de Decisão de Alçada Hierárquica
 * 
 * Avalia se uma operação requer aprovação, determina a cadeia de níveis
 * e cria o registro de Aprovacao com os aprovadores corretos.
 * 
 * Input: { tipo_operacao, referencia_tipo, referencia_id, valor, obra_id, obra_nome, descricao, empresa_id }
 * Output: { requer_aprovacao, aprovacao_id, niveis, ... }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      tipo_operacao, 
      referencia_tipo, 
      referencia_id, 
      valor, 
      obra_id, 
      obra_nome,
      descricao,
      empresa_id,
      modulo
    } = body;

    if (!tipo_operacao || !referencia_id || valor === undefined) {
      return Response.json({ 
        error: 'Campos obrigatórios: tipo_operacao, referencia_id, valor' 
      }, { status: 400 });
    }

    // Verificar se já existe aprovação pendente para esta referência
    const existentes = await base44.asServiceRole.entities.Aprovacao.filter({
      referencia_tipo: referencia_tipo || tipo_operacao,
      referencia_id,
      status: 'pendente'
    });

    if (existentes.length > 0) {
      return Response.json({
        requer_aprovacao: true,
        ja_existe: true,
        aprovacao_id: existentes[0].id,
        status: existentes[0].status,
        nivel_atual: existentes[0].nivel_atual,
        nivel_maximo: existentes[0].nivel_maximo
      });
    }

    // Buscar alçadas ativas para este tipo de operação
    const todasAlcadas = await base44.asServiceRole.entities.AlcadaAprovacao.filter({
      ativa: true
    });

    // Filtrar alçadas aplicáveis
    const alcadasAplicaveis = todasAlcadas.filter(a => {
      // Tipo de operação
      const tipoOk = a.tipo_operacao === 'todas' || a.tipo_operacao === tipo_operacao;
      if (!tipoOk) return false;

      // Empresa
      if (empresa_id && a.empresa_id && a.empresa_id !== empresa_id) return false;

      // Valor dentro da faixa
      const valorNum = Number(valor) || 0;
      const minOk = valorNum >= (a.valor_minimo || 0);
      const maxOk = !a.valor_maximo || a.valor_maximo === 0 || valorNum <= a.valor_maximo;
      if (!minOk || !maxOk) return false;

      // Obra específica
      if (obra_id && a.obras_ids && a.obras_ids.length > 0) {
        if (!a.obras_ids.includes(obra_id)) return false;
      }

      return true;
    });

    if (alcadasAplicaveis.length === 0) {
      return Response.json({
        requer_aprovacao: false,
        mensagem: 'Nenhuma alçada configurada para esta operação/valor — aprovação automática'
      });
    }

    // Ordenar por nível
    alcadasAplicaveis.sort((a, b) => (a.nivel || 1) - (b.nivel || 1));
    const nivelMaximo = Math.max(...alcadasAplicaveis.map(a => a.nivel || 1));
    const primeiraAlcada = alcadasAplicaveis[0];

    // Determinar aprovadores do primeiro nível
    let aprovadoresPendentes = [];
    if (primeiraAlcada.aprovadores_especificos && primeiraAlcada.aprovadores_especificos.length > 0) {
      aprovadoresPendentes = primeiraAlcada.aprovadores_especificos.map(a => a.user_email);
    } else if (primeiraAlcada.cargos_aprovadores && primeiraAlcada.cargos_aprovadores.length > 0) {
      // Buscar usuários com esses cargos
      const todosUsuarios = await base44.asServiceRole.entities.User.list();
      aprovadoresPendentes = todosUsuarios
        .filter(u => primeiraAlcada.cargos_aprovadores.includes(u.cargo || u.role))
        .map(u => u.email);
    }

    // Calcular prazo de expiração
    const prazoHoras = primeiraAlcada.prazo_horas || 48;
    const prazoExpira = new Date(Date.now() + prazoHoras * 60 * 60 * 1000).toISOString();

    // Determinar módulo
    const moduloFinal = modulo || (tipo_operacao === 'pagamento' ? 'financeiro' : 'compras');

    // Criar aprovação
    const aprovacao = await base44.asServiceRole.entities.Aprovacao.create({
      empresa_id: empresa_id || '',
      modulo: moduloFinal,
      referencia_tipo: referencia_tipo || tipo_operacao,
      referencia_id,
      obra_id: obra_id || '',
      obra_nome: obra_nome || '',
      valor: Number(valor),
      descricao: descricao || `${referencia_tipo || tipo_operacao} #${referencia_id}`,
      nivel_atual: 1,
      nivel_maximo: nivelMaximo,
      nivel: `N${primeiraAlcada.nivel || 1}`,
      status: 'pendente',
      solicitado_por: user.email,
      solicitado_nome: user.full_name || user.email,
      solicitado_em: new Date().toISOString(),
      aprovadores_pendentes: aprovadoresPendentes,
      alcada_id_atual: primeiraAlcada.id,
      prazo_expira_em: prazoExpira,
      historico_aprovacoes: [{
        nivel: 0,
        nivel_label: 'Solicitação',
        usuario_email: user.email,
        usuario_nome: user.full_name || user.email,
        acao: 'solicitado',
        comentario: descricao || '',
        data: new Date().toISOString()
      }]
    });

    // Criar notificações para aprovadores
    for (const emailAprov of aprovadoresPendentes) {
      try {
        await base44.asServiceRole.entities.Notificacao.create({
          destinatario_email: emailAprov,
          tipo: 'alerta',
          titulo: `Aprovação Pendente - ${primeiraAlcada.nome}`,
          mensagem: `Nova solicitação de ${moduloFinal} aguarda sua aprovação: ${descricao || referencia_tipo} - R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          lida: false,
          link_acao: '/Aprovacoes',
          referencia_tipo: 'Aprovacao',
          referencia_id: aprovacao.id
        });
      } catch (e) {
        console.log('[NOTIF-WARN]', e.message);
      }
    }

    // Log de auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoriaSistema.create({
        entidade: 'Aprovacao',
        entidade_id: aprovacao.id,
        operacao: 'criar',
        dados_depois: {
          tipo_operacao,
          referencia_id,
          valor,
          nivel_maximo: nivelMaximo,
          aprovadores: aprovadoresPendentes
        },
        usuario_id: user.email,
        obra_id: obra_id || '',
        data_hora: new Date().toISOString(),
        origem_funcao: 'avaliarAlcadaHierarquica'
      });
    } catch (e) {
      console.log('[AUDIT-WARN]', e.message);
    }

    return Response.json({
      requer_aprovacao: true,
      aprovacao_id: aprovacao.id,
      nivel_atual: 1,
      nivel_maximo: nivelMaximo,
      aprovadores_pendentes: aprovadoresPendentes,
      prazo_expira_em: prazoExpira,
      cadeia: alcadasAplicaveis.map(a => ({
        nivel: a.nivel,
        nome: a.nome,
        valor_min: a.valor_minimo,
        valor_max: a.valor_maximo,
        cargos: a.cargos_aprovadores || [],
        aprovadores: (a.aprovadores_especificos || []).map(ap => ap.nome)
      }))
    });

  } catch (error) {
    console.error('[ALCADA-HIER-ERRO]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});