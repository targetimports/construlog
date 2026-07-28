import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TESTE] Iniciando teste de estoque multi-obra...');

    const resultados = {
      testes: [],
      erros: [],
      resumo: { total: 0, sucesso: 0, falha: 0 }
    };

    // ===== TESTE 1: Consultar estoque geral =====
    try {
      console.log('[TESTE 1] Consultando estoque geral...');
      const resGeral = await base44.functions.invoke('consultarEstoqueGeral', {
        almoxarifado_id: null,
        insumo_id: null
      });

      resultados.testes.push({
        nome: 'Consultar Estoque Geral',
        status: 'sucesso',
        resumo: resGeral.data.resumo,
        itens: resGeral.data.saldo_atual?.length || 0
      });
      resultados.resumo.sucesso++;
    } catch (err) {
      resultados.erros.push({
        teste: 'Consultar Estoque Geral',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    // ===== TESTE 2: Consultar estoque por obra =====
    try {
      console.log('[TESTE 2] Consultando estoque por obra...');
      
      // Buscar uma obra para teste
      const obras = await base44.entities.Obra.list(null, 1);
      
      if (obras.length === 0) {
        throw new Error('Nenhuma obra encontrada para teste');
      }

      const obra_id = obras[0].id;
      console.log(`[TESTE 2] Usando obra: ${obra_id}`);

      const resObra = await base44.functions.invoke('consultarEstoqueObra', {
        obra_id
      });

      resultados.testes.push({
        nome: 'Consultar Estoque por Obra',
        status: 'sucesso',
        obra_id,
        resumo: resObra.data.resumo,
        itens: resObra.data.estoque_atual?.length || 0
      });
      resultados.resumo.sucesso++;
    } catch (err) {
      resultados.erros.push({
        teste: 'Consultar Estoque por Obra',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    // ===== TESTE 3: Validar campo obra_id em MovimentacaoEstoque =====
    try {
      console.log('[TESTE 3] Validando obra_id em movimentações...');
      
      const movimentacoes = await base44.entities.MovimentacaoEstoque.list(null, 10);
      
      if (movimentacoes.length === 0) {
        resultados.testes.push({
          nome: 'Validar obra_id em Movimentações',
          status: 'aviso',
          detalhes: 'Nenhuma movimentação encontrada'
        });
      } else {
        const semObraId = movimentacoes.filter(m => !m.obra_id);
        
        resultados.testes.push({
          nome: 'Validar obra_id em Movimentações',
          status: semObraId.length === 0 ? 'sucesso' : 'aviso',
          total_movimentacoes: movimentacoes.length,
          sem_obra_id: semObraId.length,
          com_obra_id: movimentacoes.length - semObraId.length
        });

        if (semObraId.length === 0) {
          resultados.resumo.sucesso++;
        } else {
          resultados.resumo.falha++;
        }
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Validar obra_id em Movimentações',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    // ===== TESTE 4: Histório de movimentações por obra =====
    try {
      console.log('[TESTE 4] Consultando histórico de movimentações...');
      
      const obras = await base44.entities.Obra.list(null, 2);
      
      if (obras.length >= 1) {
        const obra = obras[0];
        const historico = await base44.entities.MovimentacaoEstoque.filter({
          obra_id: obra.id
        }, '-data', 20);

        resultados.testes.push({
          nome: 'Histórico de Movimentações por Obra',
          status: 'sucesso',
          obra_id: obra.id,
          movimentacoes_encontradas: historico.length,
          tipos: [...new Set(historico.map(m => m.tipo))]
        });
        resultados.resumo.sucesso++;
      } else {
        resultados.testes.push({
          nome: 'Histórico de Movimentações por Obra',
          status: 'aviso',
          detalhes: 'Insuficiente de obras para teste'
        });
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Histórico de Movimentações por Obra',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    // ===== LOG FINAL =====
    await base44.entities.LogAuditoria.create({
      function_name: 'testeEstoqueMultiObra',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({}),
      result: resultados.resumo.falha === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'teste_estoque_multi_obra',
        total_testes: resultados.resumo.total,
        sucesso: resultados.resumo.sucesso,
        falha: resultados.resumo.falha
      }
    });

    console.log('[TESTE] Testes concluídos!');

    return Response.json({
      success: resultados.resumo.falha === 0,
      resultados
    });

  } catch (error) {
    console.error('Erro no teste:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});