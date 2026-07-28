import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automatizados para processarMovimentacaoEstoque.
 * 
 * Requer admin logado. Todas as operações de dados usam asServiceRole.
 * A chamada ao processarMovimentacaoEstoque é feita via asServiceRole.functions
 * para que herde o contexto de autenticação do caller (admin).
 * 
 * Cenários:
 * 1) Transferência Central→Obra NÃO cria MovimentacaoTesouraria
 * 2) Transferência move saldo e fixa custo_unitario_aplicado
 * 3) Estorno reverte saldos e mantém original PROCESSADA
 * 4) Duplo estorno é rejeitado (idempotência)
 */
Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    
    // Autenticação: exigir admin/programador logado
    let user;
    try {
      user = await base44.auth.me();
    } catch (authErr) {
      return Response.json({ 
        error: 'Autenticação necessária. Execute esta função a partir da página Ferramentas Admin.',
        hint: 'Faça login como admin e use a UI para executar os testes.'
      }, { status: 401 });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'programador')) {
      return Response.json({ 
        error: 'Acesso restrito a administradores e programadores.',
        user_role: user?.role 
      }, { status: 403 });
    }

    console.log(`[TEST_ESTOQUE] Iniciado por ${user.email} (${user.role}) em ${new Date().toISOString()}`);

    const results = [];
    const fail = (name, msg) => { 
      results.push({ test: name, status: 'FAIL', message: msg });
      console.log(`[TEST_ESTOQUE] FAIL: ${name} - ${msg}`);
    };
    const pass = (name, msg) => { 
      results.push({ test: name, status: 'PASS', message: msg || 'OK' });
      console.log(`[TEST_ESTOQUE] PASS: ${name}`);
    };

    // Todas as operações de setup/cleanup usam asServiceRole
    const svc = base44.asServiceRole;

    // ─── Setup: criar dados de teste ───
    const centralTest = await svc.entities.LocalEstoque.create({
      tipo: 'CENTRAL', nome: '_TEST_Central_Mov', empresa_id: 'TEST', ativo: true
    });
    const obraTest = await svc.entities.LocalEstoque.create({
      tipo: 'OBRA', nome: '_TEST_Obra_Mov', empresa_id: 'TEST', ativo: true
    });
    const matTest = await svc.entities.Material.create({
      nome: '_TEST_Material_Mov', unidade: 'UN', ativo: true
    });

    // Saldo inicial no central: 100 un a R$10
    await svc.entities.SaldoEstoque.create({
      local_estoque_id: centralTest.id,
      material_id: matTest.id,
      material_nome: '_TEST_Material_Mov',
      material_unidade: 'UN',
      saldo_atual: 100,
      custo_unitario_medio: 10,
      valor_total_estoque: 1000
    });

    // Contar MovimentacaoTesouraria ANTES
    const tesBefore = await svc.entities.MovimentacaoTesouraria.list('-created_date', 1);
    const tesCountBefore = tesBefore.length;

    // ═══════════════════════════════════════════
    // TESTE 1: Transferência Central→Obra
    // Usa base44.functions.invoke (com token do admin logado)
    // ═══════════════════════════════════════════
    let movTransfId = null;
    try {
      const respTransf = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'TRANSFERENCIA',
        almox_origem_id: centralTest.id,
        almox_destino_id: obraTest.id,
        observacao: 'Teste transferência sem caixa',
        itens: [{
          material_id: matTest.id,
          material_nome: '_TEST_Material_Mov',
          material_unidade: 'UN',
          qtd: 25,
          custo_unit: 10
        }]
      });

      if (!respTransf.data?.success) {
        fail('1_TRANSFERENCIA', `Falhou: ${respTransf.data?.error || JSON.stringify(respTransf.data)}`);
      } else {
        pass('1_TRANSFERENCIA_CRIADA', `mov_id=${respTransf.data.movimentacao_id}`);
        movTransfId = respTransf.data.movimentacao_id;
      }
    } catch (invErr) {
      fail('1_TRANSFERENCIA', `Exceção: ${invErr.message}`);
    }

    // Verificar saldos
    const saldoCentral = await svc.entities.SaldoEstoque.filter({
      local_estoque_id: centralTest.id, material_id: matTest.id
    });
    const saldoObra = await svc.entities.SaldoEstoque.filter({
      local_estoque_id: obraTest.id, material_id: matTest.id
    });

    if ((saldoCentral[0]?.saldo_atual ?? -1) === 75) {
      pass('1_SALDO_CENTRAL', 'Central: 100 → 75 ✓');
    } else {
      fail('1_SALDO_CENTRAL', `Esperado 75, obtido ${saldoCentral[0]?.saldo_atual}`);
    }

    if ((saldoObra[0]?.saldo_atual ?? -1) === 25) {
      pass('1_SALDO_OBRA', 'Obra: 0 → 25 ✓');
    } else {
      fail('1_SALDO_OBRA', `Esperado 25, obtido ${saldoObra[0]?.saldo_atual}`);
    }

    // Verificar custo_unitario_aplicado congelado e trilha de auditoria
    if (movTransfId) {
      const itensTransf = await svc.entities.EstoqueMovimentacaoItem.filter({
        movimentacao_id: movTransfId
      });
      const item0 = itensTransf[0];
      
      if (item0?.custo_unitario_aplicado === 10) {
        pass('2_CUSTO_CONGELADO', 'custo_unitario_aplicado=10 ✓');
      } else {
        fail('2_CUSTO_CONGELADO', `Esperado 10, obtido ${item0?.custo_unitario_aplicado}`);
      }

      if (item0?.saldo_antes_origem === 100 && item0?.saldo_depois_origem === 75) {
        pass('2_AUDIT_ORIGEM', 'Origem: 100→75 ✓');
      } else {
        fail('2_AUDIT_ORIGEM', `antes=${item0?.saldo_antes_origem} depois=${item0?.saldo_depois_origem}`);
      }

      if (item0?.saldo_antes_destino === 0 && item0?.saldo_depois_destino === 25) {
        pass('2_AUDIT_DESTINO', 'Destino: 0→25 ✓');
      } else {
        fail('2_AUDIT_DESTINO', `antes=${item0?.saldo_antes_destino} depois=${item0?.saldo_depois_destino}`);
      }
    }

    // Verificar ZERO MovimentacaoTesouraria
    const tesAfter = await svc.entities.MovimentacaoTesouraria.list('-created_date', 1);
    if (tesAfter.length === tesCountBefore) {
      pass('1_ZERO_TESOURARIA', 'Transferência NÃO criou MovimentacaoTesouraria ✓');
    } else {
      fail('1_ZERO_TESOURARIA', `Tesouraria teve ${tesAfter.length - tesCountBefore} novas movimentações!`);
    }

    // ═══════════════════════════════════════════
    // TESTE 3: Estorno da transferência
    // ═══════════════════════════════════════════
    if (movTransfId) {
      try {
        const respEstorno = await base44.functions.invoke('processarMovimentacaoEstoque', {
          action: 'estornar',
          movimentacao_id: movTransfId,
          motivo: 'Teste estorno automatizado'
        });

        if (!respEstorno.data?.success) {
          fail('3_ESTORNO', `Falhou: ${respEstorno.data?.error}`);
        } else {
          pass('3_ESTORNO_CRIADO', `estorno_id=${respEstorno.data.estorno_id}`);

          if (respEstorno.data.movimentacao_original_status === 'PROCESSADA') {
            pass('3_ORIGINAL_PROCESSADA', 'Original permanece PROCESSADA ✓');
          } else {
            fail('3_ORIGINAL_PROCESSADA', `Status: ${respEstorno.data.movimentacao_original_status}`);
          }
        }
      } catch (estErr) {
        fail('3_ESTORNO', `Exceção: ${estErr.message}`);
      }

      // Verificar saldos revertidos
      const saldoCentralPos = await svc.entities.SaldoEstoque.filter({
        local_estoque_id: centralTest.id, material_id: matTest.id
      });
      const saldoObraPos = await svc.entities.SaldoEstoque.filter({
        local_estoque_id: obraTest.id, material_id: matTest.id
      });

      if ((saldoCentralPos[0]?.saldo_atual ?? -1) === 100) {
        pass('3_SALDO_REVERTIDO_CENTRAL', 'Central voltou a 100 ✓');
      } else {
        fail('3_SALDO_REVERTIDO_CENTRAL', `Esperado 100, obtido ${saldoCentralPos[0]?.saldo_atual}`);
      }

      if ((saldoObraPos[0]?.saldo_atual ?? -1) === 0) {
        pass('3_SALDO_REVERTIDO_OBRA', 'Obra voltou a 0 ✓');
      } else {
        fail('3_SALDO_REVERTIDO_OBRA', `Esperado 0, obtido ${saldoObraPos[0]?.saldo_atual}`);
      }

      // Verificar metadados de estorno na original
      const movOrigCheck = await svc.entities.EstoqueMovimentacao.filter({ id: movTransfId });
      const orig = movOrigCheck[0];
      if (orig?.estornado_por_id && orig?.estornado_em && orig?.status === 'PROCESSADA') {
        pass('3_METADADOS_ESTORNO', `estornado_por_id=${orig.estornado_por_id}, status=PROCESSADA ✓`);
      } else {
        fail('3_METADADOS_ESTORNO', `status=${orig?.status}, estornado_por_id=${orig?.estornado_por_id}`);
      }

      // Estorno não cria tesouraria
      const tesAfterEstorno = await svc.entities.MovimentacaoTesouraria.list('-created_date', 1);
      if (tesAfterEstorno.length === tesCountBefore) {
        pass('3_ZERO_TESOURARIA_ESTORNO', 'Estorno NÃO criou MovimentacaoTesouraria ✓');
      } else {
        fail('3_ZERO_TESOURARIA_ESTORNO', 'Tesouraria teve novas movimentações no estorno!');
      }

      // ═══════════════════════════════════════════
      // TESTE 4: Duplo estorno (idempotência)
      // ═══════════════════════════════════════════
      try {
        const respDuplo = await base44.functions.invoke('processarMovimentacaoEstoque', {
          action: 'estornar',
          movimentacao_id: movTransfId,
          motivo: 'Tentativa dupla'
        });

        if (respDuplo.status === 409 || respDuplo.data?.error?.includes('já foi estornada')) {
          pass('4_IDEMPOTENCIA', 'Duplo estorno rejeitado ✓');
        } else {
          fail('4_IDEMPOTENCIA', `Esperado rejeição, obtido status=${respDuplo.status}`);
        }
      } catch (duploErr) {
        // Axios pode lançar para 4xx - verificar mensagem
        if (duploErr.message?.includes('409') || duploErr.message?.includes('já foi estornada')) {
          pass('4_IDEMPOTENCIA', 'Duplo estorno rejeitado (exceção 409) ✓');
        } else {
          fail('4_IDEMPOTENCIA', `Exceção inesperada: ${duploErr.message}`);
        }
      }
    }

    // ─── Cleanup ───
    try {
      const saldosClean = await svc.entities.SaldoEstoque.filter({ material_id: matTest.id });
      for (const s of saldosClean) await svc.entities.SaldoEstoque.delete(s.id);

      const movsClean = await svc.entities.EstoqueMovimentacao.filter({ empresa_id: 'TEST' });
      for (const m of movsClean) {
        const itensClean = await svc.entities.EstoqueMovimentacaoItem.filter({ movimentacao_id: m.id });
        for (const it of itensClean) await svc.entities.EstoqueMovimentacaoItem.delete(it.id);
        await svc.entities.EstoqueMovimentacao.delete(m.id);
      }

      await svc.entities.LocalEstoque.delete(centralTest.id);
      await svc.entities.LocalEstoque.delete(obraTest.id);
      await svc.entities.Material.delete(matTest.id);
    } catch (cleanErr) {
      console.warn('[CLEANUP]', cleanErr.message);
    }

    // ─── Resultado ───
    const elapsed = Date.now() - startTime;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`[TEST_ESTOQUE] Finalizado: ${passed}/${results.length} PASS, ${failed} FAIL em ${elapsed}ms`);

    // Logar resultado no sistema
    try {
      await svc.entities.AuditLog.create({
        tipo: 'TEST_ESTOQUE_V2',
        descricao: `${passed} PASS / ${failed} FAIL de ${results.length} testes (${elapsed}ms)`,
        usuario: user.email,
        data: new Date().toISOString(),
        detalhes: JSON.stringify({ results, elapsed_ms: elapsed })
      });
    } catch (_) { /* AuditLog pode não existir */ }

    return Response.json({
      resumo: `${passed} PASS / ${failed} FAIL de ${results.length} testes`,
      all_passed: failed === 0,
      elapsed_ms: elapsed,
      executado_por: user.email,
      executado_em: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('[testarMovimentacaoEstoqueV2]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});