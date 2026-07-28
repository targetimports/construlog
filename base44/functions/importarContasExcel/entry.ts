import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, file_url } = await req.json();

    if (!obra_id || !file_url) {
      return Response.json({ error: 'obra_id e file_url são obrigatórios' }, { status: 400 });
    }

    // Baixar arquivo
    const fileResponse = await fetch(file_url);
    const arrayBuffer = await fileResponse.arrayBuffer();

    // Ler Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const dados = XLSX.utils.sheet_to_json(worksheet);

    const erros = [];
    const contasParaCriar = [];
    let linhaAtual = 2; // Começa na linha 2 (considerando cabeçalho)

    // Validar e preparar dados
    for (const linha of dados) {
      try {
        // Validar campos obrigatórios
        if (!linha['Descrição'] || !linha['Valor (R$)'] || !linha['Data Vencimento']) {
          erros.push({
            linha: linhaAtual,
            erro: 'Campos obrigatórios faltando (Descrição, Valor, Data Vencimento)'
          });
          linhaAtual++;
          continue;
        }

        // Converter tipo
        let tipo = 'pagar';
        if (linha['Tipo']) {
          const tipoStr = String(linha['Tipo']).toLowerCase();
          if (tipoStr.includes('receber')) tipo = 'receber';
        }

        // Converter categoria
        const categoriasValidas = ['material', 'mao_de_obra', 'equipamento', 'transporte', 'servico', 'medicao', 'imposto', 'outros'];
        let categoria = 'outros';
        if (linha['Categoria']) {
          const catStr = String(linha['Categoria']).toLowerCase().replace(/[^a-z_]/g, '_');
          if (categoriasValidas.includes(catStr)) {
            categoria = catStr;
          }
        }

        // Converter status
        const statusValidos = ['pendente', 'pago', 'atrasado', 'cancelado'];
        let status = 'pendente';
        if (linha['Status']) {
          const statusStr = String(linha['Status']).toLowerCase();
          if (statusValidos.includes(statusStr)) {
            status = statusStr;
          }
        }

        // Preparar conta
        const conta = {
          obra_id,
          tipo,
          descricao: String(linha['Descrição']),
          valor: Number(linha['Valor (R$)']),
          data_vencimento: linha['Data Vencimento'],
          data_pagamento: linha['Data Pagamento'] || null,
          status,
          categoria,
          fornecedor_cliente: linha['Fornecedor/Cliente'] || '',
          nota_fiscal: linha['Nota Fiscal'] || '',
          observacao: linha['Observação'] || ''
        };

        // Validar valor numérico
        if (isNaN(conta.valor) || conta.valor <= 0) {
          erros.push({
            linha: linhaAtual,
            erro: 'Valor inválido (deve ser número positivo)'
          });
          linhaAtual++;
          continue;
        }

        contasParaCriar.push(conta);

      } catch (error) {
        erros.push({
          linha: linhaAtual,
          erro: error.message
        });
      }
      linhaAtual++;
    }

    // Criar contas no banco
    let criadas = 0;
    if (contasParaCriar.length > 0) {
      for (const conta of contasParaCriar) {
        try {
          await base44.asServiceRole.entities.ContaFinanceira.create(conta);
          criadas++;
        } catch (error) {
          erros.push({
            descricao: conta.descricao,
            erro: `Erro ao criar: ${error.message}`
          });
        }
      }
    }

    return Response.json({
      success: true,
      total_processadas: dados.length,
      total_criadas: criadas,
      total_erros: erros.length,
      erros: erros.slice(0, 20) // Retorna apenas os primeiros 20 erros
    });

  } catch (error) {
    console.error('Erro ao importar contas:', error);
    return Response.json({ 
      error: 'Erro ao importar planilha',
      details: error.message 
    }, { status: 500 });
  }
});