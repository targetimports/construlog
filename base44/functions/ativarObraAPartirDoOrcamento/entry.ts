import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_id } = await req.json();

    if (!orcamento_id) {
      return Response.json({ error: 'orcamento_id é obrigatório' }, { status: 400 });
    }

    // Buscar orçamento
    const orcamento = await base44.asServiceRole.entities.OrcamentoObra.read(orcamento_id);
    if (!orcamento) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    // Garantir que existe obra
    let obra_id = orcamento.obra_id;
    if (!obra_id) {
      // Chamar função de criação
      const responseCreate = await base44.asServiceRole.functions.invoke('criarObraBasicaDoOrcamento', {
        orcamento_id
      });
      obra_id = responseCreate.obra_id;
    }

    const obra = await base44.asServiceRole.entities.Obra.read(obra_id);

    // Calcular totais (assumindo que valor_total e valor_final já estão no orçamento)
    const total_orcamento = orcamento.valor_total || 0;
    const bdi_percent = orcamento.bdi_percent || 0;
    const total_final_orcamento = orcamento.valor_final || total_orcamento * (1 + bdi_percent / 100);

    // Atualizar Obra
    await base44.asServiceRole.entities.Obra.update(obra_id, {
      fase: 'ativa',
      status: 'em_andamento',
      total_orcamento,
      bdi_percent,
      total_final_orcamento,
      data_ativacao: new Date().toISOString().split('T')[0]
    });

    // Atualizar OrcamentoObra
    await base44.asServiceRole.entities.OrcamentoObra.update(orcamento_id, {
      convertido_em_obra: true,
      data_conversao: new Date().toISOString().split('T')[0]
    });

    // Atualizar contexto do usuário
    try {
      const contexto = await base44.asServiceRole.entities.ContextoUsuario.filter(
        { user_email: user.email }
      );
      if (contexto && contexto.length > 0) {
        await base44.asServiceRole.entities.ContextoUsuario.update(contexto[0].id, {
          obra_atual_id: obra_id
        });
      } else {
        await base44.asServiceRole.entities.ContextoUsuario.create({
          user_email: user.email,
          obra_atual_id: obra_id
        });
      }
    } catch (e) {
      console.log('Aviso: não conseguiu atualizar contexto:', e.message);
    }

    const obraAtualizada = await base44.asServiceRole.entities.Obra.read(obra_id);

    return Response.json({
      success: true,
      obra_id,
      obra: obraAtualizada,
      mensagem: 'Obra ativada com sucesso! Todos os módulos operacionais estão disponíveis.'
    });
  } catch (error) {
    console.error('Erro ao ativar obra:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});