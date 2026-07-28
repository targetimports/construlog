import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { codigo_item, preco_pago, quantidade } = await req.json();

    // Buscar na Base de Custos
    const baseCustos = await base44.asServiceRole.entities.BaseCustos.filter(
      { codigo: codigo_item },
      'codigo',
      1
    );

    if (baseCustos.length === 0) {
      return Response.json({
        existe: false,
        alerta: null,
        mensagem: 'Item não encontrado na Base de Custos'
      });
    }

    const item = baseCustos[0];
    const preco_unitario = preco_pago / quantidade;
    const variacao_percentual = ((preco_unitario - item.preco_padrao) / item.preco_padrao) * 100;
    const variacao_permitida = item.variacao_permitida_percentual || 10;

    let alerta = null;

    // Comparações
    if (preco_unitario < item.preco_minimo && item.preco_minimo > 0) {
      alerta = {
        tipo: 'abaixo_minimo',
        severidade: 'warning',
        mensagem: `Preço abaixo do mínimo (R$ ${item.preco_minimo.toFixed(2)})`,
        variacao_percentual: variacao_percentual
      };
    } else if (preco_unitario > item.preco_maximo && item.preco_maximo > 0) {
      alerta = {
        tipo: 'acima_maximo',
        severidade: 'error',
        mensagem: `Preço acima do máximo (R$ ${item.preco_maximo.toFixed(2)})`,
        variacao_percentual: variacao_percentual
      };
    } else if (Math.abs(variacao_percentual) > variacao_permitida) {
      alerta = {
        tipo: 'variacao_alta',
        severidade: variacao_percentual > 0 ? 'warning' : 'info',
        mensagem: `Variação de ${variacao_percentual.toFixed(1)}% em relação ao padrão`,
        variacao_percentual: variacao_percentual
      };
    }

    // Se houver alerta, criar registro
    if (alerta) {
      await base44.asServiceRole.entities.AlertaDesvio.create({
        tipo: alerta.tipo,
        severidade: alerta.severidade,
        entidade: 'compra',
        referencia: codigo_item,
        descricao: alerta.mensagem,
        valor_padrao: item.preco_padrao,
        valor_realizado: preco_unitario,
        variacao_percentual: variacao_percentual,
        data_alerta: new Date().toISOString(),
        status: 'ativo',
        registrado_por: user.email
      }).catch(() => {
        // AlertaDesvio pode não existir, ignorar
      });
    }

    return Response.json({
      existe: true,
      alerta,
      item: {
        codigo: item.codigo,
        descricao: item.descricao,
        preco_padrao: item.preco_padrao,
        preco_minimo: item.preco_minimo,
        preco_maximo: item.preco_maximo,
        variacao_permitida: variacao_permitida
      },
      comparacao: {
        preco_unitario_pago: preco_unitario,
        variacao_percentual: variacao_percentual,
        diferenca_valor: (preco_unitario - item.preco_padrao) * quantidade
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});