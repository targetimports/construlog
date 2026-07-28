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
  item: ['item', 'codigo', 'cod', 'id', 'numero'],
  descricao: ['descricao', 'discriminacao', 'produto', 'servico', 'desc'],
  unidade: ['und', 'unid', 'unidade', 'u'],
  quantidade: ['qtd', 'quantidade', 'qty', 'qte'],
  valor_unitario: ['valor unit', 'preco unit', 'unitario', 'valor un', 'preco un'],
  valor_total: ['valor total', 'total', 'vlr total', 'vl total'],
  bdi: ['bdi', 'b.d.i', 'bd.i']
};

function detectarTipoColuna(headerNorm) {
  let melhorMatch = null;
  let melhorPontuacao = 0;

  for (const [tipo, sinonimos] of Object.entries(SINONIMOS)) {
    for (const sin of sinonimos) {
      if (headerNorm.includes(sin)) {
        const pontuacao = sin.length;
        if (pontuacao > melhorPontuacao) {
          melhorPontuacao = pontuacao;
          melhorMatch = tipo;
        }
      }
    }
  }

  return melhorMatch;
}

function detectarCabecalho(dados) {
  const primeiras20 = dados.slice(0, 20);
  let melhorLinha = 0;
  let melhorPontuacao = 0;

  for (let i = 0; i < primeiras20.length; i++) {
    const linha = primeiras20[i];
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
    return parseFloat(str);
  }

  if (str.includes(',') && !str.includes('.')) {
    return parseFloat(str.replace(',', '.'));
  }

  if (str.includes('.')) {
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

    const formData = await req.formData();
    const file = formData.get('file');
    const abaIndex = parseInt(formData.get('aba_index') || '0');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }

    // Validar tamanho (30MB)
    if (file.size > 30 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande (máx 30MB)' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (abaIndex >= workbook.SheetNames.length) {
      return Response.json({ error: 'Aba não encontrada' }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[abaIndex];
    const worksheet = workbook.Sheets[sheetName];
    const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!dados || dados.length === 0) {
      return Response.json({ error: 'Planilha vazia' }, { status: 400 });
    }

    // Tentar detecção automática
    const linhaHeaderIndex = detectarCabecalho(dados);
    const linhaHeader = dados[linhaHeaderIndex] || [];

    const mapaColunas = {};
    for (let colIndex = 0; colIndex < linhaHeader.length; colIndex++) {
      const celula = linhaHeader[colIndex];
      const norm = normalizarTexto(String(celula || ''));
      const tipo = detectarTipoColuna(norm);
      if (tipo) {
        mapaColunas[tipo] = colIndex;
      }
    }

    // Se detecção fraca (<2 colunas principais), usar IA
    const temDescricao = mapaColunas.descricao !== undefined;
    const temQuantidade = mapaColunas.quantidade !== undefined;
    const temValor = mapaColunas.valor_unitario !== undefined || mapaColunas.valor_total !== undefined;
    const confiancaAlta = temDescricao && (temQuantidade || temValor);

    if (!confiancaAlta) {
      // IA em ação
      const linhasRelevantes = dados.slice(0, Math.min(100, dados.length));
      const jsonString = JSON.stringify(linhasRelevantes);
      
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é especialista em ler orçamentos de construção complexos em Excel.

Analise estes dados e EXTRAIA TODOS os itens de orçamento válidos:

[{
  "etapa": "seção/grupo (opcional)",
  "item_numero": "número sequencial ou código",
  "codigo": "identificador (opcional)",
  "descricao": "DESCRIÇÃO CLARA E COMPLETA",
  "unidade": "un/m/m2/m3/kg/h",
  "quantidade": número,
  "valor_unitario": número,
  "valor_total": número (ou calculado)
}]

REGRAS:
1. Números brasileiro: 1.234,56 = 1234.56
2. IGNORE linhas vazias, títulos, seções, subtotais
3. EXTRAIA TODOS os itens válidos
4. Calcule valor_total = quantidade × valor_unitario se faltar
5. Mínimo: descricao + (quantidade OU valor_total)

Dados (${dados.length} linhas):
${jsonString}

JSON com items APENAS:`,
        response_json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      });

      const itemsIA = (aiResult.items || []).filter(i => i.descricao);
      const somaIA = itemsIA.reduce((acc, i) => acc + (i.valor_total || 0), 0);

      return Response.json({
        ok: true,
        preview: itemsIA,
        processado_por_ia: true,
        stats: {
          total_linhas: itemsIA.length,
          linhas_validas: itemsIA.length,
          soma_valores: somaIA,
          arquivo_nome: file.name,
          aba_selecionada: sheetName
        },
        abas_disponiveis: workbook.SheetNames
      });
    }

    // Detecção automática bem-sucedida
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
        const item = {
          item_numero: preview.length + 1,
          descricao,
          unidade: String(linha[mapaColunas.unidade] || 'un').trim(),
          quantidade,
          valor_unitario: valorUnit,
          valor_total: valorTotal
        };
        preview.push(item);
        somaValores += valorTotal;
      }
    }

    return Response.json({
      ok: true,
      preview,
      processado_por_ia: false,
      stats: {
        total_linhas: preview.length,
        linhas_validas: preview.length,
        soma_valores: somaValores,
        arquivo_nome: file.name,
        aba_selecionada: sheetName
      },
      abas_disponiveis: workbook.SheetNames
    });

  } catch (error) {
    console.error('Import preview error:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar arquivo' 
    }, { status: 500 });
  }
});