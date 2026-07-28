import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auditoria de lançamentos órfãos (sem obra_id)
 * Identifica registros que não estão vinculados a nenhuma obra
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode rodar auditoria
    if (user.role !== 'admin' && user.role !== 'programador') {
      return Response.json({ error: 'Apenas admin' }, { status: 403 });
    }

    console.log('[AUDITORIA] Iniciando verificação de lançamentos órfãos...');

    const resultados = {
      entidades_verificadas: [],
      total_orfaos: 0,
      detalhes: {}
    };

    // Verificar ContaFinanceira
    try {
      const contas = await base44.entities.ContaFinanceira.list(null, 1000);
      const orfaos = contas.filter(c => !c.obra_id);

      if (orfaos.length > 0) {
        resultados.entidades_verificadas.push('ContaFinanceira');
        resultados.total_orfaos += orfaos.length;
        resultados.detalhes.ContaFinanceira = {
          total_orfaos: orfaos.length,
          total_geral: contas.length,
          percentual: ((orfaos.length / contas.length) * 100).toFixed(2),
          exemplos: orfaos.slice(0, 3).map(c => ({
            id: c.id,
            tipo: c.tipo,
            valor: c.valor,
            status: c.status,
            created_date: c.created_date
          }))
        };
      }
    } catch (err) {
      console.error('Erro ao verificar ContaFinanceira:', err);
    }

    // Verificar LancamentoFinanceiro
    try {
      const lancamentos = await base44.entities.LancamentoFinanceiro.list(null, 1000);
      const orfaos = lancamentos.filter(l => !l.obra_id);

      if (orfaos.length > 0) {
        resultados.entidades_verificadas.push('LancamentoFinanceiro');
        resultados.total_orfaos += orfaos.length;
        resultados.detalhes.LancamentoFinanceiro = {
          total_orfaos: orfaos.length,
          total_geral: lancamentos.length,
          percentual: ((orfaos.length / lancamentos.length) * 100).toFixed(2),
          exemplos: orfaos.slice(0, 3).map(l => ({
            id: l.id,
            tipo: l.tipo,
            valor: l.valor,
            created_date: l.created_date
          }))
        };
      }
    } catch (err) {
      console.error('Erro ao verificar LancamentoFinanceiro:', err);
    }

    // Verificar NotaFiscal
    try {
      const nfs = await base44.entities.NotaFiscal.list(null, 1000);
      const orfaos = nfs.filter(nf => !nf.obra_id);

      if (orfaos.length > 0) {
        resultados.entidades_verificadas.push('NotaFiscal');
        resultados.total_orfaos += orfaos.length;
        resultados.detalhes.NotaFiscal = {
          total_orfaos: orfaos.length,
          total_geral: nfs.length,
          percentual: ((orfaos.length / nfs.length) * 100).toFixed(2),
          exemplos: orfaos.slice(0, 3).map(nf => ({
            id: nf.id,
            numero: nf.numero,
            valor_total: nf.valor_total,
            created_date: nf.created_date
          }))
        };
      }
    } catch (err) {
      console.error('Erro ao verificar NotaFiscal:', err);
    }

    // Verificar Medicao
    try {
      const medicoes = await base44.entities.Medicao.list(null, 1000);
      const orfaos = medicoes.filter(m => !m.obra_id);

      if (orfaos.length > 0) {
        resultados.entidades_verificadas.push('Medicao');
        resultados.total_orfaos += orfaos.length;
        resultados.detalhes.Medicao = {
          total_orfaos: orfaos.length,
          total_geral: medicoes.length,
          percentual: ((orfaos.length / medicoes.length) * 100).toFixed(2)
        };
      }
    } catch (err) {
      console.error('Erro ao verificar Medicao:', err);
    }

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'auditarLancamentosOrfaos',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({}),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        total_orfaos: resultados.total_orfaos,
        entidades_verificadas: resultados.entidades_verificadas.length
      }
    });

    console.log(`[AUDITORIA] Concluída. Total de orfãos: ${resultados.total_orfaos}`);

    return Response.json({
      success: true,
      resultado: resultados
    });

  } catch (error) {
    console.error('Erro na auditoria:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});