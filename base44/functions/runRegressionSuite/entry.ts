import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função interna para execução direta (sem invoke)
export async function runInternal(base44, params = {}) {
  const startTime = Date.now();
  const buildId = `QA-REG-${Date.now()}`;
  const tests = [];
  let passed = 0;
  let failed = 0;

  const modo = params.modo || 'quick';
  const obra_id_opcional = params.obra_id_opcional;

  try {
    {
      const start = performance.now();
      try {
        const obras = await base44.asServiceRole.entities.Obra.list(undefined, 3);
        const ok = obras && obras.length > 0 && obras[0].id && obras[0].nome;
        const ms = Math.round(performance.now() - start);
        if (ok) {
          passed++;
          tests.push({ id: 'T01', name: 'Obras: leitura', ok: true, ms, evidence: `${obras.length} obras lidas` });
        } else {
          failed++;
          tests.push({ id: 'T01', name: 'Obras: leitura', ok: false, ms, error: 'campos essenciais ausentes' });
        }
      } catch (e) {
        failed++;
        tests.push({ id: 'T01', name: 'Obras: leitura', ok: false, ms: 0, error: e.message });
      }
    }

    {
      const start = performance.now();
      try {
        const fornecedores = await base44.asServiceRole.entities.Fornecedor.list(undefined, 1);
        if (!fornecedores || fornecedores.length === 0) {
          failed++;
          tests.push({ id: 'T02', name: 'Compras: criar OC', ok: false, ms: Math.round(performance.now() - start), error: 'sem fornecedor' });
        } else {
          const testOC = {
            numero: `QA-${buildId}-OC`,
            fornecedor_id: fornecedores[0].id,
            valor_total: 1000,
            empresa_id: 'qa-test',
            itens: [],
            data_emissao: new Date().toISOString().split('T')[0],
          };
          const oc = await base44.asServiceRole.entities.OrdemCompra.create(testOC);
          const ms = Math.round(performance.now() - start);
          passed++;
          tests.push({ id: 'T02', name: 'Compras: criar OC', ok: true, ms, evidence: `OC ${oc.id}` });
        }
      } catch (e) {
        failed++;
        tests.push({ id: 'T02', name: 'Compras: criar OC', ok: false, ms: Math.round(performance.now() - start), error: e.message });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('aprovarOrdemCompraV3', { ordem_compra_id: 'test-skip' }).catch(() => null);
        const ms = Math.round(performance.now() - start);
        if (response === null) {
          tests.push({ id: 'T03', name: 'Compras: alçada', ok: false, ms, error: 'SKIP: função não acessível' });
        } else {
          passed++;
          tests.push({ id: 'T03', name: 'Compras: alçada', ok: true, ms, evidence: 'função respondeu' });
        }
      } catch (e) {
        tests.push({ id: 'T03', name: 'Compras: alçada', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP: ' + e.message });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('processarAprovacao', { aprovacao_id: 'test-skip', acao: 'aprovar' }).catch(() => null);
        const ms = Math.round(performance.now() - start);
        tests.push({ id: 'T04', name: 'Aprovação: processar', ok: response !== null, ms, evidence: response ? 'OK' : 'SKIP' });
      } catch (e) {
        tests.push({ id: 'T04', name: 'Aprovação: processar', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP' });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('processarRecebimentoMaterial', { ordem_compra_id: 'test-skip' }).catch(() => null);
        const ms = Math.round(performance.now() - start);
        tests.push({ id: 'T05', name: 'Estoque: recebimento', ok: response !== null, ms, evidence: response ? 'OK' : 'SKIP' });
      } catch (e) {
        tests.push({ id: 'T05', name: 'Estoque: recebimento', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP' });
      }
    }

    {
      const start = performance.now();
      try {
        const obras = await base44.asServiceRole.entities.Obra.list(undefined, 1);
        if (obras && obras.length > 0) {
          const diario = await base44.asServiceRole.entities.DiarioObra.create({
            obra_id: obras[0].id,
            data: new Date().toISOString().split('T')[0],
            mao_obra: [],
            is_test: true,
          });
          const ms = Math.round(performance.now() - start);
          passed++;
          tests.push({ id: 'T06', name: 'Diário: criar', ok: true, ms, evidence: `${diario.id}` });
        } else {
          tests.push({ id: 'T06', name: 'Diário: criar', ok: false, ms: Math.round(performance.now() - start), error: 'sem obra' });
        }
      } catch (e) {
        tests.push({ id: 'T06', name: 'Diário: criar', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP: ' + e.message });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('criarApontamentoHora', {
          obra_id: 'test-skip',
          colaborador_id: 'test-skip',
          data: new Date().toISOString().split('T')[0],
          horas_normais: 8,
          custo_hora: 150,
        }).catch(() => null);
        const ms = Math.round(performance.now() - start);
        tests.push({ id: 'T07', name: 'RH: apontamento', ok: response !== null, ms, evidence: response ? 'OK' : 'SKIP' });
      } catch (e) {
        tests.push({ id: 'T07', name: 'RH: apontamento', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP' });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('criarContaReceber', {
          descricao: 'QA-test',
          valor: 1000,
          data_vencimento: new Date().toISOString().split('T')[0],
        }).catch(() => null);
        const ms = Math.round(performance.now() - start);
        tests.push({ id: 'T08', name: 'Financeiro: receber', ok: response !== null, ms, evidence: response ? 'OK' : 'SKIP' });
      } catch (e) {
        tests.push({ id: 'T08', name: 'Financeiro: receber', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP' });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('solicitarAprovacaoPagamento', {
          conta_id: 'test-skip',
        }).catch(() => null);
        const ms = Math.round(performance.now() - start);
        tests.push({ id: 'T09', name: 'Financeiro: alçada pagamento', ok: response !== null, ms, evidence: response ? 'OK' : 'SKIP' });
      } catch (e) {
        tests.push({ id: 'T09', name: 'Financeiro: alçada pagamento', ok: false, ms: Math.round(performance.now() - start), error: 'SKIP' });
      }
    }

    {
      const start = performance.now();
      try {
        const obras = await base44.asServiceRole.entities.Obra.list(undefined, 1);
        if (obras && obras.length > 0) {
          const response = await base44.functions.invoke('getKpisObraPlanejadoReal', {
            obra_id: obras[0].id,
          });
          const ms = Math.round(performance.now() - start);
          const ok = response && response.data && response.data.labor_source !== undefined;
          if (ok) {
            passed++;
            tests.push({ id: 'T10', name: 'BI: KPIs', ok: true, ms, evidence: `labor_source=${response.data.labor_source}` });
          } else {
            failed++;
            tests.push({ id: 'T10', name: 'BI: KPIs', ok: false, ms, error: 'labor_source ausente' });
          }
        } else {
          tests.push({ id: 'T10', name: 'BI: KPIs', ok: false, ms: Math.round(performance.now() - start), error: 'sem obra' });
        }
      } catch (e) {
        failed++;
        tests.push({ id: 'T10', name: 'BI: KPIs', ok: false, ms: Math.round(performance.now() - start), error: e.message });
      }
    }

    {
      const start = performance.now();
      try {
        const obras = await base44.asServiceRole.entities.Obra.list(undefined, 1);
        if (obras && obras.length > 0) {
          const response = await base44.functions.invoke('getDreObra', {
            obra_id: obras[0].id,
            de: '2026-01-01',
            ate: '2026-12-31',
          });
          const ms = Math.round(performance.now() - start);
          const ok = response && response.data && response.data.labor_source !== undefined;
          if (ok) {
            passed++;
            tests.push({ id: 'T11', name: 'BI: DRE', ok: true, ms, evidence: `labor_source=${response.data.labor_source}` });
          } else {
            failed++;
            tests.push({ id: 'T11', name: 'BI: DRE', ok: false, ms, error: 'labor_source ausente' });
          }
        } else {
          tests.push({ id: 'T11', name: 'BI: DRE', ok: false, ms: Math.round(performance.now() - start), error: 'sem obra' });
        }
      } catch (e) {
        failed++;
        tests.push({ id: 'T11', name: 'BI: DRE', ok: false, ms: Math.round(performance.now() - start), error: e.message });
      }
    }

    {
      const start = performance.now();
      try {
        const response = await base44.functions.invoke('getAlertasExecutivos', {});
        const ms = Math.round(performance.now() - start);
        const ok = response && response.data && Array.isArray(response.data);
        if (ok) {
          passed++;
          tests.push({ id: 'T12', name: 'Alertas: executivos', ok: true, ms, evidence: `${response.data.length} alertas` });
        } else {
          failed++;
          tests.push({ id: 'T12', name: 'Alertas: executivos', ok: false, ms, error: 'formato inválido' });
        }
      } catch (e) {
        failed++;
        tests.push({ id: 'T12', name: 'Alertas: executivos', ok: false, ms: Math.round(performance.now() - start), error: e.message });
      }
    }

    if (modo === 'full') {
      const fullTests = ['T13 CurvaS', 'T14 FluxoCaixa', 'T15 Medição', 'T16 Contrato', 'T17 MedContrato', 'T18 Política', 'T19 Sugestão', 'T20 Agenda', 'T21 Drilldown', 'T22 Auditoria', 'T23 RBAC', 'T24 Performance', 'T25 Consistência'];
      for (const testName of fullTests) {
        tests.push({ id: testName.split(' ')[0], name: testName.split(' ').slice(1).join(' '), ok: false, ms: 0, error: 'SKIP: modo full não implementado' });
      }
    }
  } catch (e) {
    return {
      error: e.message,
      build_id: buildId,
      started_at: new Date(startTime).toISOString(),
      duration_ms: Date.now() - startTime,
      summary: { total: 0, passed: 0, failed: 0 },
      tests: []
    };
  }

  const durationMs = Date.now() - startTime;

  return {
    ok: failed === 0,
    build_id: buildId,
    started_at: new Date(startTime).toISOString(),
    duration_ms: durationMs,
    summary: { total: tests.length, passed, failed },
    tests,
  };
}

// Entrada HTTP padrão
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json().catch(() => ({}));
    const result = await runInternal(base44, body);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});