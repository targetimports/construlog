import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { arquivo_base64, arquivo_nome, tipo_documento, obra_id } = payload;

    if (!arquivo_base64 || !arquivo_nome || !tipo_documento || !obra_id) {
      return Response.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 });
    }

    // Upload arquivo
    const binaryData = Uint8Array.from(atob(arquivo_base64), c => c.charCodeAt(0));
    const uploadRes = await base44.integrations.Core.UploadFile({ file: binaryData });
    const arquivo_url = uploadRes.file_url;

    let nfData = {
      obra_id,
      tipo_documento,
      arquivo_url,
      arquivo_nome,
      status: 'PENDENTE_REVISAO',
      created_by: user.email
    };

    // Se XML: parse estrutural
    if (tipo_documento === 'XML') {
      try {
        const xmlText = new TextDecoder().decode(binaryData);
        const xmlData = parseXMLNF(xmlText);
        nfData = { ...nfData, ...xmlData };
      } catch (err) {
        console.warn('⚠️ Erro ao fazer parse XML:', err.message);
      }
    }

    // Criar NF
    const nf = await base44.asServiceRole.entities.NotaFiscal.create(nfData);

    // Se houver itens, criar
    if (nfData.itens && Array.isArray(nfData.itens)) {
      for (const item of nfData.itens) {
        await base44.asServiceRole.entities.NotaFiscalItem.create({
          nota_fiscal_id: nf.id,
          ...item
        });
      }
    }

    // Auditoria
    await base44.asServiceRole.entities.AuditLogNF.create({
      nota_fiscal_id: nf.id,
      acao: 'CRIADA',
      usuario_email: user.email,
      descricao: `Documento ${tipo_documento} enviado`
    });

    return Response.json({
      nota_fiscal_id: nf.id,
      status: 'PENDENTE_REVISAO',
      message: 'NF processada e aguardando revisão'
    });
  } catch (error) {
    console.error('❌ Erro ao processar NF:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseXMLNF(xmlText) {
  try {
    // Parser simples usando regex (pode ser melhorado com biblioteca XML)
    const getTag = (tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 's');
      const match = xmlText.match(regex);
      return match ? match[1].trim() : null;
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

    // Parse itens
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
      numero,
      serie,
      chave_acesso: chave_acesso || null,
      fornecedor_nome,
      fornecedor_cnpj,
      data_emissao: data_emissao ? data_emissao.split('T')[0] : null,
      valor_total,
      valor_icms,
      valor_ipi,
      itens
    };
  } catch (err) {
    console.error('Erro parse XML:', err);
    return {};
  }
}

function getTagInContext(context, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 's');
  const match = context.match(regex);
  return match ? match[1].trim() : null;
}