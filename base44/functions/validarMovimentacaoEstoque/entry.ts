import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validação obrigatória antes de criar movimentação
 * Garante integridade do padrão ERP
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { tipo, obra_id, centro_custo_id, quantidade, insumo_id, deposito_origem_id } = await req.json();

    const erros = [];

    // Regra 1: Saídas DEVEM ter obra_id
    if ((tipo === 'saida_consumo' || tipo === 'saida_transferencia') && !obra_id) {
      erros.push({
        campo: 'obra_id',
        mensagem: 'obra_id é OBRIGATÓRIO para movimentações de saída'
      });
    }

    // Regra 2: Consumo DEVE ter centro_custo_id
    if (tipo === 'saida_consumo' && !centro_custo_id) {
      erros.push({
        campo: 'centro_custo_id',
        mensagem: 'centro_custo_id é OBRIGATÓRIO para consumo'
      });
    }

    // Regra 3: Quantidade deve ser positiva
    if (!quantidade || quantidade <= 0) {
      erros.push({
        campo: 'quantidade',
        mensagem: 'Quantidade deve ser maior que zero'
      });
    }

    // Regra 4: Insumo deve existir
    if (insumo_id) {
      const insumo = await base44.entities.Insumo.get(insumo_id);
      if (!insumo) {
        erros.push({
          campo: 'insumo_id',
          mensagem: 'Insumo não encontrado'
        });
      }
    } else {
      erros.push({
        campo: 'insumo_id',
        mensagem: 'insumo_id é obrigatório'
      });
    }

    // Regra 5: Verificar saldo para saídas
    if ((tipo === 'saida_consumo' || tipo === 'saida_transferencia') && deposito_origem_id && insumo_id) {
      const saldos = await base44.entities.SaldoEstoque.filter({
        insumo_id,
        deposito_id: deposito_origem_id
      });

      if (saldos.length === 0 || saldos[0].quantidade < quantidade) {
        erros.push({
          campo: 'quantidade',
          mensagem: 'Saldo insuficiente no estoque',
          saldo_disponivel: saldos[0]?.quantidade || 0
        });
      }
    }

    if (erros.length > 0) {
      return Response.json({
        valido: false,
        erros
      }, { status: 400 });
    }

    return Response.json({
      valido: true,
      mensagem: 'Movimentação válida'
    });

  } catch (error) {
    console.error('Erro na validação:', error);
    return Response.json({ 
      valido: false,
      erro: error.message 
    }, { status: 500 });
  }
});