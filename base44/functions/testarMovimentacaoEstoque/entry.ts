import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automatizados do módulo de estoque
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Somente admins podem executar testes' }, { status: 403 });
    }

    const resultados = {
      testes_executados: 0,
      testes_passou: 0,
      testes_falhou: 0,
      detalhes: []
    };

    // Teste 1: Entrada altera saldo
    try {
      resultados.testes_executados++;
      
      // Criar insumo teste
      const insumo = await base44.asServiceRole.entities.Insumo.create({
        codigo: 'TEST-001',
        descricao: 'Insumo Teste',
        unidade: 'UN',
        preco_unitario: 10.00
      });

      // Criar depósito
      const deposito = await base44.asServiceRole.entities.Almoxarifado.create({
        nome: 'Depósito Teste',
        tipo: 'central'
      });

      // Fazer entrada
      const respEntrada = await fetch(req.headers.get('origin') + '/api/functions/processarMovimentacaoEstoque', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo: 'entrada',
          insumo_id: insumo.id,
          quantidade: 100,
          deposito_destino_id: deposito.id
        })
      });

      const dataEntrada = await respEntrada.json();
      
      if (dataEntrada.success && dataEntrada.saldo_atualizado.quantidade === 100) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Entrada altera saldo', 
          resultado: 'PASSOU',
          saldo_esperado: 100,
          saldo_obtido: dataEntrada.saldo_atualizado.quantidade
        });
      } else {
        throw new Error('Saldo incorreto após entrada');
      }

      // Limpar dados de teste
      await base44.asServiceRole.entities.Insumo.delete(insumo.id);
      await base44.asServiceRole.entities.Almoxarifado.delete(deposito.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Entrada altera saldo', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // Teste 2: Saída sem obra_id deve falhar
    try {
      resultados.testes_executados++;
      
      const insumo = await base44.asServiceRole.entities.Insumo.create({
        codigo: 'TEST-002',
        descricao: 'Insumo Teste 2',
        unidade: 'UN'
      });

      const deposito = await base44.asServiceRole.entities.Almoxarifado.create({
        nome: 'Depósito Teste 2',
        tipo: 'central'
      });

      const respSaida = await fetch(req.headers.get('origin') + '/api/functions/processarMovimentacaoEstoque', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo: 'saida_consumo',
          insumo_id: insumo.id,
          quantidade: 10,
          deposito_origem_id: deposito.id
          // obra_id propositalmente omitido
        })
      });

      if (respSaida.status === 400) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Saída sem obra_id deve falhar', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Deveria ter falhado mas passou');
      }

      await base44.asServiceRole.entities.Insumo.delete(insumo.id);
      await base44.asServiceRole.entities.Almoxarifado.delete(deposito.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Saída sem obra_id deve falhar', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // Teste 3: Consumo sem centro_custo_id deve falhar
    try {
      resultados.testes_executados++;
      
      const respConsumo = await fetch(req.headers.get('origin') + '/api/functions/validarMovimentacaoEstoque', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo: 'saida_consumo',
          obra_id: 'obra-123',
          insumo_id: 'insumo-123',
          quantidade: 10
          // centro_custo_id propositalmente omitido
        })
      });

      if (respConsumo.status === 400) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Consumo sem centro_custo_id deve falhar', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Deveria ter falhado mas passou');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Consumo sem centro_custo_id deve falhar', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    return Response.json({
      ...resultados,
      taxa_sucesso: `${((resultados.testes_passou / resultados.testes_executados) * 100).toFixed(1)}%`
    });

  } catch (error) {
    console.error('Erro nos testes:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});