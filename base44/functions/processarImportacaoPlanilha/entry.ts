import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { importacao_id } = await req.json();

    if (!importacao_id) {
      return Response.json({ error: 'importacao_id é obrigatório' }, { status: 400 });
    }

    // Buscar importação
    const importacao = await base44.asServiceRole.entities.ImportacaoPlanilha.read(importacao_id);
    if (!importacao) {
      return Response.json({ error: 'Importação não encontrada' }, { status: 404 });
    }

    // Buscar todas as linhas
    const linhas = await base44.asServiceRole.entities.ImportacaoLinha.filter(
      { importacao_id },
      undefined,
      1000
    );

    let linhas_ok = 0;
    let linhas_erro = 0;
    const erros = [];

    // Mapear abas
    const abaRegras = {
      'MATERIAL': { categoria: 'Material', cols: { data: 0, fornecedor: 1, forma_pag: 2, valor: 3 } },
      'ALIMENTAÇÃO': { categoria: 'Alimentação', cols: { data: 0, fornecedor: 1, forma_pag: 2, valor: 3 } },
      'FRETES': { categoria: 'Fretes', cols: { data: 0, descricao: 1, forma_pag: 2, valor: 3 } },
      'ESTADIAS': { categoria: 'Estadias', cols: { data: 0, descricao: 1, forma_pag: 2, valor: 3 } },
      'IMPOSTOS': { categoria: 'Impostos', cols: { data: 0, descricao: 1, forma_pag: 2, valor: 3 } },
      'INVESTIMENTOS': { categoria: 'Investimentos', tipo: 'receita', cols: { data: 0, nome: 1, forma: 2, valor: 3 } },
      'RETIRADA': { categoria: 'Retiradas', cols: { data: 0, nome: 1, forma: 2, valor: 3 } },
      'ALUGUEL MAQ E COMBUSTIVEL': { categoria: 'Aluguel/Combustível', cols: { data: 0, descricao: 1, quantidade: 2, valor: 3 } },
      'MÃO DE OBRA': { categoria: 'Mão de Obra', cols: { data: 0, descricao: 1, forma_pag: 2, valor: 3 } }
    };

    // Processar cada linha
    for (const linha of linhas) {
      try {
        const raw = JSON.parse(linha.raw_json);
        const aba = linha.aba.toUpperCase().trim();
        const regra = abaRegras[aba];

        if (!regra) {
          throw new Error(`Aba '${aba}' não reconhecida`);
        }

        // Extrair valores baseado na posição das colunas
        const cols = regra.cols;
        const dados = Array.isArray(raw) ? raw : Object.values(raw);

        const data_str = dados[cols.data]?.toString().trim();
        const valor_str = dados[cols.valor]?.toString().trim().replace(/[^\d,-]/g, '').replace(',', '.');
        
        // Validar data
        if (!data_str || !isValidDate(data_str)) {
          throw new Error(`Data inválida: "${data_str}"`);
        }

        // Validar valor
        const valor = parseFloat(valor_str);
        if (isNaN(valor) || valor === 0) {
          throw new Error(`Valor inválido: "${dados[cols.valor]}"`);
        }

        // Montar descrição
        let descricao = '';
        if (cols.fornecedor !== undefined) {
          descricao = dados[cols.fornecedor]?.toString().trim() || '';
        }
        if (cols.descricao !== undefined) {
          descricao = dados[cols.descricao]?.toString().trim() || '';
        }
        if (cols.nome !== undefined) {
          descricao = dados[cols.nome]?.toString().trim() || '';
        }

        // Para Aluguel/Combustível, incluir quantidade na descrição
        if (cols.quantidade !== undefined && dados[cols.quantidade]) {
          descricao = `${dados[cols.quantidade]} dias/unid: ${descricao}`;
        }

        const forma_pagamento = cols.forma_pag !== undefined ? dados[cols.forma_pag]?.toString().trim() : null;
        const forma = cols.forma !== undefined ? dados[cols.forma]?.toString().trim() : null;

        // Criar LancamentoFinanceiro
        const lancamento = await base44.asServiceRole.entities.LancamentoFinanceiro.create({
          obra_id: importacao.obra_id,
          data: parseData(data_str),
          tipo: regra.tipo || 'despesa',
          categoria: regra.categoria,
          descricao,
          fornecedor_ou_beneficiario: regra.cols.fornecedor !== undefined ? dados[regra.cols.fornecedor]?.toString().trim() : null,
          forma_pagamento: forma_pagamento || forma,
          valor,
          origem_importacao_id: importacao_id,
          origem_linha_id: linha.id,
          status: 'pendente'
        });

        // Atualizar linha
        await base44.asServiceRole.entities.ImportacaoLinha.update(linha.id, {
          parse_status: 'ok',
          lancamento_financeiro_id: lancamento.id,
          mapeado_para: 'lancamento_financeiro'
        });

        linhas_ok++;
      } catch (error) {
        linhas_erro++;
        erros.push(`Linha ${linha.linha_numero} (${linha.aba}): ${error.message}`);

        // Marcar linha como erro
        await base44.asServiceRole.entities.ImportacaoLinha.update(linha.id, {
          parse_status: 'erro',
          erros: error.message
        });
      }
    }

    // Atualizar importação
    const status = linhas_erro > 0 ? 'com_erros' : 'processada';
    await base44.asServiceRole.entities.ImportacaoPlanilha.update(importacao_id, {
      status,
      linhas_ok,
      linhas_erro,
      total_linhas: linhas.length,
      resumo_erros: erros.join('\n')
    });

    return Response.json({
      success: true,
      importacao_id,
      linhas_ok,
      linhas_erro,
      total: linhas.length,
      erros: erros.length > 0 ? erros : null
    });
  } catch (error) {
    console.error('Erro ao processar importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function isValidDate(dateStr) {
  // Aceita: DD/MM/YYYY, YYYY-MM-DD, etc
  const patterns = [
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}-\d{2}-\d{4}$/
  ];
  return patterns.some(p => p.test(dateStr));
}

function parseData(dateStr) {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr; // já está em YYYY-MM-DD
}