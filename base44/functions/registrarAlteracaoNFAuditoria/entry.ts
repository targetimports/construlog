import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Registra alterações em valores de Nota Fiscal na auditoria
 * Chamado sempre que um valor_total, valor_desconto, valor_frete, valor_outros é alterado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      documento_fiscal_id,
      campo_alterado,
      valor_antigo,
      valor_novo,
      motivo,
      acao = 'EDICAO'
    } = await req.json();

    // Validar campos obrigatórios
    if (!documento_fiscal_id || !campo_alterado || !valor_antigo || !valor_novo) {
      return Response.json(
        { error: 'Campos obrigatórios: documento_fiscal_id, campo_alterado, valor_antigo, valor_novo' },
        { status: 400 }
      );
    }

    // Registrar na auditoria
    const auditoria = await base44.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id,
      user_id: user.email,
      user_nome: user.full_name,
      campo_alterado,
      valor_antigo: String(valor_antigo),
      valor_novo: String(valor_novo),
      motivo,
      acao
    });

    return Response.json({
      success: true,
      auditoria
    });
  } catch (error) {
    console.error('Erro registrar auditoria:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});