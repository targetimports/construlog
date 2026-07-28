import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nf_id, valor_final, status_pagamento = 'PENDENTE', obra_id } = await req.json();

    if (!nf_id || !valor_final) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Buscar NF
    const nf = await base44.entities.NotaFiscal.read(nf_id);
    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    if (nf.status !== 'CONFIRMADO') {
      return Response.json({ error: 'NF não está confirmada' }, { status: 400 });
    }

    // Se não informou obra_id, tentar descobrir pelo vínculo
    let obra_destino_id = obra_id;
    if (!obra_destino_id) {
      const vinculos = await base44.entities.NotaFiscalVinculo.filter(
        { documento_fiscal_id: nf_id },
        null,
        10
      );
      if (vinculos.length > 0) {
        const vinculo = vinculos[0];
        if (vinculo.referencia_tipo === 'PEDIDO') {
          const pedido = await base44.entities.PedidoCompra.read(vinculo.referencia_id);
          if (pedido) obra_destino_id = pedido.obra_id;
        } else if (vinculo.referencia_tipo === 'RECEBIMENTO') {
          const receb = await base44.entities.Recebimento.read(vinculo.referencia_id);
          if (receb) obra_destino_id = receb.obra_id;
        } else if (vinculo.referencia_tipo === 'VIAGEM') {
          const viagem = await base44.entities.Viagem.read(vinculo.referencia_id);
          if (viagem && viagem.origem_tipo === 'FORNECEDOR') {
            // Viagens de fornecedor não têm obra, pular
          } else if (viagem) {
            // Buscar primeira parada para pegar obra
            const paradas = await base44.entities.ParadaViagem.filter(
              { viagem_id: viagem.id },
              'ordem',
              1
            );
            if (paradas.length > 0) obra_destino_id = paradas[0].obra_id;
          }
        } else if (vinculo.referencia_tipo === 'OBRA') {
          obra_destino_id = vinculo.referencia_id;
        }
      }
    }

    // Criar ContaPagar
    const contaPagar = await base44.entities.ContaPagar.create({
      fornecedor_id: nf.emissor_cnpj || nf.emissor_nome,
      fornecedor_nome: nf.emissor_nome,
      obra_id: obra_destino_id || null,
      numero_nf: nf.numero,
      chave_nf: nf.chave_acesso || null,
      valor: Number(valor_final),
      status_pagamento: status_pagamento,
      data_vencimento: nf.data_emissao || new Date().toISOString().split('T')[0],
      descricao: `NF ${nf.numero} - ${nf.emissor_nome}`,
      documento_fiscal_id: nf_id,
      criado_por: user.email,
      observacao: `Gerada automaticamente a partir de NF confirmada`
    });

    // Registrar auditoria
    await base44.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id: nf_id,
      user_id: user.email,
      user_nome: user.full_name,
      campo_alterado: 'status',
      valor_antigo: nf.status,
      valor_novo: 'CONTA_PAGAR_GERADA',
      acao: 'CONFIRMACAO',
      motivo: `Conta a pagar ${contaPagar.id} gerada`
    });

    return Response.json({
      success: true,
      conta_pagar_id: contaPagar.id,
      message: `Conta a pagar criada com sucesso (${status_pagamento})`
    });
  } catch (error) {
    console.error('Erro ao gerar conta a pagar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});