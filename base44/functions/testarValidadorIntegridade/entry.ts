import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automatizados do validador de integridade
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

    // ========================================
    // TESTE 1: Conta Pagar sem obra → erro
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respCP = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'TEST-NF-001',
          chave_nf: 'TEST-CHAVE-001',
          numero_nf: 'NF-TEST-001',
          fornecedor_id: 'forn-test',
          // obra_id propositalmente omitido
          centro_custo_id: 'cc-001',
          valor_total: 1000,
          itens: [{ tipo: 'servico', descricao: 'Teste', quantidade: 1, valor_unitario: 1000 }]
        })
      });

      const dataCP = await respCP.json();
      
      if (respCP.status === 500 && dataCP.error?.includes('BLOQUEIO DE INTEGRIDADE')) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Conta Pagar sem obra → bloqueado', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Conta sem obra foi processada');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Conta Pagar sem obra → bloqueado', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 2: Consumo sem centro_custo → erro
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respConsumo = await fetch(req.headers.get('origin') + '/api/functions/processarNotaFiscalCompleta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          nf_id: 'TEST-NF-002',
          chave_nf: 'TEST-CHAVE-002',
          numero_nf: 'NF-TEST-002',
          fornecedor_id: 'forn-test',
          obra_id: 'obra-test',
          // centro_custo_id propositalmente omitido
          valor_total: 2000,
          itens: [{ tipo: 'servico', descricao: 'Teste', quantidade: 1, valor_unitario: 2000 }]
        })
      });

      const dataConsumo = await respConsumo.json();
      
      if (respConsumo.status === 500 && dataConsumo.error?.includes('centro_custo_id')) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Consumo sem centro_custo → bloqueado', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Consumo sem centro custo foi processado');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Consumo sem centro_custo → bloqueado', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 3: Medição sem obra → erro
    // ========================================
    try {
      resultados.testes_executados++;
      
      const medicaoSemObra = await base44.asServiceRole.entities.MedicaoObra.create({
        numero: 'MED-TEST-001',
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        valor_total: 5000,
        status: 'rascunho'
        // obra_id propositalmente omitido
      });

      const respFat = await fetch(req.headers.get('origin') + '/api/functions/gerarContaReceberMedicaoObra', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ medicao_id: medicaoSemObra.id })
      });

      const dataFat = await respFat.json();
      
      if (respFat.status === 500 && dataFat.error?.includes('BLOQUEIO DE INTEGRIDADE')) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Medição sem obra → bloqueado', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Medição sem obra foi faturada');
      }

      await base44.asServiceRole.entities.MedicaoObra.delete(medicaoSemObra.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Medição sem obra → bloqueado', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 4: Verificar logs de bloqueio
    // ========================================
    try {
      resultados.testes_executados++;
      
      const logs = await base44.entities.LogIntegridadeSistema.list('-created_date', 10);
      
      if (logs.length > 0) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Logs de bloqueio registrados', 
          resultado: 'PASSOU',
          total_bloqueios: logs.length
        });
      } else {
        throw new Error('Nenhum log de bloqueio encontrado');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Logs de bloqueio registrados', 
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