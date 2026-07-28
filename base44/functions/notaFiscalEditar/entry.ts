import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PUT /notaFiscalEditar
 * Edita campos da NF e registra auditoria automática
 * 
 * Payload:
 * {
 *   documento_fiscal_id: "nf-123",
 *   campo: "numero",
 *   valor_novo: "12345",
 *   motivo: "Correção de digitação" (opcional)
 * }
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'PUT') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documento_fiscal_id, campo, valor_novo, motivo } = await req.json();

    if (!documento_fiscal_id || !campo || valor_novo === undefined) {
      return Response.json({ 
        error: 'documento_fiscal_id, campo e valor_novo são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar NF atual
    const nf = await base44.entities.NotaFiscal.list().then(nfs => 
      nfs.find(n => n.id === documento_fiscal_id)
    );

    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    const valor_antigo = nf[campo];

    // Preparar update
    let updateData = { [campo]: valor_novo };

    // Se for valor_*, recalcular valor_final_ajustado automaticamente
    if (['valor_total', 'valor_desconto', 'valor_frete', 'valor_outros'].includes(campo)) {
      const total = campo === 'valor_total' ? valor_novo : nf.valor_total;
      const desconto = campo === 'valor_desconto' ? valor_novo : nf.valor_desconto;
      const frete = campo === 'valor_frete' ? valor_novo : nf.valor_frete;
      const outros = campo === 'valor_outros' ? valor_novo : nf.valor_outros;
      
      const novoFinal = total - desconto + frete + outros;
      updateData.valor_final_ajustado = novoFinal;
    }

    // Atualizar NF
    const nfAtualizada = await base44.entities.NotaFiscal.update(documento_fiscal_id, updateData);

    // Registrar auditoria
    await base44.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id,
      user_id: user.email,
      user_nome: user.full_name || user.email,
      campo_alterado: campo,
      valor_antigo: String(valor_antigo),
      valor_novo: String(valor_novo),
      motivo: motivo || 'Edição manual',
      acao: 'EDICAO',
    });

    return Response.json({ nf: nfAtualizada });
  } catch (error) {
    console.error('Erro ao editar NF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});