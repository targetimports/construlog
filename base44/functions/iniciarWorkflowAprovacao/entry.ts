import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { entidade_tipo, entidade_id, requisicao_data } = payload;

    // Buscar workflows ativos
    const workflows = await base44.asServiceRole.entities.WorkflowAprovacao.filter({
      ativa: true,
      tipo_entidade: entidade_tipo
    });

    if (!workflows || workflows.length === 0) {
      return Response.json({ 
        success: false, 
        message: 'Nenhum workflow encontrado para esta entidade' 
      });
    }

    // Selecionar workflow baseado em critérios
    const workflowSelecionado = workflows.find(w => {
      const crit = w.criterios || {};
      
      // Validar valor
      if (crit.valor_minimo && requisicao_data.valor_total_estimado < crit.valor_minimo) {
        return false;
      }
      if (crit.valor_maximo && requisicao_data.valor_total_estimado > crit.valor_maximo) {
        return false;
      }

      // Validar tipos de material (se especificados)
      if (crit.tipos_material && crit.tipos_material.length > 0) {
        const temTipoValido = requisicao_data.itens?.some(item => 
          crit.tipos_material.includes(item.tipo_material)
        );
        if (!temTipoValido) return false;
      }

      // Validar obra
      if (crit.obras_ids && crit.obras_ids.length > 0) {
        if (!crit.obras_ids.includes(requisicao_data.obra_id)) {
          return false;
        }
      }

      // Validar prioridade
      if (crit.prioridades && crit.prioridades.length > 0) {
        if (!crit.prioridades.includes(requisicao_data.prioridade)) {
          return false;
        }
      }

      return true;
    });

    if (!workflowSelecionado) {
      return Response.json({ 
        success: false, 
        message: 'Nenhum workflow correspondente aos critérios' 
      });
    }

    // Criar aprovações pendentes para cada etapa
    const aprovacoesCriadas = [];
    
    for (const etapa of workflowSelecionado.etapas || []) {
      // Buscar alçada
      const alcada = await base44.asServiceRole.entities.AlcadaAprovacao.filter({
        id: etapa.alcada_id
      }).then(r => r[0]);

      if (!alcada) continue;

      // Preparar aprovadores
      const aprovadores = [];
      if (alcada.aprovadores && alcada.aprovadores.length > 0) {
        aprovadores.push(...alcada.aprovadores.map(a => ({
          user_email: a.user_email,
          nome: a.nome,
          aprovado: false
        })));
      }

      if (aprovadores.length > 0) {
        const aprovacao = await base44.asServiceRole.entities.AprovacaoPendente.create({
          entidade_tipo,
          entidade_id,
          workflow_id: workflowSelecionado.id,
          etapa_numero: etapa.numero,
          alcada_id: etapa.alcada_id,
          alcada_nome: alcada.nome,
          aprovadores_pendentes: aprovadores,
          status: 'pendente',
          requer_todos_aprovadores: etapa.requer_todos || alcada.requer_todos_aprovadores,
          data_criacao: new Date().toISOString()
        });

        aprovacoesCriadas.push(aprovacao);

        // Enviar notificações aos aprovadores
        for (const aprovador of aprovadores) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: aprovador.user_email,
              subject: `Nova Requisição Aguardando Aprovação: ${requisicao_data.titulo}`,
              body: `
Olá ${aprovador.nome},

Uma nova requisição de compra foi submetida e requer sua aprovação:

Título: ${requisicao_data.titulo}
Valor: R$ ${requisicao_data.valor_total_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Prioridade: ${requisicao_data.prioridade}
Etapa: ${alcada.nome}

Acesse o sistema para revisar e aprovar.

---
Construlog Construlog
              `
            });
          } catch (emailError) {
            console.error('Erro ao enviar notificação:', emailError);
          }
        }
      }
    }

    // Atualizar status da requisição
    await base44.asServiceRole.entities.RequisicaoCompra.update(entidade_id, {
      status_aprovacao: 'em_analise'
    });

    return Response.json({ 
      success: true, 
      workflow_id: workflowSelecionado.id,
      aprovacoes_criadas: aprovacoesCriadas.length
    });
  } catch (error) {
    console.error('Erro ao iniciar workflow:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});