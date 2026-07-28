import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /notaFiscalCriar
 * Upload + criar registro de NF (status=ENVIADO)
 * 
 * Payload:
 * {
 *   arquivo_url: "https://...",
 *   tipo: "NF" (opcional)
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

    const { arquivo_url, tipo = 'NF' } = await req.json();

    if (!arquivo_url) {
      return Response.json({ error: 'arquivo_url é obrigatório' }, { status: 400 });
    }

    // Criar NF com status inicial ENVIADO
    const nf = await base44.entities.NotaFiscal.create({
      tipo,
      numero: '',
      data_emissao: new Date().toISOString().split('T')[0],
      emissor_nome: '',
      valor_total: 0,
      status: 'ENVIADO',
      arquivo_url,
      criado_por_user_id: user.email,
    });

    // Registrar auditoria de criação
    await base44.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id: nf.id,
      user_id: user.email,
      user_nome: user.full_name || user.email,
      acao: 'CRIACAO',
      campo_alterado: 'status',
      valor_antigo: null,
      valor_novo: 'ENVIADO',
      motivo: 'Upload inicial do documento',
    });

    return Response.json({ nf });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});