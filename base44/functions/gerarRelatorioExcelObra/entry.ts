import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo, obra_id } = await req.json();

    // Buscar dados
    let obras = [];
    if (obra_id) {
      obras = await base44.entities.Obra.filter({ id: obra_id });
    } else {
      obras = await base44.entities.Obra.filter({ 
        status: { $in: ['em_andamento', 'a_iniciar', 'orcamento', 'pausada'] } 
      });
    }

    const contas = await base44.entities.ContaFinanceira.list();
    const medicoes = await base44.entities.Medicao.list();

    let sheetData = [];
    let fileName = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.xlsx`;

    if (tipo === 'financeiro') {
      sheetData = [
        ['Obra', 'Cliente', 'Orçado', 'Realizado', 'Faturado', 'Saldo', 'Desvio %']
      ];

      obras.forEach(obra => {
        const orcado = obra.valor_orcado || 0;
        const realizado = contas
          .filter(c => c.obra_id === obra.id && c.tipo === 'pagar' && c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor || 0), 0);
        const faturado = medicoes
          .filter(m => m.obra_id === obra.id && m.status === 'aprovada')
          .reduce((sum, m) => sum + (m.valor_total || 0), 0);
        const saldo = orcado - realizado;
        const desvio = orcado > 0 ? ((realizado - orcado) / orcado) * 100 : 0;

        sheetData.push([
          obra.nome,
          obra.cliente,
          orcado,
          realizado,
          faturado,
          saldo,
          desvio.toFixed(2)
        ]);
      });
    } else if (tipo === 'status') {
      sheetData = [
        ['Obra', 'Cliente', 'Status', 'Progresso %', 'Valor Contrato', 'Data Início', 'Data Fim Prevista']
      ];

      obras.forEach(obra => {
        sheetData.push([
          obra.nome,
          obra.cliente,
          obra.status,
          obra.percentual_concluido || 0,
          obra.valor_contrato || 0,
          obra.data_inicio || 'Não definido',
          obra.data_prevista_fim || 'Não definido'
        ]);
      });
    } else if (tipo === 'custos') {
      sheetData = [
        ['Centro de Custo', 'Orçado', 'Realizado', 'Desvio %']
      ];

      const custosPorCentro = {};
      obras.forEach(obra => {
        const centro = obra.centro_custo || 'Não definido';
        if (!custosPorCentro[centro]) {
          custosPorCentro[centro] = { orcado: 0, realizado: 0 };
        }
        custosPorCentro[centro].orcado += obra.valor_orcado || 0;
        const custosObra = contas
          .filter(c => c.obra_id === obra.id && c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor || 0), 0);
        custosPorCentro[centro].realizado += custosObra;
      });

      Object.entries(custosPorCentro).forEach(([centro, dados]) => {
        const desvio = dados.orcado > 0 ? ((dados.realizado - dados.orcado) / dados.orcado) * 100 : 0;
        sheetData.push([
          centro,
          dados.orcado,
          dados.realizado,
          desvio.toFixed(2)
        ]);
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${fileName}`
      }
    });
  } catch (error) {
    console.error('Erro ao gerar Excel:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});