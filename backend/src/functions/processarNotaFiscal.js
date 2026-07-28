import { store } from '../entityStore.js';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

// Salva um arquivo base64 no mesmo diretório do upload (multer) e retorna a URL /api/files.
function salvarBase64(base64, nome) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(nome) || '';
  const safeBase = path.basename(nome, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const filename = `${Date.now()}-${nanoid(8)}-${safeBase}${ext}`;
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { file_url: `/api/files/${encodeURIComponent(filename)}`, buffer };
}

// Processa um documento fiscal (XML/PDF): salva o arquivo, cria a NotaFiscal
// (PENDENTE_REVISAO), faz parse estrutural se for XML e cria os NotaFiscalItem.
export default async function processarNotaFiscal({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { arquivo_base64, arquivo_nome, tipo_documento, obra_id } = body || {};
  if (!arquivo_base64 || !arquivo_nome || !tipo_documento || !obra_id) {
    throw Object.assign(new Error('Parâmetros obrigatórios faltando'), { status: 400 });
  }

  const { file_url, buffer } = salvarBase64(arquivo_base64, arquivo_nome);

  let nfData = {
    obra_id, tipo_documento, arquivo_url: file_url, arquivo_nome,
    status: 'PENDENTE_REVISAO', created_by: user.email
  };

  if (tipo_documento === 'XML') {
    try {
      const xmlText = buffer.toString('utf-8');
      nfData = { ...nfData, ...parseXMLNF(xmlText) };
    } catch { /* parse XML best-effort */ }
  }

  const itens = Array.isArray(nfData.itens) ? nfData.itens : [];
  delete nfData.itens;

  const nf = await store.create('NotaFiscal', nfData);

  for (const item of itens) {
    await store.create('NotaFiscalItem', { nota_fiscal_id: nf.id, ...item });
  }

  try {
    await store.create('AuditLogNF', { nota_fiscal_id: nf.id, acao: 'CRIADA', usuario_email: user.email, descricao: `Documento ${tipo_documento} enviado` });
  } catch { /* auditoria best-effort */ }

  return { nota_fiscal_id: nf.id, status: 'PENDENTE_REVISAO', message: 'NF processada e aguardando revisão' };
}

// Parser simples de NF-e por regex (suficiente p/ extrair cabeçalho + itens).
function parseXMLNF(xmlText) {
  try {
    const getTag = (tag) => {
      const m = xmlText.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 's'));
      return m ? m[1].trim() : null;
    };
    const numero = getTag('nNF');
    const serie = getTag('serie');
    const chave_acesso = getTag('infNFe')?.match(/Id="NFe(\d+)"/)?.[1];
    const fornecedor_nome = getTag('xNome');
    const fornecedor_cnpj = getTag('CNPJ');
    const data_emissao = getTag('dhEmi');
    const valor_total = parseFloat(getTag('vNF') || 0);
    const valor_icms = parseFloat(getTag('vICMS') || 0);
    const valor_ipi = parseFloat(getTag('vIPI') || 0);

    const detRegex = /<det[^>]*nItem="(\d+)"[^>]*>([\s\S]*?)<\/det>/g;
    const itens = [];
    let match;
    while ((match = detRegex.exec(xmlText)) !== null) {
      const itemXml = match[2];
      itens.push({
        numero_item: parseInt(match[1]),
        descricao: getTagInContext(itemXml, 'xProd'),
        ncm: getTagInContext(itemXml, 'NCM'),
        quantidade: parseFloat(getTagInContext(itemXml, 'qCom') || 0),
        unidade: getTagInContext(itemXml, 'uCom'),
        valor_unitario: parseFloat(getTagInContext(itemXml, 'vUnCom') || 0),
        valor_total: parseFloat(getTagInContext(itemXml, 'vItem') || 0)
      });
    }

    return {
      numero, serie, chave_acesso: chave_acesso || null,
      fornecedor_nome, fornecedor_cnpj,
      data_emissao: data_emissao ? data_emissao.split('T')[0] : null,
      valor_total, valor_icms, valor_ipi, itens
    };
  } catch {
    return {};
  }
}

function getTagInContext(context, tag) {
  const m = context.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 's'));
  return m ? m[1].trim() : null;
}
