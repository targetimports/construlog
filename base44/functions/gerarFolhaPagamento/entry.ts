import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * gerarFolhaPagamento - Gera folha de pagamento mensal automaticamente
 * 
 * 1) Busca todos os colaboradores ativos
 * 2) Calcula custo total mensal de cada um (salário + bônus + FGTS + benefícios + extras)
 * 3) Cria FolhaPagamento + itens
 * 4) Cria lançamento em ContaFinanceira (Gastos > Mão de Obra)
 * 5) Previne duplicação com referencia_unica
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Apenas RH e Admin
    if (!['admin', 'rh'].includes(user.role)) {
      return Response.json({ error: 'Apenas RH pode gerar folha' }, { status: 403 });
    }

    const { competencia, empresa_id } = req.body || {};

    // Validar competência (YYYY-MM)
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      return Response.json(
        { error: 'Competência inválida (use YYYY-MM)' },
        { status: 400 }
      );
    }

    console.log(`[FOLHA] Gerando folha para ${competencia}`);

    // 1) Buscar colaboradores ativos
    const colaboradores = await base44.entities.Colaborador.filter(
      { status: 'ativo' },
      '-created_date',
      500
    );

    if (!colaboradores || colaboradores.length === 0) {
      return Response.json(
        { error: 'Nenhum colaborador ativo encontrado' },
        { status: 400 }
      );
    }

    // 2) Verificar se folha já existe
    const folhaExistente = await base44.entities.FolhaPagamento.filter(
      { competencia, status: { $ne: 'cancelada' } },
      '-created_date',
      1
    );

    if (folhaExistente && folhaExistente.length > 0) {
      return Response.json(
        { error: 'Folha já existe para esta competência', folha_id: folhaExistente[0].id },
        { status: 409 }
      );
    }

    // 3) Calcular totais e criar itens
    let totalFolha = 0;
    const itens = [];

    for (const colab of colaboradores) {
      // Buscar benefícios e custos extras
      const beneficios = await base44.entities.ColaboradorBeneficio.filter(
        { colaborador_id: colab.id, ativo: true },
        '-created_date',
        100
      ) || [];

      const custosExtras = await base44.entities.ColaboradorCustoExtra.filter(
        { colaborador_id: colab.id, ativo: true },
        '-created_date',
        100
      ) || [];

      // Calcular FGTS
      const salario = colab.remuneracao?.salario_base || 0;
      const bonificacao = colab.remuneracao?.bonificacao_valor || 0;
      
      let fgts = 0;
      if (colab.remuneracao?.fgts_tipo === 'percentual') {
        fgts = salario * ((colab.remuneracao?.fgts_percentual || 8) / 100);
      } else if (colab.remuneracao?.fgts_tipo === 'valor_fixo') {
        fgts = colab.remuneracao?.fgts_valor_fixo || 0;
      }

      const totalBeneficios = beneficios.reduce((sum, b) => sum + (b.valor_mensal || 0), 0);
      const totalExtras = custosExtras.reduce((sum, c) => sum + (c.valor_mensal || 0), 0);

      const totalItem = salario + bonificacao + fgts + totalBeneficios + totalExtras;
      totalFolha += totalItem;

      const referencia_unica = `${competencia}:${colab.id}`;

      itens.push({
        colaborador_id: colab.id,
        salario_base: salario,
        bonificacao: bonificacao,
        fgts: fgts,
        beneficios: totalBeneficios,
        extras: totalExtras,
        total_item: totalItem,
        referencia_unica: referencia_unica
      });
    }

    // 4) Criar FolhaPagamento
    const folha = await base44.entities.FolhaPagamento.create({
      competencia,
      empresa_id,
      status: 'gerada',
      total: totalFolha,
      total_itens: itens.length,
      criado_por: user.email,
      observacoes: `Gerada automaticamente em ${new Date().toISOString()}`
    });

    console.log(`[FOLHA] Folha criada: ${folha.id}`);

    // 5) Criar itens da folha
    const itemsComFolhaId = itens.map(item => ({
      ...item,
      folha_id: folha.id
    }));

    const itemsCriados = await base44.entities.FolhaPagamentoItem.bulkCreate(itemsComFolhaId);
    console.log(`[FOLHA] ${itemsCriados.length} itens criados`);

    // 6) Criar lançamento em ContaFinanceira (Gastos > Mão de Obra)
    // Determinar obra (primeira ativa ou administrativo)
    const obras = await base44.entities.Obra.filter(
      { status: 'em_andamento' },
      '-created_date',
      1
    ) || [];

    const obraId = obras.length > 0 ? obras[0].id : null;

    // Buscar ou criar obra administrativa
    let obraAdmin = null;
    if (!obraId) {
      const obrasAdmin = await base44.entities.Obra.filter(
        { nome: 'Administrativa' },
        '-created_date',
        1
      ) || [];
      obraAdmin = obrasAdmin.length > 0 ? obrasAdmin[0].id : null;
    }

    // Lançamento geral (todos na mesma conta)
    const lancamento = await base44.entities.ContaFinanceira.create({
      tipo: 'pagar',
      descricao: `Folha de Pagamento - ${competencia}`,
      valor: totalFolha,
      data_vencimento: new Date().toISOString().split('T')[0],
      status: 'pendente',
      obra_id: obraId || obraAdmin || null,
      categoria: 'mao_de_obra',
      referencia_tipo: 'folha_pagamento',
      referencia_id: folha.id,
      fornecedor_cliente: 'Folha de Pagamento',
      observacao: `Folha ${competencia} - ${itemsCriados.length} colaboradores`
    });

    // Atualizar folha com lancamento_id
    await base44.entities.FolhaPagamento.update(folha.id, {
      lancamento_id: lancamento.id
    });

    // Atualizar status para 'processada'
    await base44.entities.FolhaPagamento.update(folha.id, {
      status: 'processada'
    });

    console.log(`[FOLHA] Lançamento criado: ${lancamento.id}`);

    return Response.json({
      success: true,
      folha_id: folha.id,
      total_itens: itemsCriados.length,
      total: totalFolha,
      lancamento_id: lancamento.id,
      message: `Folha ${competencia} gerada com sucesso (${itemsCriados.length} colaboradores)`
    });
  } catch (error) {
    console.error('[FOLHA ERROR]', error);
    return Response.json(
      { error: error.message || 'Erro ao gerar folha' },
      { status: 500 }
    );
  }
});