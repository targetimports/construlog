import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { acao, depositoId, materialId, quantidade, tipoMovimento, etapaId, observacoes } = await req.json();

    // 1. Validar ação
    if (!['entrada', 'saida', 'transferencia', 'inventario'].includes(acao)) {
      return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }

    // 2. Buscar material
    const materiais = await base44.entities.Material?.filter?.({ id: materialId });
    const material = materiais?.[0];

    if (!material) {
      return Response.json({ error: 'Material não encontrado' }, { status: 404 });
    }

    // 3. Buscar saldo atual
    const movimentacoes = await base44.entities.MovimentacaoEstoque?.filter?.({
      material_id: materialId,
      deposito_id: depositoId
    }) || [];

    const saldoAtual = movimentacoes.reduce((acc, m) => {
      if (m.tipo === 'entrada' || m.tipo === 'inventario') return acc + m.quantidade;
      if (m.tipo === 'saida') return acc - m.quantidade;
      return acc;
    }, 0);

    // 4. Validações
    if (acao === 'saida' && quantidade > saldoAtual) {
      return Response.json({ 
        erro: 'Estoque insuficiente',
        saldo_atual: saldoAtual,
        solicitado: quantidade,
        faltando: quantidade - saldoAtual
      }, { status: 400 });
    }

    // 5. Criar movimentação
    const movimentacao = {
      material_id: materialId,
      deposito_id: depositoId,
      tipo: acao,
      quantidade: acao === 'saida' ? -quantidade : quantidade,
      saldo_anterior: saldoAtual,
      saldo_novo: saldoAtual + (acao === 'saida' ? -quantidade : quantidade),
      etapa_id: etapaId,
      usuario: user.email,
      data_movimento: new Date().toISOString(),
      observacoes
    };

    const resultado = await base44.entities.MovimentacaoEstoque?.create?.(movimentacao);

    // 6. Atualizar material
    await base44.entities.Material?.update?.(materialId, {
      estoque_atual: movimentacao.saldo_novo
    });

    // 7. Verificar alerta de reposição
    const alertaReposicao = material.estoque_atual <= material.estoque_minimo;

    return Response.json({
      sucesso: true,
      movimentacao: resultado,
      saldo_novo: movimentacao.saldo_novo,
      alerta_reposicao: alertaReposicao,
      mensagem: alertaReposicao ? 'Atenção: Estoque abaixo do mínimo!' : 'Movimentação realizada com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});