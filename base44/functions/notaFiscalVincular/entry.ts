import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /notaFiscalVincular
 * Vincula NF a uma entidade (CONTAS_PAGAR, COMPRA, RECEBIMENTO, etc)
 * 
 * Payload:
 * {
 *   documento_fiscal_id: "nf-123",
 *   referencia_tipo: "CONTAS_PAGAR",
 *   referencia_id: "cp-456",
 *   referencia_nome: "CP-2026-001" (opcional),
 *   obra_id: "obra-789" (opcional)
 * }
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documento_fiscal_id, referencia_tipo, referencia_id, referencia_nome, obra_id } = await req.json();

    if (!documento_fiscal_id || !referencia_tipo || !referencia_id) {
      return Response.json({ 
        error: 'documento_fiscal_id, referencia_tipo e referencia_id são obrigatórios' 
      }, { status: 400 });
    }

    // Validar que NF existe
    const nf = await base44.entities.NotaFiscal.list().then(nfs => 
      nfs.find(n => n.id === documento_fiscal_id)
    );

    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    // Criar vinculação
    const vinculo = await base44.entities.NotaFiscalVinculo.create({
      documento_fiscal_id,
      referencia_tipo,
      referencia_id,
      referencia_nome: referencia_nome || `${referencia_tipo}:${referencia_id}`,
      obra_id: obra_id || null,
    });

    return Response.json({ vinculo });
  } catch (error) {
    console.error('Erro ao vincular NF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});