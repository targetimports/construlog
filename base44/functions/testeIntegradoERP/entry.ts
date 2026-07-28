import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TESTE INTEGRADO PONTA-A-PONTA ERP DE CONSTRUTORA
 * Valida: NF → Estoque → Consumo → MO → Medição → Alçadas → Auditoria → KPIs/DRE
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Somente admins podem executar testes' }, { status: 403 });
    }

    const falhas = [];
    const logs = [];
    const ids_criados = {
      obra: null,
      fornecedor: null,
      cliente: null,
      insumo: null,
      deposito: null,
      nf: null,
      conta_pagar: null,
      movimentacao_estoque: null,
      apontamento: null,
      medicao: null,
      conta_receber: null
    };

    logs.push('🚀 INICIANDO TESTE INTEGRADO ERP');

    // ========================================
    // SETUP: Criar dados base
    // ========================================
    try {
      logs.push('📦 SETUP: Criando dados base...');
      
      ids_criados.obra = (await base44.asServiceRole.entities.Obra.create({
        nome: 'Obra Teste ERP Integrado',
        codigo: 'ERP-TEST-001',
        cliente: 'Cliente Teste ERP',
        status: 'em_andamento'
      })).id;

      ids_criados.fornecedor = (await base44.asServiceRole.entities.Fornecedor.create({
        nome: 'Fornecedor Teste ERP',
        cnpj: '00000000000000',
        tipo: 'material'
      })).id;

      ids_criados.cliente = (await base44.asServiceRole.entities.Cliente.create({
        nome: 'Cliente Teste ERP',
        cnpj: '11111111111111'
      })).id;

      ids_criados.insumo = (await base44.asServiceRole.entities.Insumo.create({
        codigo: 'ERP-MAT-001',
        descricao: 'Cimento Teste ERP',
        unidade: 'SC',
        preco_unitario: 35.00
      })).id;

      ids_criados.deposito = (await base44.asServiceRole.entities.Almoxarifado.create({
        nome: 'Depósito Teste ERP',
        tipo: 'central'
      })).id;

      logs.push('✅ SETUP concluído');

    } catch (error) {
      falhas.push({ etapa: 'SETUP', erro: error.message });
      logs.push(`❌ SETUP falhou: ${error.message}`);
    }

    // ========================================
    // ETAPA A: NF MATERIAL
    // ========================================
    try {
      logs.push('📄 ETAPA A: Processando NF Material...');
      
      const respNF = await base44.functions.invoke('processarNotaFiscalCompleta', {
        nf_id: 'NF-ERP-TEST-001',
        chave_nf: 'CHAVE-ERP-TEST-001',
        numero_nf: 'NF-ERP-001',
        fornecedor_id: ids_criados.fornecedor,
        obra_id: ids_criados.obra,
        centro_custo_id: 'CC-PRINCIPAL',
        data_emissao: new Date().toISOString(),
        data_vencimento: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        valor_total: 3500.00,
        deposito_destino_id: ids_criados.deposito,
        itens: [
          {
            tipo: 'material',
            insumo_id: ids_criados.insumo,
            codigo: 'ERP-MAT-001',
            descricao: 'Cimento Teste ERP',
            unidade: 'SC',
            quantidade: 100,
            valor_unitario: 35.00
          }
        ]
      });

      if (respNF.data.success) {
        ids_criados.conta_pagar = respNF.data.conta_pagar_id;
        ids_criados.nf = 'NF-ERP-TEST-001';
        logs.push(`✅ NF processada - Conta Pagar: ${ids_criados.conta_pagar}`);
        logs.push(`✅ Movimentações estoque: ${respNF.data.movimentacoes_geradas}`);
        
        // Validar saldo
        const saldos = await base44.entities.SaldoEstoque.filter({
          insumo_id: ids_criados.insumo,
          deposito_id: ids_criados.deposito
        });
        
        if (saldos[0]?.quantidade !== 100) {
          falhas.push({ etapa: 'ETAPA A', erro: 'Saldo estoque incorreto' });
          logs.push('❌ Saldo estoque incorreto');
        } else {
          logs.push('✅ Saldo estoque validado: 100 SC');
        }
      } else {
        throw new Error(respNF.data.error || 'NF não processada');
      }

    } catch (error) {
      falhas.push({ etapa: 'ETAPA A - NF', erro: error.message });
      logs.push(`❌ ETAPA A falhou: ${error.message}`);
    }

    // ========================================
    // ETAPA B: CONSUMO ESTOQUE
    // ========================================
    try {
      logs.push('🔧 ETAPA B: Consumindo estoque na obra...');
      
      const respConsumo = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'saida_consumo',
        insumo_id: ids_criados.insumo,
        quantidade: 50,
        deposito_origem_id: ids_criados.deposito,
        obra_id: ids_criados.obra,
        centro_custo_id: 'CC-PRINCIPAL',
        referencia_tipo: 'manual',
        observacao: 'Consumo teste ERP'
      });

      if (respConsumo.data.success) {
        ids_criados.movimentacao_estoque = respConsumo.data.movimentacao.id;
        logs.push(`✅ Consumo registrado - Saldo novo: ${respConsumo.data.saldo_atualizado.quantidade}`);
        
        if (respConsumo.data.saldo_atualizado.quantidade !== 50) {
          falhas.push({ etapa: 'ETAPA B', erro: 'Saldo após consumo incorreto' });
        }
      } else {
        throw new Error(respConsumo.data.error || 'Consumo falhou');
      }

    } catch (error) {
      falhas.push({ etapa: 'ETAPA B - CONSUMO', erro: error.message });
      logs.push(`❌ ETAPA B falhou: ${error.message}`);
    }

    // ========================================
    // ETAPA C: APONTAMENTO MÃO DE OBRA
    // ========================================
    try {
      logs.push('👷 ETAPA C: Lançando apontamento de horas...');
      
      ids_criados.apontamento = (await base44.asServiceRole.entities.ApontamentoHora.create({
        obra_id: ids_criados.obra,
        colaborador_id: 'COL-TEST-001',
        nome_colaborador: 'Colaborador Teste',
        data: new Date().toISOString().split('T')[0],
        horas_trabalhadas: 8,
        custo_hora: 25.00,
        custo_total: 200.00,
        status: 'aprovado'
      })).id;

      logs.push('✅ Apontamento criado e aprovado');

    } catch (error) {
      falhas.push({ etapa: 'ETAPA C - APONTAMENTO', erro: error.message });
      logs.push(`❌ ETAPA C falhou: ${error.message}`);
    }

    // ========================================
    // ETAPA D: MEDIÇÃO
    // ========================================
    try {
      logs.push('📊 ETAPA D: Criando e aprovando medição...');
      
      ids_criados.medicao = (await base44.asServiceRole.entities.MedicaoObra.create({
        obra_id: ids_criados.obra,
        numero: 'MED-ERP-001',
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        valor_total: 10000.00,
        status: 'rascunho'
      })).id;

      // Aprovar medição (dispara faturamento automático)
      const respAprov = await base44.functions.invoke('aprovarMedicaoObra', {
        medicao_id: ids_criados.medicao
      });

      if (respAprov.data.success) {
        ids_criados.conta_receber = respAprov.data.faturamento.conta_financeira_id;
        logs.push(`✅ Medição aprovada e faturada - Conta Receber: ${ids_criados.conta_receber}`);
      } else {
        throw new Error(respAprov.data.error || 'Aprovação falhou');
      }

    } catch (error) {
      falhas.push({ etapa: 'ETAPA D - MEDIÇÃO', erro: error.message });
      logs.push(`❌ ETAPA D falhou: ${error.message}`);
    }

    // ========================================
    // ETAPA E: ALÇADA
    // ========================================
    try {
      logs.push('🔐 ETAPA E: Testando alçada de aprovação...');
      
      // Criar alçada teste
      const alcada = await base44.asServiceRole.entities.AlcadaAprovacao.create({
        tipo_operacao: 'conta_pagar',
        valor_min: 5000,
        valor_max: null,
        perfil_aprovador: 'diretor',
        ordem_nivel: 1,
        ativo: true
      });

      // Avaliar alçada para valor alto
      const respAlcada = await base44.functions.invoke('avaliarAlcada', {
        tipo_operacao: 'conta_pagar',
        referencia_id: 'CP-ERP-HIGH',
        valor: 15000,
        obra_id: ids_criados.obra
      });

      if (respAlcada.data.requer_aprovacao) {
        logs.push('✅ Alçada requer aprovação para valor alto');
        
        // Verificar bloqueio
        const respVerif = await base44.functions.invoke('verificarAprovacaoPendente', {
          tipo_operacao: 'conta_pagar',
          referencia_id: 'CP-ERP-HIGH'
        });

        if (!respVerif.data.pode_prosseguir) {
          logs.push('✅ Operação bloqueada antes da aprovação');
          
          // Aprovar
          const respAprovAlcada = await base44.functions.invoke('processarAprovacaoAlcada', {
            aprovacao_id: respAlcada.data.aprovacao_id,
            acao: 'aprovar',
            observacao: 'Teste ERP'
          });

          if (respAprovAlcada.data.success) {
            logs.push('✅ Aprovação processada com sucesso');
          }
        } else {
          falhas.push({ etapa: 'ETAPA E', erro: 'Operação não foi bloqueada' });
        }
      } else {
        falhas.push({ etapa: 'ETAPA E', erro: 'Alçada não foi acionada' });
      }

      await base44.asServiceRole.entities.AlcadaAprovacao.delete(alcada.id);

    } catch (error) {
      falhas.push({ etapa: 'ETAPA E - ALÇADA', erro: error.message });
      logs.push(`❌ ETAPA E falhou: ${error.message}`);
    }

    // ========================================
    // ETAPA F: VALIDADOR (esperar erro)
    // ========================================
    try {
      logs.push('🛡️ ETAPA F: Testando validador de integridade...');
      
      const respInvalido = await base44.functions.invoke('processarNotaFiscalCompleta', {
        nf_id: 'NF-INVALID',
        chave_nf: 'INVALID-KEY',
        numero_nf: 'NF-INVALID',
        fornecedor_id: ids_criados.fornecedor,
        // obra_id propositalmente omitido
        centro_custo_id: 'CC-001',
        valor_total: 1000,
        itens: [{ tipo: 'servico', descricao: 'Teste', quantidade: 1, valor_unitario: 1000 }]
      });

      // Se chegou aqui, deveria ter falhado
      falhas.push({ etapa: 'ETAPA F', erro: 'Validador não bloqueou operação sem obra' });
      logs.push('❌ Validador não bloqueou');

    } catch (error) {
      // Esperado falhar
      if (error.message.includes('BLOQUEIO DE INTEGRIDADE') || error.data?.error?.includes('obra_id')) {
        logs.push('✅ Validador bloqueou operação sem obra corretamente');
      } else {
        falhas.push({ etapa: 'ETAPA F', erro: 'Erro inesperado: ' + error.message });
        logs.push(`⚠️ Erro inesperado: ${error.message}`);
      }
    }

    // ========================================
    // ETAPA G: AUDITORIA
    // ========================================
    try {
      logs.push('📋 ETAPA G: Verificando auditoria...');
      
      const logsAuditoria = await base44.entities.LogAuditoriaSistema.filter({
        obra_id: ids_criados.obra
      });

      if (logsAuditoria.length >= 3) {
        logs.push(`✅ Auditoria registrou ${logsAuditoria.length} eventos`);
      } else {
        falhas.push({ etapa: 'ETAPA G', erro: `Apenas ${logsAuditoria.length} eventos auditados` });
        logs.push(`⚠️ Poucos eventos auditados: ${logsAuditoria.length}`);
      }

    } catch (error) {
      falhas.push({ etapa: 'ETAPA G - AUDITORIA', erro: error.message });
      logs.push(`❌ ETAPA G falhou: ${error.message}`);
    }

    // ========================================
    // VALIDAÇÃO: KPIs
    // ========================================
    try {
      logs.push('📈 VALIDAÇÃO: Verificando KPIs da obra...');
      
      const respKPI = await base44.functions.invoke('getKpisObraPlanejadoReal', {
        obra_id: ids_criados.obra
      });

      const kpis = respKPI.data;
      
      logs.push(`💰 Custo Material: R$ ${kpis.real_materiais?.toFixed(2) || 0}`);
      logs.push(`👷 Custo Mão Obra: R$ ${kpis.real_mao_obra?.toFixed(2) || 0}`);
      logs.push(`💵 Receita Realizada: R$ ${kpis.receita_realizada?.toFixed(2) || 0}`);

      if (kpis.real_materiais > 0) {
        logs.push('✅ KPI custo material > 0');
      } else {
        falhas.push({ etapa: 'KPI', erro: 'Custo material zerado' });
      }

      if (kpis.receita_realizada > 0) {
        logs.push('✅ KPI receita > 0');
      } else {
        falhas.push({ etapa: 'KPI', erro: 'Receita zerada' });
      }

    } catch (error) {
      falhas.push({ etapa: 'VALIDAÇÃO KPI', erro: error.message });
      logs.push(`❌ KPI falhou: ${error.message}`);
    }

    // ========================================
    // VALIDAÇÃO: DRE
    // ========================================
    try {
      logs.push('📊 VALIDAÇÃO: Verificando DRE da obra...');
      
      const respDRE = await base44.functions.invoke('getDreObra', {
        obra_id: ids_criados.obra
      });

      const dre = respDRE.data;
      
      logs.push(`💰 DRE Materiais: R$ ${dre.custos?.materiais?.toFixed(2) || 0}`);
      logs.push(`💵 DRE Receita: R$ ${dre.receita_realizada?.toFixed(2) || 0}`);
      logs.push(`📊 DRE Margem: R$ ${dre.margem_bruta?.toFixed(2) || 0} (${dre.margem_percentual?.toFixed(1) || 0}%)`);

      if (dre.custos?.materiais > 0) {
        logs.push('✅ DRE custo > 0');
      } else {
        falhas.push({ etapa: 'DRE', erro: 'DRE custo zerado' });
      }

      if (dre.receita_realizada > 0) {
        logs.push('✅ DRE receita > 0');
      } else {
        falhas.push({ etapa: 'DRE', erro: 'DRE receita zerada' });
      }

    } catch (error) {
      falhas.push({ etapa: 'VALIDAÇÃO DRE', erro: error.message });
      logs.push(`❌ DRE falhou: ${error.message}`);
    }

    // ========================================
    // LIMPEZA: Remover dados de teste
    // ========================================
    try {
      logs.push('🧹 LIMPEZA: Removendo dados de teste...');
      
      if (ids_criados.medicao) await base44.asServiceRole.entities.MedicaoObra.delete(ids_criados.medicao);
      if (ids_criados.apontamento) await base44.asServiceRole.entities.ApontamentoHora.delete(ids_criados.apontamento);
      if (ids_criados.obra) await base44.asServiceRole.entities.Obra.delete(ids_criados.obra);
      if (ids_criados.fornecedor) await base44.asServiceRole.entities.Fornecedor.delete(ids_criados.fornecedor);
      if (ids_criados.cliente) await base44.asServiceRole.entities.Cliente.delete(ids_criados.cliente);
      if (ids_criados.insumo) await base44.asServiceRole.entities.Insumo.delete(ids_criados.insumo);
      if (ids_criados.deposito) await base44.asServiceRole.entities.Almoxarifado.delete(ids_criados.deposito);

      logs.push('✅ Limpeza concluída');

    } catch (error) {
      logs.push(`⚠️ Erro na limpeza: ${error.message}`);
    }

    // ========================================
    // RESULTADO FINAL
    // ========================================

    const sucesso = falhas.length === 0;

    return Response.json({
      sucesso,
      total_falhas: falhas.length,
      falhas,
      logs,
      resumo: {
        etapas_testadas: ['NF Material', 'Consumo Estoque', 'Apontamento MO', 'Medição', 'Alçadas', 'Validador', 'Auditoria', 'KPIs', 'DRE'],
        etapas_sucesso: 9 - falhas.length,
        etapas_falha: falhas.length
      },
      ids_criados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no teste integrado:', error);
    return Response.json({ 
      sucesso: false,
      error: error.message,
      logs: logs || []
    }, { status: 500 });
  }
});