import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Salva Nota Fiscal completa com registros de auditoria
 * Fluxo: ENVIADO -> ANALISADO_IA -> CONFIRMADO
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nf_data, referencia_tipo, referencia_id, alteracoes_auditoria } = await req.json();

    if (!nf_data.numero || !nf_data.data_emissao) {
      return Response.json(
        { error: 'Número e data são obrigatórios' },
        { status: 400 }
      );
    }

    // 1. Calcular valor final ajustado
    const valor_final_ajustado =
      (nf_data.valor_total || 0) -
      (nf_data.valor_desconto || 0) +
      (nf_data.valor_frete || 0) +
      (nf_data.valor_outros || 0);

    // 2. Criar registro de Nota Fiscal
    const notaFiscal = await base44.entities.NotaFiscal.create({
      tipo: 'NF',
      numero: nf_data.numero,
      chave_acesso: nf_data.chave_acesso || null,
      emissor_nome: nf_data.emissor_nome,
      emissor_cnpj: nf_data.emissor_cnpj || null,
      data_emissao: nf_data.data_emissao,
      valor_total: Number(nf_data.valor_total) || 0,
      valor_desconto: Number(nf_data.valor_desconto) || 0,
      valor_frete: Number(nf_data.valor_frete) || 0,
      valor_outros: Number(nf_data.valor_outros) || 0,
      valor_final_ajustado,
      status: 'CONFIRMADO',
      arquivo_url: nf_data.arquivo_url,
      ai_json: nf_data.ai_json,
      criado_por_user_id: user.email,
      observacao: nf_data.observacao || null,
    });

    // 3. Criar vínculo com o contexto
    if (referencia_tipo && referencia_id) {
      await base44.entities.NotaFiscalVinculo.create({
        documento_fiscal_id: notaFiscal.id,
        referencia_tipo,
        referencia_id,
      });
    }

    // 4. Registrar auditoria de criação
    await base44.asServiceRole.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id: notaFiscal.id,
      user_id: user.email,
      user_nome: user.full_name,
      acao: 'CRIACAO',
      campo_alterado: null,
    });

    // 5. Registrar cada alteração feita pelo usuário
    if (alteracoes_auditoria && alteracoes_auditoria.length > 0) {
      for (const alt of alteracoes_auditoria) {
        await base44.asServiceRole.entities.NotaFiscalAuditoria.create({
          documento_fiscal_id: notaFiscal.id,
          user_id: user.email,
          user_nome: user.full_name,
          acao: 'EDICAO',
          campo_alterado: alt.campo,
          valor_antigo: alt.valor_antigo,
          valor_novo: alt.valor_novo,
          motivo: 'Ajuste do usuário após leitura de IA',
        });
      }
    }

    return Response.json({
      success: true,
      nf: notaFiscal,
      mensagem: `NF ${notaFiscal.numero} salva com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao salvar NF:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});