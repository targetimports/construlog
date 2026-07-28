import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testa vinculação de todos os custos de veículos à obra
 * Valida: obra_id, veiculo_id, usuario_responsavel, centro_custo gerado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TESTE] Iniciando validação de custos de veículos...');

    const resultados = {
      testes: [],
      erros: [],
      resumo: { total: 0, sucesso: 0, falha: 0 }
    };

    try {
      // TESTE 1: Validar Abastecimento
      console.log('[TESTE 1] Validando Abastecimento...');

      const abastecimentos = await base44.entities.Abastecimento.list(null, 5);

      if (abastecimentos.length === 0) {
        resultados.testes.push({
          nome: 'Validar Abastecimento',
          status: 'aviso',
          detalhes: 'Nenhum abastecimento encontrado'
        });
      } else {
        const obrasIds = new Set(abastecimentos.map(a => a.obra_id));
        const todosCamposObrigatorios = abastecimentos.every(a =>
          a.obra_id && a.veiculo_id && a.usuario_responsavel && a.data && a.litros && a.valor_total
        );

        const todosTemCentroCusto = abastecimentos.every(a => a.centro_custo_id);

        resultados.testes.push({
          nome: 'Validar Abastecimento',
          status: todosCamposObrigatorios && todosTemCentroCusto ? 'sucesso' : 'falha',
          quantidade: abastecimentos.length,
          obras_vinculadas: obrasIds.size,
          campos_obrigatorios_ok: todosCamposObrigatorios,
          centro_custo_gerado: todosTemCentroCusto,
          exemplos: abastecimentos.slice(0, 2).map(a => ({
            id: a.id,
            obra_id: a.obra_id,
            veiculo_id: a.veiculo_id,
            usuario_responsavel: a.usuario_responsavel,
            centro_custo_id: a.centro_custo_id
          }))
        });

        if (todosCamposObrigatorios && todosTemCentroCusto) {
          resultados.resumo.sucesso++;
        } else {
          resultados.resumo.falha++;
        }
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Validar Abastecimento', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 2: Validar Manutenção
      console.log('[TESTE 2] Validando Manutenção...');

      const manutencoes = await base44.entities.Manutencao.list(null, 5);

      if (manutencoes.length === 0) {
        resultados.testes.push({
          nome: 'Validar Manutenção',
          status: 'aviso',
          detalhes: 'Nenhuma manutenção encontrada'
        });
      } else {
        const obrasIds = new Set(manutencoes.map(m => m.obra_id));
        const todosCamposObrigatorios = manutencoes.every(m =>
          m.obra_id && m.veiculo_id && m.usuario_responsavel && m.tipo && m.descricao
        );

        const todosTemCentroCusto = manutencoes.every(m => m.centro_custo_id);

        resultados.testes.push({
          nome: 'Validar Manutenção',
          status: todosCamposObrigatorios && todosTemCentroCusto ? 'sucesso' : 'falha',
          quantidade: manutencoes.length,
          obras_vinculadas: obrasIds.size,
          campos_obrigatorios_ok: todosCamposObrigatorios,
          centro_custo_gerado: todosTemCentroCusto,
          tipos: {
            preventiva: manutencoes.filter(m => m.tipo === 'preventiva').length,
            corretiva: manutencoes.filter(m => m.tipo === 'corretiva').length
          },
          exemplos: manutencoes.slice(0, 2).map(m => ({
            id: m.id,
            obra_id: m.obra_id,
            veiculo_id: m.veiculo_id,
            usuario_responsavel: m.usuario_responsavel,
            tipo: m.tipo,
            centro_custo_id: m.centro_custo_id
          }))
        });

        if (todosCamposObrigatorios && todosTemCentroCusto) {
          resultados.resumo.sucesso++;
        } else {
          resultados.resumo.falha++;
        }
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Validar Manutenção', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 3: Validar CustoVeiculo (hospedagem, alimentação, etc)
      console.log('[TESTE 3] Validando CustoVeiculo...');

      const custos = await base44.entities.CustoVeiculo.list(null, 5);

      if (custos.length === 0) {
        resultados.testes.push({
          nome: 'Validar CustoVeiculo',
          status: 'aviso',
          detalhes: 'Nenhum custo de veículo encontrado'
        });
      } else {
        const obrasIds = new Set(custos.map(c => c.obra_id));
        const todosCamposObrigatorios = custos.every(c =>
          c.obra_id && c.veiculo_id && c.usuario_responsavel && c.tipo && c.valor && c.data_custo
        );

        const todosTemCentroCusto = custos.every(c => c.centro_custo_id);

        const tiposPresentes = {};
        custos.forEach(c => {
          tiposPresentes[c.tipo] = (tiposPresentes[c.tipo] || 0) + 1;
        });

        resultados.testes.push({
          nome: 'Validar CustoVeiculo',
          status: todosCamposObrigatorios && todosTemCentroCusto ? 'sucesso' : 'falha',
          quantidade: custos.length,
          obras_vinculadas: obrasIds.size,
          campos_obrigatorios_ok: todosCamposObrigatorios,
          centro_custo_gerado: todosTemCentroCusto,
          tipos_presentes: tiposPresentes,
          exemplos: custos.slice(0, 2).map(c => ({
            id: c.id,
            obra_id: c.obra_id,
            veiculo_id: c.veiculo_id,
            usuario_responsavel: c.usuario_responsavel,
            tipo: c.tipo,
            valor: c.valor,
            centro_custo_id: c.centro_custo_id
          }))
        });

        if (todosCamposObrigatorios && todosTemCentroCusto) {
          resultados.resumo.sucesso++;
        } else {
          resultados.resumo.falha++;
        }
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Validar CustoVeiculo', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    try {
      // TESTE 4: Validar Centros de Custo criados
      console.log('[TESTE 4] Validando centros de custo gerados...');

      const centros = await base44.entities.CentroCusto.filter({
        obra_id: { $ne: null }
      });

      if (centros.length === 0) {
        resultados.testes.push({
          nome: 'Validar Centros de Custo',
          status: 'aviso',
          detalhes: 'Nenhum centro de custo vinculado a obras'
        });
      } else {
        const todosAtivos = centros.every(c => c.ativo === true);

        resultados.testes.push({
          nome: 'Validar Centros de Custo',
          status: todosAtivos ? 'sucesso' : 'aviso',
          quantidade: centros.length,
          todos_ativos: todosAtivos,
          exemplos: centros.slice(0, 3).map(c => ({
            id: c.id,
            nome: c.nome,
            codigo: c.codigo,
            obra_id: c.obra_id,
            ativo: c.ativo
          }))
        });

        resultados.resumo.sucesso++;
      }

      resultados.resumo.total++;
    } catch (err) {
      resultados.erros.push({ teste: 'Validar Centros de Custo', erro: err.message });
      resultados.resumo.falha++;
      resultados.resumo.total++;
    }

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'testeVincularCustosVeiculoObra',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({}),
      result: resultados.resumo.falha === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'teste_custos_veiculos',
        total_testes: resultados.resumo.total,
        sucesso: resultados.resumo.sucesso,
        falha: resultados.resumo.falha
      }
    });

    console.log('[TESTE] Validação concluída!');

    return Response.json({
      success: resultados.resumo.falha === 0,
      resultados
    });

  } catch (error) {
    console.error('Erro no teste:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});