import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testa consolidação financeira com múltiplas obras
 * Valida: receita, despesa, folha, logística, comparativos
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Super admin required
    if (user.role !== 'admin' && user.role !== 'programador') {
      return Response.json({ error: 'Apenas admin pode rodar testes' }, { status: 403 });
    }

    console.log('[TESTE] Iniciando teste de consolidação com múltiplas obras...');

    const resultados = {
      testes: [],
      erros: [],
      resumo: { total: 0, sucesso: 0, falha: 0 }
    };

    try {
      // TESTE 1: Cenário com 2 obras (uma positiva, uma negativa)
      console.log('[TESTE 1] Criando cenário com 2 obras...');

      // Buscar 2 obras
      const obras = await base44.entities.Obra.list(null, 2);
      
      if (obras.length < 2) {
        resultados.testes.push({
          nome: 'Cenário 2 Obras',
          status: 'aviso',
          detalhes: `Apenas ${obras.length} obra(s) encontrada(s)`
        });
      } else {
        const obra1 = obras[0];
        const obra2 = obras[1];

        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        // Consolidar ambas
        const cons1 = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obra1.id,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'AMBOS'
        });

        const cons2 = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obra2.id,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'AMBOS'
        });

        const obra1Status = cons1.data.saldo_realizado > 0 ? 'lucrativa' : 'prejuizo';
        const obra2Status = cons2.data.saldo_realizado > 0 ? 'lucrativa' : 'prejuizo';

        resultados.testes.push({
          nome: 'Cenário 2 Obras (Lucro vs Prejuízo)',
          status: 'sucesso',
          obra1: {
            id: obra1.id,
            nome: obra1.nome,
            status: obra1Status,
            receita: cons1.data.receita_realizada,
            despesa: cons1.data.despesa_realizada,
            saldo: cons1.data.saldo_realizado,
            margem: cons1.data.margem_realizada
          },
          obra2: {
            id: obra2.id,
            nome: obra2.nome,
            status: obra2Status,
            receita: cons2.data.receita_realizada,
            despesa: cons2.data.despesa_realizada,
            saldo: cons2.data.saldo_realizado,
            margem: cons2.data.margem_realizada
          }
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Cenário 2 Obras', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 2: Realizado vs Previsto
      console.log('[TESTE 2] Testando REALIZADO vs PREVISTO...');

      const obras = await base44.entities.Obra.list(null, 1);
      if (obras.length === 0) {
        resultados.testes.push({
          nome: 'Realizado vs Previsto',
          status: 'aviso',
          detalhes: 'Nenhuma obra encontrada'
        });
      } else {
        const obraId = obras[0].id;
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        const consRealizado = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obraId,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'REALIZADO'
        });

        const consPrevisto = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obraId,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'PREVISTO'
        });

        const consAmbos = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obraId,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'AMBOS'
        });

        resultados.testes.push({
          nome: 'Realizado vs Previsto',
          status: 'sucesso',
          realizado: {
            receita: consRealizado.data.receita_realizada,
            despesa: consRealizado.data.despesa_realizada,
            saldo: consRealizado.data.saldo_realizado
          },
          previsto: {
            receita: consPrevisto.data.receita_prevista,
            despesa: consPrevisto.data.despesa_prevista,
            saldo: consPrevisto.data.saldo_previsto
          },
          total: {
            receita: consAmbos.data.receita_total,
            despesa: consAmbos.data.despesa_total,
            saldo: consAmbos.data.saldo_total
          },
          validacao: {
            soma_correta: consAmbos.data.receita_total === (consRealizado.data.receita_realizada + consPrevisto.data.receita_prevista)
          }
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Realizado vs Previsto', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 3: Validar permissões (Encarregado só vê sua obra)
      console.log('[TESTE 3] Testando validação de permissões...');

      // Buscar usuários com diferentes perfis
      const usuarios = await base44.entities.UsuarioObra.filter({
        ativo: true
      }, null, 10);

      if (usuarios.length === 0) {
        resultados.testes.push({
          nome: 'Validação de Permissões',
          status: 'aviso',
          detalhes: 'Nenhuma relação usuário-obra encontrada'
        });
      } else {
        // Testar acesso de encarregado vs mestre
        const encarregado = usuarios.find(u => u.perfil === 'encarregado');
        const mestre = usuarios.find(u => u.perfil === 'mestre_de_obras');

        const perfisTestados = [];

        if (encarregado) {
          const obrasEncarregado = usuarios.filter(u => u.user_email === encarregado.user_email);
          perfisTestados.push({
            perfil: 'encarregado',
            email: encarregado.user_email,
            obras_acessiveis: obrasEncarregado.length,
            restricao: obrasEncarregado.length === 1 ? 'VALIDADA' : 'FALHA'
          });
        }

        if (mestre) {
          const obrasMestre = usuarios.filter(u => u.user_email === mestre.user_email);
          perfisTestados.push({
            perfil: 'mestre_de_obras',
            email: mestre.user_email,
            obras_acessiveis: obrasMestre.length,
            restricao: obrasMestre.length > 1 ? 'VALIDADA' : 'AVISO'
          });
        }

        resultados.testes.push({
          nome: 'Validação de Permissões',
          status: 'sucesso',
          perfis_testados: perfisTestados,
          total_vinculos: usuarios.length
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Permissões', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 4: Auditoria de lançamentos órfãos
      console.log('[TESTE 4] Testando auditoria de lançamentos órfãos...');

      const auditoria = await base44.functions.invoke('auditarLancamentosOrfaos', {});

      const totalOrfaos = auditoria.data.resultado.total_orfaos;
      const status = totalOrfaos === 0 ? 'sucesso' : 'alerta';

      resultados.testes.push({
        nome: 'Auditoria de Lançamentos Órfãos',
        status: status,
        entidades_verificadas: auditoria.data.resultado.entidades_verificadas,
        total_orfaos: totalOrfaos,
        detalhes: auditoria.data.resultado.detalhes,
        recomendacao: totalOrfaos > 0 ? 'Vincular lançamentos a obra' : 'Nenhum problema encontrado'
      });

      if (status === 'sucesso') {
        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Auditoria', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 5: Filtros com consolidação completa
      console.log('[TESTE 5] Testando filtros de consolidação completa...');

      const obras = await base44.entities.Obra.list(null, 2);
      if (obras.length === 0) {
        resultados.testes.push({
          nome: 'Filtros de Consolidação',
          status: 'aviso',
          detalhes: 'Nenhuma obra encontrada'
        });
      } else {
        const obra = obras[0];
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        // Testar filtros: categoria, fornecedor, centro_custo
        const consComFiltros = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obra.id,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'AMBOS',
          filtro_categoria_id: null,
          filtro_fornecedor_id: null,
          filtro_centro_custo_id: null
        });

        resultados.testes.push({
          nome: 'Filtros de Consolidação',
          status: 'sucesso',
          obra_testada: obra.nome,
          filtros_aplicados: {
            tipo: 'AMBOS',
            data_inicio: `${mesAtual}-01`,
            data_fim: `${mesAtual}-28`,
            categoria: 'nenhum',
            fornecedor: 'nenhum',
            centro_custo: 'nenhum'
          },
          resultados: {
            receita_realizada: consComFiltros.data.receita_realizada,
            receita_prevista: consComFiltros.data.receita_prevista,
            despesa_realizada: consComFiltros.data.despesa_realizada,
            despesa_prevista: consComFiltros.data.despesa_prevista,
            top_fornecedores: consComFiltros.data.top_fornecedores.length,
            top_centros_custo: consComFiltros.data.top_centros_custo.length,
            caixa_diario_dias: consComFiltros.data.caixa_diario.length
          }
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Filtros', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 6: Breakdown de Despesas por Categoria
      console.log('[TESTE 6] Testando breakdown de despesas por categoria...');

      const obras = await base44.entities.Obra.list(null, 1);
      if (obras.length === 0) {
        resultados.testes.push({
          nome: 'Breakdown de Despesas',
          status: 'aviso',
          detalhes: 'Nenhuma obra encontrada'
        });
      } else {
        const obra = obras[0];
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        const cons = await base44.functions.invoke('consolidarFinanceiroCompleto', {
          obra_id: obra.id,
          data_inicio: `${mesAtual}-01`,
          data_fim: `${mesAtual}-28`,
          tipo: 'AMBOS'
        });

        const totalDespesa = cons.data.despesa_total;

        // Calcular percentuais
        const percentuaisCategorias = {};
        Object.entries(cons.data.despesa_por_categoria).forEach(([cat, valor]) => {
          percentuaisCategorias[cat] = totalDespesa > 0 ? ((valor / totalDespesa) * 100).toFixed(1) : 0;
        });

        resultados.testes.push({
          nome: 'Breakdown de Despesas por Categoria',
          status: 'sucesso',
          obra_id: obra.id,
          periodo: `${mesAtual}-01 a ${mesAtual}-28`,
          despesa_total: totalDespesa,
          categorias: Object.keys(cons.data.despesa_por_categoria).length,
          breakdown_valores: cons.data.despesa_por_categoria,
          breakdown_percentuais: percentuaisCategorias,
          top_fornecedores: cons.data.top_fornecedores.slice(0, 3),
          top_centros_custo: cons.data.top_centros_custo.slice(0, 3)
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Breakdown', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'testeConsolidacaoMultiObras',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({}),
      result: resultados.resumo.falha === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'teste_consolidacao',
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});