import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.ts';
import { logAuditoria } from './_lib/logAuditoria.ts';

/**
 * Exportar Contas a Receber em CSV
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RBAC: apenas diretor e financeiro podem exportar
    const { user } = await requireRole(base44, ['diretor', 'financeiro']);

    const { filtros = {} } = await req.json();

    // Buscar contas (suporta tipo receber ou pagar)
    const tipo = filtros.tipo || 'receber';
    let query = { tipo };

    if (filtros.obra_id) query.obra_id = filtros.obra_id;
    if (filtros.cliente_id) query.cliente_id = filtros.cliente_id;
    if (filtros.status) query.status = filtros.status;
    if (filtros.categoria) query.categoria = filtros.categoria;

    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter(query);

    // VALIDAÇÃO: excluir contas sem obra_id (dados inválidos)
    const contasValidas = contas.filter(c => c.obra_id);

    // Filtros adicionais (frontend)
    let contasFiltradas = contasValidas;

    if (filtros.data_vencimento_de) {
      contasFiltradas = contasFiltradas.filter(c => c.data_vencimento >= filtros.data_vencimento_de);
    }
    if (filtros.data_vencimento_ate) {
      contasFiltradas = contasFiltradas.filter(c => c.data_vencimento <= filtros.data_vencimento_ate);
    }
    if (filtros.valor_min) {
      contasFiltradas = contasFiltradas.filter(c => c.valor >= filtros.valor_min);
    }
    if (filtros.valor_max) {
      contasFiltradas = contasFiltradas.filter(c => c.valor <= filtros.valor_max);
    }
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      contasFiltradas = contasFiltradas.filter(c => 
        c.descricao?.toLowerCase().includes(busca) ||
        c.fornecedor_cliente?.toLowerCase().includes(busca) ||
        c.referencia_tipo?.toLowerCase().includes(busca)
      );
    }

    // Gerar CSV
    const headers = [
      'ID',
      'Data Vencimento',
      'Obra ID',
      'Cliente',
      'Descrição',
      'Valor Total',
      'Valor Recebido',
      'Valor Restante',
      'Status',
      'Forma Pagamento',
      'Data Pagamento',
      'Referência Tipo',
      'Referência ID',
      'Observação'
    ];

    const rows = contasFiltradas.map(c => [
      c.id,
      c.data_vencimento,
      c.obra_id || '',
      c.fornecedor_cliente || '',
      c.descricao || '',
      (c.valor || 0).toFixed(2),
      (c.valor_recebido || 0).toFixed(2),
      ((c.valor || 0) - (c.valor_recebido || 0)).toFixed(2),
      c.status || 'pendente',
      c.forma_pagamento || '',
      c.data_pagamento || '',
      c.referencia_tipo || '',
      c.referencia_id || '',
      c.observacao || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Auditoria (util central) - logar export
    await logAuditoria(base44, {
      entidade_tipo: 'ContaFinanceira',
      entidade_id: null,
      acao: 'EXPORT',
      resumo: `Exportação CSV: ${contasFiltradas.length} contas (tipo: ${tipo})`,
      dados_novos: { tipo, qtd_registros: contasFiltradas.length, filtros_aplicados: Object.keys(filtros).length },
      user_email: user.email,
      role: user.cargo,
      origem: 'ui',
      modulo: 'financeiro'
    });

    const filename = tipo === 'pagar' ? 'contas_pagar' : 'contas_receber';
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=${filename}_${new Date().toISOString().split('T')[0]}.csv`
      }
    });

  } catch (error) {
    console.error('[ERROR] exportarContasReceber:', error);
    return Response.json({
      error: error.message || 'Erro ao exportar'
    }, { status: 500 });
  }
});