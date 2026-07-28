import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /notaFiscalListar
 * Lista NFs anexadas a uma entidade
 * 
 * Query params:
 * - referencia_tipo (obrigatório): "CONTAS_PAGAR", "COMPRA", etc
 * - referencia_id (obrigatório): ID da entidade
 * - incluirAuditoria (opcional): true/false (padrão false)
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const url = new URL(req.url);
    const referencia_tipo = url.searchParams.get('referencia_tipo');
    const referencia_id = url.searchParams.get('referencia_id');
    const incluirAuditoria = url.searchParams.get('incluirAuditoria') === 'true';

    if (!referencia_tipo || !referencia_id) {
      return Response.json({ 
        error: 'referencia_tipo e referencia_id são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar vinculos
    const vinculos = await base44.entities.NotaFiscalVinculo.filter({
      referencia_tipo,
      referencia_id,
    });

    // Buscar NFs
    const nfIds = vinculos.map(v => v.documento_fiscal_id);
    const nfs = await base44.entities.NotaFiscal.list();
    const nfsDoVinculo = nfs.filter(nf => nfIds.includes(nf.id));

    // Se solicitado, incluir auditoria
    let resultado = {
      vinculos,
      nfs: nfsDoVinculo,
    };

    if (incluirAuditoria) {
      const auditoria = await base44.entities.NotaFiscalAuditoria.list();
      resultado.auditoria = auditoria.filter(a => nfIds.includes(a.documento_fiscal_id));
    }

    return Response.json(resultado);
  } catch (error) {
    console.error('Erro ao listar NFs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});