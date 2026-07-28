import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

const SINONIMOS = {
  descricao: ['descricao', 'discriminacao', 'produto', 'servico', 'desc', 'item'],
  unidade: ['und', 'unid', 'unidade', 'u'],
  quantidade: ['qtd', 'quantidade', 'qty', 'qte'],
  valor_unitario: ['valor unit', 'preco unit', 'unitario', 'valor un', 'preco un'],
  valor_total: ['valor total', 'total', 'vlr total', 'vl total']
};

function detectarTipoColuna(headerNorm) {
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS)) {
    for (const sin of sinonimos) {
      if (headerNorm.includes(sin)) return tipo;
    }
  }
  return null;
}

function detectarCabecalho(dados) {
  let melhorLinha = 0;
  let melhorPontuacao = 0;

  for (let i = 0; i < Math.min(20, dados.length); i++) {
    const linha = dados[i];
    if (!Array.isArray(linha)) continue;

    let pontuacao = 0;
    for (const celula of linha) {
      if (!celula) continue;
      const norm = normalizarTexto(String(celula));
      for (const sinonimos of Object.values(SINONIMOS)) {
        for (const sin of sinonimos) {
          if (norm.includes(sin)) pontuacao += 2;
        }
      }
    }

    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhorLinha = i;
    }
  }

  return melhorLinha;
}

function parseNumBR(str) {
  if (typeof str === 'number') return str;
  if (!str) return null;

  str = String(str).trim().replace(/^R\$\s*/, '');

  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    const partes = str.split('.');
    if (partes[partes.length - 1].length <= 3) {
      str = str.replace(/\./g, '');
    }
  }

  return parseFloat(str) || null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Método não permitido' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { obraId, fileBase64, fileName, abaIndex = 0 } = body;

    if (!obraId) {
      return Response.json({ error: 'obraId obrigatório' }, { status: 400 });
    }

    if (!fileBase64) {
      return Response.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    }

    // Converter base64 para buffer
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Ler Excel
    const workbook = XLSX.read(bytes, { type: 'array' });

    if (abaIndex >= workbook.SheetNames.length) {
      return Response.json({ error: 'Aba não encontrada' }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[abaIndex];
    const worksheet = workbook.Sheets[sheetName];
    const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!dados || dados.length === 0) {
      return Response.json({ error: 'Planilha vazia' }, { status: 400 });
    }

    // Detectar cabeçalho
    const linhaHeaderIndex = detectarCabecalho(dados);
    const linhaHeader = dados[linhaHeaderIndex] || [];

    // Mapear colunas
    const mapaColunas = {};
    for (let colIndex = 0; colIndex < linhaHeader.length; colIndex++) {
      const celula = linhaHeader[colIndex];
      const norm = normalizarTexto(String(celula || ''));
      const tipo = detectarTipoColuna(norm);
      if (tipo) {
        mapaColunas[tipo] = colIndex;
      }
    }

    // Se detecção fraca, usar IA
    const temDescricao = mapaColunas.descricao !== undefined;
    const temQuantidade = mapaColunas.quantidade !== undefined;
    const temValor = mapaColunas.valor_unitario !== undefined || mapaColunas.valor_total !== undefined;
    const confiancaAlta = temDescricao && (temQuantidade || temValor);

    if (!confiancaAlta) {
      const linhasRelevantes = dados.slice(0, Math.min(100, dados.length));
      const jsonString = JSON.stringify(linhasRelevantes);
      
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extraia TODOS os itens de orçamento:
[{
  "descricao": "DESCRIÇÃO",
  "quantidade": número,
  "unidade": "un",
  "valor_unitario": número,
  "valor_total": número
}]

REGRAS: números brazilian (1.234,56=1234.56), IGNORE linhas vazias/títulos, EXTRAIA TODOS.

Dados:
${jsonString}

JSON com items:`,
        response_json_schema: {
          type: 'object',
          properties: { items: { type: 'array', items: { type: 'object' } } }
        }
      });

      const itemsIA = (aiResult.items || []).filter(i => i.descricao);
      const somaIA = itemsIA.reduce((acc, i) => acc + (i.valor_total || 0), 0);

      return Response.json({
        preview: itemsIA,
        stats: {
          total_linhas: itemsIA.length,
          linhas_validas: itemsIA.length,
          soma_valores: somaIA,
          arquivo_nome: fileName,
          aba_selecionada: sheetName
        },
        abas_disponiveis: workbook.SheetNames,
        processado_por_ia: true
      });
    }

    // Detecção automática
    const preview = [];
    let somaValores = 0;

    for (let i = linhaHeaderIndex + 1; i < dados.length; i++) {
      const linha = dados[i];
      if (!linha || linha.every(c => !c)) continue;

      const descricao = String(linha[mapaColunas.descricao] || '').trim();
      if (!descricao) continue;

      const quantidade = parseNumBR(linha[mapaColunas.quantidade]) || 0;
      const valorUnit = parseNumBR(linha[mapaColunas.valor_unitario]) || 0;
      const valorTotal = parseNumBR(linha[mapaColunas.valor_total]) || 
                         (quantidade && valorUnit ? quantidade * valorUnit : 0);

      if (quantidade > 0 || valorTotal > 0) {
        preview.push({
          descricao,
          unidade: String(linha[mapaColunas.unidade] || 'un').trim(),
          quantidade,
          valor_unitario: valorUnit,
          valor_total: valorTotal
        });
        somaValores += valorTotal;
      }
    }

    return Response.json({
      preview,
      stats: {
        total_linhas: preview.length,
        linhas_validas: preview.length,
        soma_valores: somaValores,
        arquivo_nome: fileName,
        aba_selecionada: sheetName
      },
      abas_disponiveis: workbook.SheetNames,
      processado_por_ia: false
    });

  } catch (error) {
    console.error('Importação error:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar arquivo' 
    }, { status: 500 });
  }
});