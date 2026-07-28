import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET /notaFiscalObter
 * Obtém detalhes de uma NF + histórico de auditoria
 * 
 * Query params:
 * - documento_fiscal_id (obrigatório)
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

    const url = new URL(req.url);
    const documento_fiscal_id = url.searchParams.get('documento_fiscal_id');

    if (!documento_fiscal_id) {
      return Response.json({ error: 'documento_fiscal_id é obrigatório' }, { status: 400 });
    }

    // Buscar NF
    const nf = await base44.entities.NotaFiscal.list().then(nfs => 
      nfs.find(n => n.id === documento_fiscal_id)
    );

    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    // Buscar vinculos
    const vinculos = await base44.entities.NotaFiscalVinculo.filter({
      documento_fiscal_id,
    });

    // Buscar auditoria
    const auditoria = await base44.entities.NotaFiscalAuditoria.filter({
      documento_fiscal_id,
    });

    return Response.json({
      nf,
      vinculos,
      auditoria,
    });
  } catch (error) {
    console.error('Erro ao obter NF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});