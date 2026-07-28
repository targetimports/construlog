import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automatizados do processamento de NF
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

    // Criar dados de teste
    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: 'Obra Teste NF',
      cliente: 'Cliente Teste'
    });

    const fornecedor = await base44.asServiceRole.entities.Fornecedor.create({
      nome: 'Fornecedor Teste',
      cnpj: '00000000000000'
    });

    const insumo = await base44.asServiceRole.entities.Insumo.create({
      codigo: 'TEST-NF-001',
      descricao: 'Material Teste NF',
      unidade: 'UN',
      preco_unitario: 50.00
    });

    const deposito = await base44.asServiceRole.entities.Almoxarifado.create({
      nome: 'Depósito Teste NF',
      tipo: 'central'
    });

    // ========================================
    // TESTE 1: NF gera conta a pagar
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respNF1 = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'NF-TEST-001',
          chave_nf: 'CHAVE-TEST-001',
          numero_nf: 'NF-001',
          fornecedor_id: fornecedor.id,
          obra_id: obra.id,
          centro_custo_id: 'CC-001',
          data_emissao: new Date().toISOString(),
          data_vencimento: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          valor_total: 1000.00,
          itens: [
            {
              tipo: 'servico',
              descricao: 'Serviço de teste',
              quantidade: 1,
              valor_unitario: 1000.00
            }
          ]
        })
      });

      const dataNF1 = await respNF1.json();
      
      if (dataNF1.success && dataNF1.conta_pagar_id) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'NF gera conta a pagar', 
          resultado: 'PASSOU',
          conta_pagar_id: dataNF1.conta_pagar_id
        });
      } else {
        throw new Error('Conta a pagar não foi criada');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'NF gera conta a pagar', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 2: NF material gera entrada estoque
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respNF2 = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'NF-TEST-002',
          chave_nf: 'CHAVE-TEST-002',
          numero_nf: 'NF-002',
          fornecedor_id: fornecedor.id,
          obra_id: obra.id,
          centro_custo_id: 'CC-001',
          data_emissao: new Date().toISOString(),
          data_vencimento: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          valor_total: 500.00,
          deposito_destino_id: deposito.id,
          itens: [
            {
              tipo: 'material',
              insumo_id: insumo.id,
              codigo: insumo.codigo,
              descricao: insumo.descricao,
              unidade: insumo.unidade,
              quantidade: 10,
              valor_unitario: 50.00
            }
          ]
        })
      });

      const dataNF2 = await respNF2.json();
      
      if (dataNF2.success && dataNF2.movimentacoes_geradas > 0) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'NF material gera entrada estoque', 
          resultado: 'PASSOU',
          movimentacoes: dataNF2.movimentacoes_geradas
        });
      } else {
        throw new Error('Movimentação de estoque não foi criada');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'NF material gera entrada estoque', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 3: NF serviço não gera estoque
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respNF3 = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'NF-TEST-003',
          chave_nf: 'CHAVE-TEST-003',
          numero_nf: 'NF-003',
          fornecedor_id: fornecedor.id,
          obra_id: obra.id,
          centro_custo_id: 'CC-001',
          data_emissao: new Date().toISOString(),
          data_vencimento: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          valor_total: 2000.00,
          itens: [
            {
              tipo: 'servico',
              descricao: 'Consultoria',
              quantidade: 1,
              valor_unitario: 2000.00
            }
          ]
        })
      });

      const dataNF3 = await respNF3.json();
      
      if (dataNF3.success && dataNF3.movimentacoes_geradas === 0 && dataNF3.itens_processados.servicos === 1) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'NF serviço não gera estoque', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Serviço gerou movimentação de estoque incorretamente');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'NF serviço não gera estoque', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 4: NF duplicada não processa
    // ========================================
    try {
      resultados.testes_executados++;
      
      // Tentar processar NF já processada
      const respNFDup = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'NF-TEST-001',
          chave_nf: 'CHAVE-TEST-001',
          numero_nf: 'NF-001', // Mesma NF do teste 1
          fornecedor_id: fornecedor.id,
          obra_id: obra.id,
          centro_custo_id: 'CC-001',
          data_emissao: new Date().toISOString(),
          data_vencimento: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          valor_total: 1000.00,
          itens: [
            {
              tipo: 'servico',
              descricao: 'Serviço duplicado',
              quantidade: 1,
              valor_unitario: 1000.00
            }
          ]
        })
      });

      const dataNFDup = await respNFDup.json();
      
      if (respNFDup.status === 409 && dataNFDup.duplicado) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'NF duplicada não processa', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('NF duplicada foi processada incorretamente');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'NF duplicada não processa', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 5: NF sem obra_id deve falhar
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respNFSemObra = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'NF-TEST-004',
          chave_nf: 'CHAVE-TEST-004',
          numero_nf: 'NF-004',
          fornecedor_id: fornecedor.id,
          // obra_id propositalmente omitido
          centro_custo_id: 'CC-001',
          valor_total: 500.00,
          itens: [{ tipo: 'servico', descricao: 'Teste', quantidade: 1, valor_unitario: 500.00 }]
        })
      });

      if (respNFSemObra.status === 400) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'NF sem obra_id deve falhar', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('NF sem obra foi processada incorretamente');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'NF sem obra_id deve falhar', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // Limpar dados de teste
    await base44.asServiceRole.entities.Obra.delete(obra.id);
    await base44.asServiceRole.entities.Fornecedor.delete(fornecedor.id);
    await base44.asServiceRole.entities.Insumo.delete(insumo.id);
    await base44.asServiceRole.entities.Almoxarifado.delete(deposito.id);

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