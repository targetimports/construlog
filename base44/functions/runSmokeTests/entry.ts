/**
 * Smoke Tests - Valida funções críticas do sistema
 * 
 * Executa testes básicos em:
 * - Criar requisição de compra
 * - Criar ordem de compra
 * - Aprovar ordem de compra
 * - Receber material
 * - Transferir estoque
 * - Criar conta a pagar
 * - Conciliar pagamento
 * - Criar medição
 * - Aprovar medição
 * - Gerar KPIs
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { successResponse, errorResponse, internalErrorResponse } from './_shared/responseHandler.ts';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, status: 'PASS', duration: Date.now() - start });
    console.log(`✅ ${name} - ${Date.now() - start}ms`);
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    });
    console.error(`❌ ${name} - ${error instanceof Error ? error.message : String(error)}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Apenas admins podem rodar smoke tests', 403);
    }

    results.length = 0;

    // ============================================================
    // 1. TESTE: Criar Requisição de Compra
    // ============================================================
    await runTest('Criar Requisição de Compra', async () => {
      const obras = await base44.asServiceRole.entities.Obra.list();
      if (!obras || obras.length === 0) {
        throw new Error('Nenhuma obra encontrada para teste');
      }

      const requisicao = await base44.asServiceRole.entities.RequisicaoCompra.create({
        titulo: `[SMOKE TEST] Req ${new Date().getTime()}`,
        descricao_resumo: 'Teste automático',
        obra_id: obras[0].id,
        empresa_id: obras[0].empresa_id || 'empresa_principal',
        data_solicitacao: new Date().toISOString().split('T')[0],
        prioridade: 'normal',
        status: 'aguardando_aprovacao',
        itens: []
      });

      if (!requisicao.id) {
        throw new Error('Requisição não criada corretamente');
      }
    });

    // ============================================================
    // 2. TESTE: Criar Ordem de Compra
    // ============================================================
    await runTest('Criar Ordem de Compra', async () => {
      const obras = await base44.asServiceRole.entities.Obra.list();
      if (!obras || obras.length === 0) {
        throw new Error('Nenhuma obra encontrada para teste');
      }

      const fornecedores = await base44.asServiceRole.entities.Fornecedor.list();
      if (!fornecedores || fornecedores.length === 0) {
        throw new Error('Nenhum fornecedor encontrado para teste');
      }

      const oc = await base44.asServiceRole.entities.OrdemCompra.create({
        numero: `OC-SMOKE-${new Date().getTime()}`,
        obra_id: obras[0].id,
        fornecedor_id: fornecedores[0].id,
        fornecedor_nome: fornecedores[0].nome,
        descricao: '[SMOKE TEST] OC teste',
        itens: [],
        valor_total: 1000,
        data_emissao: new Date().toISOString().split('T')[0],
        status: 'criada',
        empresa_id: obras[0].empresa_id || 'empresa_principal'
      });

      if (!oc.id) {
        throw new Error('Ordem de compra não criada corretamente');
      }
    });

    // ============================================================
    // 3. TESTE: Aprovar Ordem de Compra
    // ============================================================
    await runTest('Aprovar Ordem de Compra', async () => {
      const ocs = await base44.asServiceRole.entities.OrdemCompra.filter(
        { status: 'criada' },
        '-created_date',
        1
      );

      if (!ocs || ocs.length === 0) {
        throw new Error('Nenhuma OC disponível para aprovação');
      }

      const ocAtualizada = await base44.asServiceRole.entities.OrdemCompra.update(ocs[0].id, {
        status: 'aprovada'
      });

      if (!ocAtualizada.id) {
        throw new Error('OC não atualizada corretamente');
      }
    });

    // ============================================================
    // 4. TESTE: Receber Material
    // ============================================================
    await runTest('Receber Material', async () => {
      const ocs = await base44.asServiceRole.entities.OrdemCompra.filter(
        { status: 'aprovada' },
        '-created_date',
        1
      );

      if (!ocs || ocs.length === 0) {
        throw new Error('Nenhuma OC aprovada para receber');
      }

      const recebimento = await base44.asServiceRole.entities.RecebimentoMaterial.create({
        ordem_compra_id: ocs[0].id,
        obra_id: ocs[0].obra_id,
        numero_nf: `NF-SMOKE-${new Date().getTime()}`,
        data_recebimento: new Date().toISOString().split('T')[0],
        quantidade_total: 10,
        valor_total: 1000,
        status: 'recebido',
        itens: []
      });

      if (!recebimento.id) {
        throw new Error('Recebimento não criado corretamente');
      }
    });

    // ============================================================
    // 5. TESTE: Transferir Estoque
    // ============================================================
    await runTest('Transferir Estoque', async () => {
      const insumosEstoque = await base44.asServiceRole.entities.SaldoEstoque.list(null, 1);

      if (!insumosEstoque || insumosEstoque.length === 0) {
        console.warn('[SMOKE] Nenhum saldo de estoque para transferência (esperado em primeiro setup)');
        return;
      }

      const movimentacao = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
        data: new Date().toISOString(),
        tipo: 'transferencia',
        insumo_id: insumosEstoque[0].insumo_id,
        quantidade: 5,
        valor_unitario: 100,
        valor_total: 500
      });

      if (!movimentacao.id) {
        throw new Error('Movimentação não criada corretamente');
      }
    });

    // ============================================================
    // 6. TESTE: Criar Conta a Pagar
    // ============================================================
    await runTest('Criar Conta a Pagar', async () => {
      const obras = await base44.asServiceRole.entities.Obra.list();
      if (!obras || obras.length === 0) {
        throw new Error('Nenhuma obra encontrada para teste');
      }

      const contaPagar = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        obra_id: obras[0].id,
        descricao: `[SMOKE TEST] Conta ${new Date().getTime()}`,
        valor: 1000,
        valor_pago: 0,
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        empresa_id: obras[0].empresa_id || 'empresa_principal'
      });

      if (!contaPagar.id) {
        throw new Error('Conta a pagar não criada corretamente');
      }
    });

    // ============================================================
    // 7. TESTE: Conciliar Pagamento
    // ============================================================
    await runTest('Conciliar Pagamento', async () => {
      const contas = await base44.asServiceRole.entities.ContaFinanceira.filter(
        { tipo: 'pagar', status: 'pendente' },
        '-created_date',
        1
      );

      if (!contas || contas.length === 0) {
        throw new Error('Nenhuma conta pendente para pagamento');
      }

      const contaAtualizada = await base44.asServiceRole.entities.ContaFinanceira.update(contas[0].id, {
        status: 'pago',
        valor_pago: contas[0].valor,
        data_pagamento: new Date().toISOString()
      });

      if (!contaAtualizada.id) {
        throw new Error('Conta não atualizada corretamente');
      }
    });

    // ============================================================
    // 8. TESTE: Criar Medição
    // ============================================================
    await runTest('Criar Medição', async () => {
      const obras = await base44.asServiceRole.entities.Obra.list();
      if (!obras || obras.length === 0) {
        throw new Error('Nenhuma obra encontrada para teste');
      }

      const medicao = await base44.asServiceRole.entities.Medicao.create({
        numero: `MED-SMOKE-${new Date().getTime()}`,
        obra_id: obras[0].id,
        mes_medicao: new Date().toISOString().substring(0, 7),
        status: 'rascunho',
        itens: [],
        empresa_id: obras[0].empresa_id || 'empresa_principal'
      });

      if (!medicao.id) {
        throw new Error('Medição não criada corretamente');
      }
    });

    // ============================================================
    // 9. TESTE: Aprovar Medição
    // ============================================================
    await runTest('Aprovar Medição', async () => {
      const medicoes = await base44.asServiceRole.entities.Medicao.filter(
        { status: 'rascunho' },
        '-created_date',
        1
      );

      if (!medicoes || medicoes.length === 0) {
        throw new Error('Nenhuma medição para aprovar');
      }

      const medicaoAprovada = await base44.asServiceRole.entities.Medicao.update(medicoes[0].id, {
        status: 'aprovada'
      });

      if (!medicaoAprovada.id) {
        throw new Error('Medição não aprovada corretamente');
      }
    });

    // ============================================================
    // 10. TESTE: Gerar KPIs Financeiros
    // ============================================================
    await runTest('Gerar KPIs Financeiros', async () => {
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

      const kpis = await base44.functions.invoke('getFinanceKPIs', {
        periodStart: inicioMes.toISOString().split('T')[0],
        periodEnd: fimMes.toISOString().split('T')[0]
      });

      if (!kpis || !kpis.data) {
        throw new Error('KPIs não gerados corretamente');
      }

      const { ok } = kpis.data;
      if (typeof ok === 'boolean' && !ok) {
        throw new Error(`KPI retornou erro: ${kpis.data.message}`);
      }
    });

    // ============================================================
    // RESULTADO FINAL
    // ============================================================
    const passou = results.filter(r => r.status === 'PASS').length;
    const falhou = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;

    console.log(`\n========== SMOKE TESTS SUMMARY ==========`);
    console.log(`✅ Passou: ${passou}/${total}`);
    console.log(`❌ Falhou: ${falhou}/${total}`);
    console.log(`⏱️  Tempo total: ${results.reduce((s, r) => s + r.duration, 0)}ms`);

    return successResponse({
      summary: { passed: passou, failed: falhou, total },
      results
    });

  } catch (error) {
    console.error('[runSmokeTests] Erro crítico:', error);
    return internalErrorResponse(error);
  }
});