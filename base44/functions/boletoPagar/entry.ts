import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── CRIAR BOLETO ──
    if (action === 'criar') {
      const data = { ...body.data, status: body.data.status || 'ABERTO' };
      data.log_eventos = [{
        data: new Date().toISOString(),
        usuario: user.email,
        acao: 'CRIADO',
        detalhes: `Boleto criado com status ${data.status}`
      }];
      data.alertas_enviados = [];
      const boleto = await base44.entities.BoletoPagar.create(data);
      return Response.json({ ok: true, boleto });
    }

    // ── ATUALIZAR BOLETO ──
    if (action === 'atualizar') {
      const { id, data } = body;
      const existentes = await base44.entities.BoletoPagar.filter({ id });
      const existente = existentes[0];
      if (!existente) return Response.json({ error: 'Boleto não encontrado' }, { status: 404 });

      // Bloquear edição de valor/vencimento se PAGO
      if (existente.status === 'PAGO') {
        if (data.valor !== undefined || data.data_vencimento !== undefined) {
          return Response.json({ error: 'Não é possível alterar valor ou vencimento de boleto PAGO' }, { status: 400 });
        }
      }

      const logEntry = {
        data: new Date().toISOString(),
        usuario: user.email,
        acao: 'ATUALIZADO',
        detalhes: `Campos alterados: ${Object.keys(data).join(', ')}`
      };
      data.log_eventos = [...(existente.log_eventos || []), logEntry];
      await base44.entities.BoletoPagar.update(id, data);
      return Response.json({ ok: true });
    }

    // ── MARCAR COMO PAGO (com integração tesouraria) ──
    if (action === 'pagar') {
      const { id, data_pagamento, valor_pago, conta_financeira_id, comprovante_pagamento_url } = body;
      const existentes = await base44.entities.BoletoPagar.filter({ id });
      const boleto = existentes[0];
      if (!boleto) return Response.json({ error: 'Boleto não encontrado' }, { status: 404 });
      if (boleto.status === 'PAGO') return Response.json({ error: 'Boleto já está pago' }, { status: 400 });
      if (boleto.status === 'CANCELADO') return Response.json({ error: 'Boleto cancelado não pode ser pago' }, { status: 400 });

      const valorEfetivo = valor_pago || boleto.valor;
      const dataPagEfetiva = data_pagamento || new Date().toISOString().split('T')[0];

      // Integrar com tesouraria se conta informada
      let movimentacaoId = '';
      let contaNome = '';
      if (conta_financeira_id) {
        const res = await base44.functions.invoke('tesourariaMovimentar', {
          action: 'movimentar',
          conta_id: conta_financeira_id,
          tipo: 'saida',
          valor: valorEfetivo,
          data_movimentacao: dataPagEfetiva,
          categoria: 'pagamento_fornecedor',
          descricao: `Pgto boleto: ${boleto.descricao} - ${boleto.fornecedor_nome || ''}`,
          obra_id: boleto.obra_id || '',
          referencia_tipo: 'boleto_pagar',
          referencia_id: id,
          forma_pagamento: boleto.forma_pagamento || 'boleto'
        });
        if (res.data?.movimentacao_id) {
          movimentacaoId = res.data.movimentacao_id;
        }
        // Buscar nome da conta
        const contas = await base44.entities.ContaTesouraria.filter({ id: conta_financeira_id });
        if (contas[0]) contaNome = contas[0].nome;
      }

      const logEntry = {
        data: new Date().toISOString(),
        usuario: user.email,
        acao: 'PAGO',
        detalhes: `Valor pago: R$ ${valorEfetivo.toFixed(2)} | Conta: ${contaNome || 'N/A'}`
      };

      await base44.entities.BoletoPagar.update(id, {
        status: 'PAGO',
        data_pagamento: dataPagEfetiva,
        valor_pago: valorEfetivo,
        conta_financeira_id: conta_financeira_id || '',
        conta_financeira_nome: contaNome,
        comprovante_pagamento_url: comprovante_pagamento_url || boleto.comprovante_pagamento_url || '',
        movimentacao_tesouraria_id: movimentacaoId,
        log_eventos: [...(boleto.log_eventos || []), logEntry]
      });

      // Notificação de pagamento
      if (boleto.responsavel_user_id) {
        const users = await base44.asServiceRole.entities.User.filter({ id: boleto.responsavel_user_id });
        const resp = users[0];
        if (resp) {
          await base44.asServiceRole.entities.Notificacao.create({
            destinatario_email: resp.email,
            tipo: 'BOLETO_PAGO',
            titulo: 'Boleto pago',
            mensagem: `Boleto "${boleto.descricao}" de R$ ${valorEfetivo.toFixed(2)} foi pago por ${user.full_name || user.email}.`,
            lida: false,
            link_acao: `ContasPagar?tab=boletos&boleto_id=${id}`,
            referencia_tipo: 'BoletoPagar',
            referencia_id: id
          });
        }
      }

      return Response.json({ ok: true, movimentacao_id: movimentacaoId });
    }

    // ── CANCELAR BOLETO ──
    if (action === 'cancelar') {
      const { id, motivo } = body;
      const existentes = await base44.entities.BoletoPagar.filter({ id });
      const boleto = existentes[0];
      if (!boleto) return Response.json({ error: 'Boleto não encontrado' }, { status: 404 });
      if (boleto.status === 'PAGO') return Response.json({ error: 'Boleto PAGO não pode ser cancelado diretamente' }, { status: 400 });

      const logEntry = {
        data: new Date().toISOString(),
        usuario: user.email,
        acao: 'CANCELADO',
        detalhes: motivo || 'Cancelado pelo usuário'
      };

      await base44.entities.BoletoPagar.update(id, {
        status: 'CANCELADO',
        log_eventos: [...(boleto.log_eventos || []), logEntry]
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Action inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro em boletoPagar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});