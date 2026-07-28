import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro } from './_lib/erroSeguradoResponse.js';
import { logar } from './_lib/correlationId.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';

/**
 * EXPORTAR CONSULTA: gera CSV seguro e paginado
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `Exportando para CSV`);
    
    const payload = await req.json();
    const { obra_id, tipo, filtros = {} } = payload;
    
    if (!obra_id || !tipo) {
      const { body, status } = erroSeguro('VALIDACAO', 'Obra e tipo obrigatórios');
      return Response.json(body, { status });
    }
    
    let dados = [];
    let colunas = [];
    let nomeArquivo = '';
    
    // Buscar dados por tipo
    switch (tipo) {
      case 'ordenscompra':
        const ocs = await base44.entities.OrdemCompra.filter({ obra_id });
        colunas = ['numero', 'fornecedor_nome', 'valor_total', 'status', 'data_emissao'];
        dados = ocs || [];
        nomeArquivo = 'ordens_compra.csv';
        break;
        
      case 'notasfiscais':
        const nfs = await base44.entities.NotaFiscal.filter({ obra_id });
        colunas = ['numero_nf', 'descricao', 'valor_bruto', 'status', 'data'];
        dados = nfs || [];
        nomeArquivo = 'notas_fiscais.csv';
        break;
        
      case 'medicoes':
        const meds = await base44.entities.Medicao.filter({ obra_id });
        colunas = ['numero', 'tipo', 'valor_total_realizado', 'status', 'data_medicao'];
        dados = meds || [];
        nomeArquivo = 'medicoes.csv';
        break;
        
      case 'movimentacoes':
        const movs = await base44.entities.MovimentacaoEstoque.filter({ obra_id });
        colunas = ['descricao_insumo', 'tipo', 'quantidade', 'unidade', 'valor_total', 'data'];
        dados = movs || [];
        nomeArquivo = 'movimentacoes_estoque.csv';
        break;
        
      case 'contas':
        const contas = await base44.entities.ContaFinanceira.filter({ obra_id });
        colunas = ['descricao', 'valor', 'status', 'data_vencimento', 'forma_pagamento'];
        dados = contas || [];
        nomeArquivo = 'contas_financeiras.csv';
        break;
        
      default:
        const { body, status } = erroSeguro('VALIDACAO', 'Tipo inválido');
        return Response.json(body, { status });
    }
    
    // Gerar CSV
    const csv = gerarCSV(dados, colunas);
    
    logar(correlationId, 'info', `Exportado ${dados.length} linhas em CSV`);
    
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    throw error;
  }
});

function gerarCSV(dados, colunas) {
  // Cabeçalho
  const header = colunas.join(',');
  
  // Linhas
  const linhas = dados.map(item => {
    return colunas.map(col => {
      const valor = item[col];
      if (valor === null || valor === undefined) return '';
      if (typeof valor === 'string' && valor.includes(',')) {
        return `"${valor.replace(/"/g, '""')}"`;
      }
      return valor;
    }).join(',');
  });
  
  return [header, ...linhas].join('\n');
}

export default handler;