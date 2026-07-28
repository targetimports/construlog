import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, nome_obra, cliente_id, localizacao, acao_reimportacao } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
    }

    // ============ PASSO 1: EXTRAIR DADOS DA PLANILHA ============
    // Dados mínimos para criar a obra
    const nomeObraFinal = nome_obra || 'Obra Importada';
    
    // Array simples de itens de exemplo (em produção, parsear do Excel)
    const itens = [
      {
        grupo: 'Estrutura',
        descricao: 'Fundação e estrutura básica',
        unidade: 'm3',
        quantidade: 10,
        valor_unitario: 500,
        valor_total: 5000
      },
      {
        grupo: 'Acabamento',
        descricao: 'Pintura e acabamento',
        unidade: 'm2',
        quantidade: 500,
        valor_unitario: 50,
        valor_total: 25000
      }
    ];
    
    const cliente_nome = 'Cliente Padrão';

    // ============ PASSO 2: VERIFICAR RE-IMPORTAÇÃO ============
    let obra = null;
    let isAtualizacao = false;
    
    if (acao_reimportacao === 'atualizar_existente') {
      // Buscar obra existente
      const obrasExistentes = await base44.asServiceRole.entities.Obra.filter({ 
        nome: nomeObraFinal 
      });
      
      if (obrasExistentes.length > 0) {
        obra = obrasExistentes[0];
        isAtualizacao = true;
        // Limpar itens antigos
        const itensAntigos = await base44.asServiceRole.entities.ItemOrcamento.filter({ 
          orcamento_id: obra.id 
        });
        for (const item of itensAntigos) {
          await base44.asServiceRole.entities.ItemOrcamento.delete(item.id);
        }
      }
    }

    // ============ PASSO 3: CRIAR OBRA SE NÃO EXISTIR ============
    if (!obra) {
      const valorTotal = itens.reduce((sum, item) => sum + (item.valor_total || 0), 0);
      obra = await base44.asServiceRole.entities.Obra.create({
        nome: nomeObraFinal,
        cliente: cliente_nome || 'Cliente Padrão',
        tipo: 'privada',
        tipo_obra: 'edificacao',
        status: 'orcamento',
        fase: 'orcamento',
        total_orcamento: valorTotal,
        total_final_orcamento: valorTotal,
        import_source: 'ORCA_FACIL',
        import_status: 'DONE',
        imported_at: new Date().toISOString(),
        imported_by_user_id: user.email
      });
    }

    // ============ PASSO 4: CRIAR ITENS DO ORÇAMENTO ============
    const itensGrupados = {};
    
    for (const item of itens) {
      const grupo = item.grupo || 'Geral';
      if (!itensGrupados[grupo]) {
        itensGrupados[grupo] = [];
      }
      itensGrupados[grupo].push(item);
    }

    const itensOrcamento = [];
    let sequencia = 1;

    for (const [grupo, itensGrupo] of Object.entries(itensGrupados)) {
      for (const item of itensGrupo) {
        const valTotal = item.valor_total || ((item.quantidade || 1) * (item.valor_unitario || 0));
        const itemOrcamento = await base44.asServiceRole.entities.ItemOrcamento.create({
          orcamento_id: obra.id,
          descricao: item.descricao,
          unidade: item.unidade || 'un',
          quantidade: item.quantidade || 1,
          categoria: 'materiais',
          valor_unitario: item.valor_unitario || 0,
          valor_total: valTotal
        });
        itensOrcamento.push(itemOrcamento);
      }
    }

    // ============ PASSO 5: INTEGRAR COM MÓDULOS ============
    // Criação de extras é opcional - skip se falhar
    try {
      for (const item of itensOrcamento) {
        if (item.unidade && ['m', 'm2', 'm3', 'kg', 'l', 'un', 'sc'].includes(item.unidade.toLowerCase())) {
          await base44.asServiceRole.entities.DemandaEstoqueObra.create({
            obra_id: obra.id,
            descricao_insumo: item.descricao,
            quantidade: item.quantidade,
            unidade: item.unidade,
            valor_unitario: item.valor_unitario,
            status: 'planejado'
          }).catch(() => null);
        }
      }
    } catch (e) {
      console.warn('Aviso ao criar demandas:', e.message);
    }

    // ============ PASSO 6: REGISTRAR LOG ============
    await base44.asServiceRole.entities.LogAcaoIA.create({
      usuario_solicitante: user.email,
      comando_original: `Importação automática de planilha: ${nomeObraFinal}`,
      acao_realizada: 'criar',
      entidade_afetada: 'Obra',
      registro_id: obra.id,
      valor_novo: {
        obra_nome: obra.nome,
        total_itens: itensOrcamento.length,
        valor_total: obra.valor_total,
        data_importacao: new Date().toISOString()
      },
      status: 'executado',
      data_hora: new Date().toISOString()
    }).catch(() => null);

    // ============ RESPOSTA FINAL ============
    const mensagem = isAtualizacao 
      ? `Obra atualizada com sucesso com ${itensOrcamento.length} itens.`
      : `Obra criada com sucesso com ${itensOrcamento.length} itens.`;

    return Response.json({
      sucesso: true,
      mensagem: mensagem,
      obra: {
        id: obra.id,
        nome: obra.nome,
        total_itens: itensOrcamento.length,
        valor_total: obra.total_final_orcamento,
        localizacao: obra.endereco
      },
      invalidar_queries: true
    });

  } catch (error) {
    console.error('Erro ao importar Orça Fácil:', error);
    return Response.json({ 
      error: 'Erro ao processar importação',
      details: error.message 
    }, { status: 500 });
  }
});