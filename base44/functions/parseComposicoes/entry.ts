import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { linhas } = body;

    if (!Array.isArray(linhas) || linhas.length === 0) {
      return Response.json({ error: 'Nenhuma linha para processar' }, { status: 400 });
    }

    // Identifica headers (normalmente linha com "Código", "Descrição", etc)
    let headerRowIndex = -1;
    let headerMapping = {};

    for (let i = 0; i < Math.min(linhas.length, 10); i++) {
      const row = linhas[i];
      const rowStr = JSON.stringify(row).toLowerCase();
      
      if (rowStr.includes('código') || rowStr.includes('descri') || rowStr.includes('valor unit')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return Response.json({ error: 'Não foi possível identificar cabeçalho da planilha' }, { status: 400 });
    }

    // Mapeia as colunas
    const headerRow = linhas[headerRowIndex];
    const colunas = mapearColunas(headerRow);

    if (!colunas.codigo || !colunas.descricao || !colunas.unidade || !colunas.preco_unitario) {
      return Response.json({ 
        error: 'Planilha não contém as colunas obrigatórias: Código, Descrição, Unidade, Preço Unitário',
        found: colunas
      }, { status: 400 });
    }

    // Processa dados
    const composicoes = [];
    const erros = [];

    for (let i = headerRowIndex + 1; i < linhas.length; i++) {
      const linha = linhas[i];
      
      const codigo = String(linha[colunas.codigo] || '').trim();
      const descricao = String(linha[colunas.descricao] || '').trim();
      const unidade = String(linha[colunas.unidade] || '').trim();
      const preco = extrairPreco(linha[colunas.preco_unitario]);
      const categoria = String(linha[colunas.categoria] || 'outros').trim().toLowerCase();
      const origem = detectarOrigem(String(linha[colunas.origem] || ''));

      // Skip linhas vazias
      if (!codigo && !descricao && !preco) continue;

      const validacao = validarComposicao({ codigo, descricao, unidade, preco }, i + 1);

      if (!validacao.valido) {
        erros.push({
          linha: i + 1,
          codigo,
          mensagem: validacao.erros.join('; ')
        });
      } else {
        composicoes.push({
          codigo,
          descricao,
          unidade: normalizarUnidade(unidade),
          preco_unitario: preco,
          categoria_servico: normalizarCategoria(categoria),
          tipo_obra: 'outro',
          origem,
          observacoes: '',
          ativo: true
        });
      }
    }

    return Response.json({
      sucesso: true,
      total: composicoes.length,
      erros,
      composicoes,
      headerMapping: colunas
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapearColunas(headerRow) {
  const normalizar = (str) => String(str || '').toLowerCase().replace(/[^\w]/g, '');
  
  const mapeamento = {
    codigo: ['código', 'code', 'item', 'col1'],
    descricao: ['descri', 'desc', 'obra'],
    unidade: ['und', 'unidade', 'unit', 'measure'],
    preco_unitario: ['valorunit', 'preço', 'preco', 'valor', 'price'],
    categoria: ['tipo', 'category', 'bancos'],
    origem: ['banco', 'origin', 'source', 'col2']
  };

  const colunas = {};
  const usado = new Set();

  for (const [campo, aliases] of Object.entries(mapeamento)) {
    for (const [colName, colValue] of Object.entries(headerRow)) {
      if (usado.has(colName)) continue;
      const colNorm = normalizar(colValue);
      
      if (aliases.some(alias => colNorm.includes(alias))) {
        colunas[campo] = colName;
        usado.add(colName);
        break;
      }
    }
  }

  // Fallback para colunas não encontradas
  const chaves = Object.keys(headerRow);
  if (!colunas.codigo) colunas.codigo = chaves[1] || chaves[0];
  if (!colunas.descricao) colunas.descricao = chaves[3] || chaves[2];
  if (!colunas.unidade) colunas.unidade = chaves[6] || 'B.D.I.';
  if (!colunas.preco_unitario) colunas.preco_unitario = chaves[8] || 'col_8';

  return colunas;
}

function extrairPreco(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor) return null;

  const str = String(valor).trim();
  const match = str.match(/[\d.,]+/);
  if (!match) return null;

  const num = match[0].replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(num);
  return isNaN(parsed) ? null : parsed;
}

function normalizarUnidade(unidade) {
  const mapa = {
    'm': 'm', 'metro': 'm',
    'm2': 'm2', 'm²': 'm2', 'metroquadrado': 'm2',
    'm3': 'm3', 'm³': 'm3', 'metrocúbico': 'm3',
    'un': 'un', 'unidade': 'un',
    'kg': 'kg', 'quilograma': 'kg',
    'l': 'l', 'litro': 'l',
    'sc': 'sc', 'saco': 'sc',
    'cx': 'cx', 'caixa': 'cx',
    'h': 'h', 'hora': 'h',
    'dia': 'dia', 'mês': 'mês'
  };

  const key = String(unidade).toLowerCase().replace(/[^\w]/g, '');
  return mapa[key] || 'un';
}

function normalizarCategoria(categoria) {
  const mapa = {
    'material': 'materiais',
    'mao': 'mao_obra',
    'maoobra': 'mao_obra',
    'equipamento': 'equipamentos',
    'servico': 'servicos',
    'mobilizacao': 'mobilizacao',
    'instalação': 'mobilizacao',
    'desmobilização': 'mobilizacao'
  };

  const key = categoria.toLowerCase().replace(/[^\w]/g, '');
  return mapa[key] || 'outros';
}

function detectarOrigem(valor) {
  const str = String(valor).toLowerCase();
  if (str.includes('sinapi')) return 'sinapi';
  if (str.includes('orse')) return 'orse';
  return 'proprio';
}

function validarComposicao(comp, linha) {
  const erros = [];

  if (!comp.codigo) erros.push('Código obrigatório');
  if (!comp.descricao) erros.push('Descrição obrigatória');
  if (!comp.unidade) erros.push('Unidade obrigatória');
  if (comp.preco === null || comp.preco === undefined) erros.push('Preço unitário obrigatório');
  else if (comp.preco <= 0) erros.push('Preço deve ser > 0');

  return {
    valido: erros.length === 0,
    erros
  };
}