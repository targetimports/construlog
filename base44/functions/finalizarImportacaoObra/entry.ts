import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id, dados_obra, dados_cliente } = await req.json();

    if (!session_id) {
      return Response.json({ error: 'session_id não fornecido' }, { status: 400 });
    }

    // Buscar sessão
    const session = await base44.asServiceRole.entities.ImportSession.filter({ id: session_id });
    if (session.length === 0) {
      return Response.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    const sessionData = session[0];

    // Buscar materiais da sessão
    const materiais = await base44.asServiceRole.entities.ImportMaterial.filter({ 
      session_id 
    });

    // Validar pendências
    const pendentes = materiais.filter(m => !m.resolved);
    if (pendentes.length > 0) {
      return Response.json({ 
        error: `Existem ${pendentes.length} materiais não resolvidos. Complete o mapeamento primeiro.` 
      }, { status: 400 });
    }

    // Calcular valor total dos materiais
    const valorTotal = materiais.reduce((sum, m) => sum + (m.valor_total || 0), 0);
    const totalGeral = sessionData.dados_extraidos?.totalGeral || valorTotal;

    // Criar Obra com TODOS os campos
    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: dados_obra.nome,
      tipo: dados_obra.tipo || 'privada',
      status: dados_obra.status || 'planejamento',
      endereco: dados_obra.endereco || '',
      cidade: dados_obra.cidade || '',
      estado: dados_obra.estado || '',
      data_inicio: dados_obra.data_inicio || new Date().toISOString().split('T')[0],
      data_prevista_fim: dados_obra.data_prevista_fim || null,
      responsavel_email: dados_obra.responsavel_email || user.email,
      cliente: dados_cliente.cliente_nome || dados_cliente.orgao || 'N/A',
      cliente_id: dados_cliente.cliente_id || null,
      centro_custo: dados_obra.centro_custo || 'CC-001',
      valor_contrato: parseFloat(dados_obra.valor_contrato) || totalGeral,
      valor_orcado: totalGeral,
      user_criador: user.email,
      origem: 'importacao',
      progresso: 0,
      import_source: 'ORCA_FACIL',
      imported_at: new Date().toISOString(),
      imported_by_user_id: user.id,
      import_session_id: session_id,
      import_status: 'PROCESSING'
    });

    // Criar Orçamento
    const orcamento = await base44.asServiceRole.entities.Orcamento.create({
      obra_id: obra.id,
      nome: `Orçamento - ${obra.nome}`,
      data_criacao: new Date().toISOString().split('T')[0],
      valor_total: sessionData.dados_extraidos.totalGeral,
      status: 'aprovado',
      criado_por: user.email,
      versao: 1
    });

    // Criar Itens do Orçamento + Insumos
    const itensErros = [];
    let sequencia = 1;

    for (const material of materiais) {
      try {
        let insumoId = material.insumo_match_id;

        // Se marcado como "novo", criar insumo
        if (material.match_status === 'novo' && !insumoId) {
          const novoInsumo = await base44.asServiceRole.entities.Insumo.create({
            codigo: material.codigo,
            banco: material.banco || 'SINAPI',
            descricao: material.descricao,
            unidade: material.unidade,
            tipo: 'material'
          });
          insumoId = novoInsumo.id;
        }

        // Criar Item do Orçamento
        await base44.asServiceRole.entities.OrcamentoItem.create({
          orcamento_id: orcamento.id,
          codigo: material.codigo,
          descricao: material.descricao,
          unidade: material.unidade,
          quantidade: material.quantidade,
          valor_unitario: material.valor_unitario,
          valor_total: material.valor_total,
          grupo: material.grupo || 'Geral',
          sequencia: sequencia++,
          tipo: 'material',
          obra_id: obra.id
        });

        // Criar Demanda de Estoque
        if (insumoId) {
          await base44.asServiceRole.entities.DemandaEstoqueObra.create({
            obra_id: obra.id,
            insumo_id: insumoId,
            insumo_descricao: material.descricao,
            unidade: material.unidade,
            quantidade_prevista: material.quantidade,
            quantidade_comprada: 0,
            quantidade_recebida: 0,
            quantidade_consumida: 0,
            saldo: 0,
            percentual_consumo: 0,
            data_calculo: new Date().toISOString()
          });
        }

      } catch (err) {
        itensErros.push({ material: material.descricao, erro: err.message });
      }
    }

    // Atualizar obra para DONE e sessão como completa
    await base44.asServiceRole.entities.Obra.update(obra.id, {
      import_status: 'DONE'
    });

    await base44.asServiceRole.entities.ImportSession.update(session_id, {
      status: 'completed',
      obra_id: obra.id,
      dados_complementados: { dados_obra, dados_cliente }
    });

    return Response.json({
      success: true,
      obra_id: obra.id,
      obra_name: obra.nome,
      import_source: 'ORCA_FACIL',
      obra: obra,
      orcamento_id: orcamento.id,
      itens_criados: materiais.length - itensErros.length,
      itens_erros: itensErros.length,
      erros: itensErros,
      totals: {
        valor_total: totalGeral,
        total_materiais: materiais.length,
        materiais_resolvidos: materiais.filter(m => m.resolved).length
      }
    });

  } catch (error) {
    console.error('Erro ao finalizar importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});