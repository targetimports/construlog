import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { FunctionLogger } from './_shared/logger.js';

/**
 * Monitor de Integridade do Sistema
 * Verifica:
 * - Estoque negativo
 * - Medição consumindo mais que estoque
 * - Contas pagas sem conciliação
 * - Ordens aprovadas sem recebimento
 * - Entidades órfãs
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('monitorIntegridadeSistema', base44);

  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      await logger.unauthorized(user, {});
      return Response.json({ ok: false, code: 'FORBIDDEN', message: 'Apenas admins' }, { status: 403 });
    }

    const relatorio = {
      timestamp: new Date().toISOString(),
      inconsistencias: {
        estoque_negativo: [],
        medicacao_acima_estoque: [],
        contas_pagas_nao_conciliadas: [],
        ordens_aprovadas_sem_recebimento: [],
        entidades_orfas: []
      },
      resumo: {
        total_problemas: 0,
        total_verificacoes: 5
      }
    };

    try {
      // ✅ 1. ESTOQUE NEGATIVO
      console.log('[monitorIntegridadeSistema] Verificando estoque negativo...');
      const saldosNegativos = await base44.asServiceRole.entities.SaldoEstoque.filter({}).catch(() => []);
      relatorio.inconsistencias.estoque_negativo = saldosNegativos
        .filter(s => s.saldo < 0)
        .map(s => ({
          material_id: s.material_id,
          deposito_id: s.deposito_id,
          saldo: s.saldo,
          descricao: `Material ${s.material_id} com saldo negativo de ${s.saldo} unidades`
        }));
    } catch (err) {
      console.warn('[monitorIntegridadeSistema] Erro ao verificar estoque:', err.message);
    }

    try {
      // ✅ 2. MEDICAÇÃO ACIMA DO ESTOQUE
      console.log('[monitorIntegridadeSistema] Verificando medicações acima do estoque...');
      const medicoes = await base44.asServiceRole.entities.Medicao.filter({}).catch(() => []);
      const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({}).catch(() => []);
      
      const mapSaldos = {};
      saldos.forEach(s => {
        const key = `${s.material_id}-${s.deposito_id}`;
        mapSaldos[key] = s.saldo || 0;
      });

      for (const med of medicoes) {
        if (med.itens && Array.isArray(med.itens)) {
          for (const item of med.itens) {
            const key = `${item.insumo_id}-${med.deposito_id}`;
            const saldoDisponivel = mapSaldos[key] || 0;
            const consumido = item.quantidade_mediada || 0;

            if (consumido > saldoDisponivel) {
              relatorio.inconsistencias.medicacao_acima_estoque.push({
                medicao_id: med.id,
                insumo_id: item.insumo_id,
                consumido,
                saldo_disponivel: saldoDisponivel,
                excesso: consumido - saldoDisponivel,
                descricao: `Medição ${med.id} consumiu ${consumido} mas tinha apenas ${saldoDisponivel} em estoque`
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[monitorIntegridadeSistema] Erro ao verificar medicações:', err.message);
    }

    try {
      // ✅ 3. CONTAS PAGAS SEM CONCILIAÇÃO
      console.log('[monitorIntegridadeSistema] Verificando contas pagas sem conciliação...');
      const contasPagas = await base44.asServiceRole.entities.ContaFinanceira.filter({
        status: 'pago'
      }).catch(() => []);

      relatorio.inconsistencias.contas_pagas_nao_conciliadas = contasPagas
        .filter(c => c.status === 'pago' && (!c.conciliada || c.conciliada === false))
        .map(c => ({
          conta_id: c.id,
          valor: c.valor,
          data_pagamento: c.data_pagamento,
          descricao: `Conta ${c.id} paga em ${c.data_pagamento} mas não conciliada`
        }));
    } catch (err) {
      console.warn('[monitorIntegridadeSistema] Erro ao verificar contas:', err.message);
    }

    try {
      // ✅ 4. ORDENS APROVADAS SEM RECEBIMENTO
      console.log('[monitorIntegridadeSistema] Verificando ordens aprovadas sem recebimento...');
      const ordensAprovadas = await base44.asServiceRole.entities.OrdemCompra.filter({
        status: 'aprovado'
      }).catch(() => []);

      const recebimentos = await base44.asServiceRole.entities.RecebimentoMaterial.filter({}).catch(() => []);
      const ordemComRecebimento = new Set(recebimentos.map(r => r.ordem_compra_id));

      relatorio.inconsistencias.ordens_aprovadas_sem_recebimento = ordensAprovadas
        .filter(oc => !ordemComRecebimento.has(oc.id))
        .map(oc => ({
          ordem_id: oc.id,
          data_aprovacao: oc.data_aprovacao,
          valor: oc.valor_total,
          descricao: `Ordem ${oc.id} aprovada em ${oc.data_aprovacao} mas sem recebimento registrado`
        }));
    } catch (err) {
      console.warn('[monitorIntegridadeSistema] Erro ao verificar ordens:', err.message);
    }

    try {
      // ✅ 5. ENTIDADES ÓRFÃS
      console.log('[monitorIntegridadeSistema] Verificando entidades órfãs...');
      const orfas = {
        medicoes_sem_obra: [],
        recebimentos_sem_oc: [],
        movimentacoes_sem_deposito: [],
        medida_sem_medicao: []
      };

      // Medições sem obra
      const medicoes = await base44.asServiceRole.entities.Medicao.filter({}).catch(() => []);
      const obras = await base44.asServiceRole.entities.Obra.filter({}).catch(() => []);
      const obraIds = new Set(obras.map(o => o.id));

      medicoes.forEach(m => {
        if (m.obra_id && !obraIds.has(m.obra_id)) {
          orfas.medicoes_sem_obra.push({
            medicao_id: m.id,
            obra_id: m.obra_id,
            descricao: `Medição ${m.id} referencia obra ${m.obra_id} que não existe`
          });
        }
      });

      // Recebimentos sem OC
      const recebimentos = await base44.asServiceRole.entities.RecebimentoMaterial.filter({}).catch(() => []);
      const ordens = await base44.asServiceRole.entities.OrdemCompra.filter({}).catch(() => []);
      const ocIds = new Set(ordens.map(o => o.id));

      recebimentos.forEach(r => {
        if (r.ordem_compra_id && !ocIds.has(r.ordem_compra_id)) {
          orfas.recebimentos_sem_oc.push({
            recebimento_id: r.id,
            ordem_id: r.ordem_compra_id,
            descricao: `Recebimento ${r.id} referencia OC ${r.ordem_compra_id} que não existe`
          });
        }
      });

      // Movimentações sem depósito
      const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.filter({}).catch(() => []);
      const depositos = await base44.asServiceRole.entities.Deposito.filter({}).catch(() => []);
      const depositoIds = new Set(depositos.map(d => d.id));

      movimentacoes.forEach(m => {
        if (m.deposito_id && !depositoIds.has(m.deposito_id)) {
          orfas.movimentacoes_sem_deposito.push({
            movimentacao_id: m.id,
            deposito_id: m.deposito_id,
            descricao: `Movimentação ${m.id} referencia depósito ${m.deposito_id} que não existe`
          });
        }
      });

      relatorio.inconsistencias.entidades_orfas = orfas;
    } catch (err) {
      console.warn('[monitorIntegridadeSistema] Erro ao verificar órfãs:', err.message);
    }

    // Contar total de problemas
    relatorio.resumo.total_problemas = 
      relatorio.inconsistencias.estoque_negativo.length +
      relatorio.inconsistencias.medicacao_acima_estoque.length +
      relatorio.inconsistencias.contas_pagas_nao_conciliadas.length +
      relatorio.inconsistencias.ordens_aprovadas_sem_recebimento.length +
      (Object.values(relatorio.inconsistencias.entidades_orfas).reduce((sum, arr) => sum + arr.length, 0) || 0);

    relatorio.resumo.severity = 
      relatorio.resumo.total_problemas === 0 ? 'OK' :
      relatorio.resumo.total_problemas < 5 ? 'AVISO' :
      relatorio.resumo.total_problemas < 20 ? 'ALERTA' : 'CRÍTICO';

    await logger.success(user, {}, relatorio, {
      total_problemas: relatorio.resumo.total_problemas,
      severity: relatorio.resumo.severity
    });

    return Response.json({
      ok: true,
      relatorio
    });
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, {}, error, 'UNHANDLED_ERROR');
    return Response.json({ ok: false, code: 'ERROR', message: error.message }, { status: 500 });
  }
});