import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automatizados do módulo de medição
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
      nome: 'Obra Teste Medição',
      cliente: 'Cliente Teste',
      cliente_id: 'cli-test-001'
    });

    // ========================================
    // TESTE 1: Medição sem obra_id deve falhar
    // ========================================
    try {
      resultados.testes_executados++;
      
      const medicaoSemObra = await base44.asServiceRole.entities.MedicaoObra.create({
        numero: 'MED-TEST-001',
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        valor_total: 10000,
        status: 'rascunho'
        // obra_id propositalmente omitido
      });

      // Se criou, tentar aprovar
      const respAprov = await fetch(req.headers.get('origin') + '/api/functions/aprovarMedicaoObra', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ medicao_id: medicaoSemObra.id })
      });

      if (respAprov.status === 400) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Medição sem obra_id deve falhar', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Medição sem obra foi aprovada incorretamente');
      }

      await base44.asServiceRole.entities.MedicaoObra.delete(medicaoSemObra.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Medição sem obra_id deve falhar', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 2: Medição aprovada gera conta a receber
    // ========================================
    try {
      resultados.testes_executados++;
      
      const medicao = await base44.asServiceRole.entities.MedicaoObra.create({
        obra_id: obra.id,
        numero: 'MED-TEST-002',
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        valor_total: 50000,
        status: 'rascunho'
      });

      // Aprovar medição
      const respAprov = await fetch(req.headers.get('origin') + '/api/functions/aprovarMedicaoObra', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ medicao_id: medicao.id })
      });

      const dataAprov = await respAprov.json();
      
      if (dataAprov.success && dataAprov.faturamento?.conta_financeira_id) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Medição aprovada gera conta a receber', 
          resultado: 'PASSOU',
          conta_id: dataAprov.faturamento.conta_financeira_id
        });
      } else {
        throw new Error('Conta a receber não foi criada');
      }

      await base44.asServiceRole.entities.MedicaoObra.delete(medicao.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Medição aprovada gera conta a receber', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 3: Não duplica faturamento
    // ========================================
    try {
      resultados.testes_executados++;
      
      const medicao = await base44.asServiceRole.entities.MedicaoObra.create({
        obra_id: obra.id,
        numero: 'MED-TEST-003',
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        valor_total: 30000,
        status: 'rascunho'
      });

      // Aprovar primeira vez
      await fetch(req.headers.get('origin') + '/api/functions/aprovarMedicaoObra', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ medicao_id: medicao.id })
      });

      // Tentar faturar segunda vez (direto)
      const respDup = await fetch(req.headers.get('origin') + '/api/functions/gerarContaReceberMedicaoObra', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ medicao_id: medicao.id })
      });

      const dataDup = await respDup.json();
      
      if (dataDup.duplicado === true) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Não duplica faturamento', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Faturamento foi duplicado');
      }

      await base44.asServiceRole.entities.MedicaoObra.delete(medicao.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Não duplica faturamento', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 4: Receita entra no KPI
    // ========================================
    try {
      resultados.testes_executados++;
      
      const medicao = await base44.asServiceRole.entities.MedicaoObra.create({
        obra_id: obra.id,
        numero: 'MED-TEST-004',
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        valor_total: 75000,
        status: 'rascunho'
      });

      // Aprovar
      await fetch(req.headers.get('origin') + '/api/functions/aprovarMedicaoObra', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ medicao_id: medicao.id })
      });

      // Buscar KPIs
      const respKPI = await fetch(req.headers.get('origin') + '/api/functions/getKpisObraPlanejadoReal', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({ obra_id: obra.id })
      });

      const dataKPI = await respKPI.json();
      
      if (dataKPI.receita_realizada >= 75000) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Receita entra no KPI', 
          resultado: 'PASSOU',
          receita_kpi: dataKPI.receita_realizada
        });
      } else {
        throw new Error(`Receita no KPI incorreta: ${dataKPI.receita_realizada}`);
      }

      await base44.asServiceRole.entities.MedicaoObra.delete(medicao.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Receita entra no KPI', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // Limpar
    await base44.asServiceRole.entities.Obra.delete(obra.id);

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