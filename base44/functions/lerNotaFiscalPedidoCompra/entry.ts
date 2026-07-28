import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { XMLParser } from 'npm:fast-xml-parser@4.3.5';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: true,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { anexoId, arquivo, tipoArquivo, nomeOriginal, url } = payload;

    if (!anexoId) {
      return Response.json({ error: 'Missing anexoId' }, { status: 400 });
    }

    let dadosExtraidos = null;
    let status = 'PROCESSANDO';
    let erro = null;

    // Detectar tipo de arquivo
    const tipo = (tipoArquivo || nomeOriginal || '').toLowerCase();
    const isXML = tipo.includes('xml');
    const isPDFOrImage = tipo.includes('pdf') || tipo.includes('image') || tipo.includes('png') || tipo.includes('jpg') || tipo.includes('jpeg');

    // Pipeline por tipo de arquivo
    if (isXML && arquivo) {
      dadosExtraidos = await lerXMLNotaFiscal(arquivo);
      status = 'PROCESSADO';
    } else if (url) {
      // Para qualquer arquivo com URL (PDF, imagem, ou XML sem conteúdo inline), usar IA
      dadosExtraidos = await lerPDFOuImagemComIA(url, tipoArquivo || 'application/pdf', base44);
      status = dadosExtraidos.confianca_geral < 0.7 ? 'PROCESSADO_COM_PENDENCIAS' : 'PROCESSADO';
    } else {
      throw new Error(`Não foi possível processar: sem URL ou conteúdo do arquivo`);
    }

    // Retornar resultado estruturado
    return Response.json({
      sucesso: true,
      status,
      dadosExtraidos,
      metadados: {
        anexoId,
        nomeOriginal,
        tipoArquivo,
        processadoEm: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[lerNotaFiscalPedidoCompra]', error);
    return Response.json(
      {
        sucesso: false,
        status: 'ERRO',
        erro: error.message,
      },
      { status: 500 }
    );
  }
});

// ===== PARSERS =====

async function lerXMLNotaFiscal(conteudoXML) {
  // Tentar parse como string ou buffer
  let xmlStr = conteudoXML;
  if (typeof conteudoXML !== 'string') {
    xmlStr = new TextDecoder().decode(conteudoXML);
  }

  // Detectar se é NFe (estrutura padrão)
  const xmlObj = xmlParser.parse(xmlStr);
  const nfe = xmlObj.NFe || xmlObj.nfe || xmlObj.nfeCabecalho;

  if (!nfe) {
    throw new Error('XML não é uma NF-e válida');
  }

  // Navegar estrutura padrão NF-e
  const infNfe = nfe.infNFe || nfe.infNfe || nfe.inf;
  const ide = infNfe?.ide || {};
  const emit = infNfe?.emit || {};
  const dest = infNfe?.dest || {};
  const total = infNfe?.total || {};
  const det = infNfe?.det || [];

  // Extrair cabeçalho
  const cabecalho = {
    numero: ide.nNF?.toString() || '',
    serie: ide.serie?.toString() || '',
    chave_acesso: infNfe?.['@Id']?.replace('NFe', '') || '',
    data_emissao: ide.dEmi || ide.dEmiSC || '',
    fornecedor_nome: emit.xNome || '',
    fornecedor_cnpj: emit.CNPJ || '',
    valor_total: parseFloat(total.ICMSTot?.vNF || total.vNF || '0'),
    confianca: 1.0, // XML é estruturado, confiança máxima
  };

  // Extrair itens
  const itens = Array.isArray(det) ? det : [det];
  const itensExtraidos = itens
    .filter(Boolean)
    .map((item, idx) => {
      const prod = item.prod || {};
      return {
        numero_item: item['@nItem']?.toString() || idx.toString(),
        descricao: prod.xProd || '',
        unidade: prod.uCom || '',
        quantidade: parseFloat(prod.qCom || '0'),
        valor_unitario: parseFloat(prod.vUnCom || '0'),
        valor_total: parseFloat(prod.vItem || '0'),
        ncm: prod.NCM || '',
        confianca: 1.0,
      };
    });

  return {
    tipo: 'nfe',
    cabecalho,
    itens: itensExtraidos,
    confianca_geral: 1.0,
    pendencias: [],
  };
}

async function lerPDFOuImagemComIA(url, tipoArquivo, base44) {
  const prompt = `Você é um especialista em leitura de Notas Fiscais brasileiras (NF-e, NFS-e, NFC-e, cupons fiscais e documentos fiscais em geral).

Analise COMPLETAMENTE o documento/imagem fornecido e extraia TODOS os dados fiscais visíveis.
O documento pode ter qualquer formato ou layout - extraia o máximo possível independente do formato.

Extraia as seguintes informações:

cabecalho:
- numero: número da nota fiscal (pode estar como "NF", "Nota", "Número", etc.)
- serie: série da NF (pode não existir)
- chave_acesso: chave de acesso da NFe com 44 dígitos (se visível)
- data_emissao: data de emissão no formato YYYY-MM-DD
- fornecedor_nome: razão social ou nome do emissor/fornecedor
- fornecedor_cnpj: CNPJ do fornecedor (pode estar em qualquer formato)
- valor_total: valor total da NF como número decimal (ex: 1234.56)

itens: lista de produtos/serviços com:
- descricao: nome/descrição do item
- quantidade: quantidade como número decimal
- unidade: unidade de medida (UN, KG, M, M2, M3, L, etc.)
- valor_unitario: preço unitário como número decimal
- valor_total: valor total do item como número decimal

confianca_por_campo: para cada campo extraído, um valor de 0.0 a 1.0 indicando certeza da leitura

REGRAS IMPORTANTES:
- Se um campo não for encontrado, use null (não invente dados)
- Todos os valores monetários devem ser números decimais (não strings)
- Todas as quantidades devem ser números decimais
- Se o documento estiver parcialmente legível, extraia o que for possível
- Tente identificar TODOS os itens, mesmo que a formatação seja diferente do padrão
- O campo confianca_por_campo deve ter as chaves: numero, serie, data_emissao, fornecedor_nome, fornecedor_cnpj, valor_total`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [url],
    response_json_schema: {
      type: 'object',
      properties: {
        cabecalho: {
          type: 'object',
          properties: {
            numero: { type: ['string', 'null'] },
            serie: { type: ['string', 'null'] },
            chave_acesso: { type: ['string', 'null'] },
            data_emissao: { type: ['string', 'null'] },
            fornecedor_nome: { type: ['string', 'null'] },
            fornecedor_cnpj: { type: ['string', 'null'] },
            valor_total: { type: ['number', 'null'] }
          }
        },
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              descricao: { type: ['string', 'null'] },
              quantidade: { type: ['number', 'null'] },
              unidade: { type: ['string', 'null'] },
              valor_unitario: { type: ['number', 'null'] },
              valor_total: { type: ['number', 'null'] }
            }
          }
        },
        confianca_por_campo: {
          type: 'object',
          properties: {
            numero: { type: 'number' },
            serie: { type: 'number' },
            data_emissao: { type: 'number' },
            fornecedor_nome: { type: 'number' },
            fornecedor_cnpj: { type: 'number' },
            valor_total: { type: 'number' }
          }
        }
      },
      required: ['cabecalho', 'itens', 'confianca_por_campo']
    },
  });

  const dadosExtraidos = response || {};

  // Garantir estrutura mínima
  if (!dadosExtraidos.cabecalho) dadosExtraidos.cabecalho = {};
  if (!dadosExtraidos.itens) dadosExtraidos.itens = [];
  if (!dadosExtraidos.confianca_por_campo) dadosExtraidos.confianca_por_campo = {};

  // Normalizar valores numéricos do cabeçalho
  if (dadosExtraidos.cabecalho.valor_total && typeof dadosExtraidos.cabecalho.valor_total === 'string') {
    dadosExtraidos.cabecalho.valor_total = parseFloat(dadosExtraidos.cabecalho.valor_total.replace(/[^\d.,]/g, '').replace(',', '.')) || null;
  }

  // Normalizar valores numéricos dos itens
  dadosExtraidos.itens = dadosExtraidos.itens.map((item, idx) => ({
    numero_item: (idx + 1).toString(),
    descricao: item.descricao || null,
    quantidade: typeof item.quantidade === 'number' ? item.quantidade : parseFloat(String(item.quantidade || '0').replace(',', '.')) || 0,
    unidade: item.unidade || 'UN',
    valor_unitario: typeof item.valor_unitario === 'number' ? item.valor_unitario : parseFloat(String(item.valor_unitario || '0').replace(',', '.')) || 0,
    valor_total: typeof item.valor_total === 'number' ? item.valor_total : parseFloat(String(item.valor_total || '0').replace(',', '.')) || 0,
    confianca: 0.8,
  }));

  // Calcular confiança geral
  const confiancas = Object.values(dadosExtraidos.confianca_por_campo || {}).filter(v => typeof v === 'number');
  const confiancaGeral = confiancas.length > 0 ? confiancas.reduce((a, b) => a + b, 0) / confiancas.length : 0.5;

  // Validar dados extraídos
  const pendencias = [];
  if (!dadosExtraidos.cabecalho?.numero) pendencias.push('Número da NF não identificado');
  if (!dadosExtraidos.cabecalho?.fornecedor_nome) pendencias.push('Fornecedor não identificado');
  if (!dadosExtraidos.cabecalho?.valor_total) pendencias.push('Valor total não identificado');
  if (!dadosExtraidos.itens || dadosExtraidos.itens.length === 0) pendencias.push('Nenhum item identificado');
  if (confiancaGeral < 0.7) pendencias.push('Qualidade de leitura baixa - revisar antes de aplicar');

  return {
    tipo: 'pdf_ou_imagem',
    cabecalho: dadosExtraidos.cabecalho,
    itens: dadosExtraidos.itens,
    confianca_por_campo: dadosExtraidos.confianca_por_campo,
    confianca_geral: confiancaGeral,
    pendencias,
  };
}