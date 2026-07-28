import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validarIntegridadeObraCentroCusto } from './_lib/validadorIntegridade.js';
import { registrarAuditoria } from './_lib/auditoria.js';

/**
 * Processamento completo e automático de Nota Fiscal
 * Gera: Conta a Pagar + Entrada de Estoque (se material) + Log de Auditoria
 * Com idempotência garantida
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { 
      nf_id,
      chave_nf,
      numero_nf,
      fornecedor_id,
      obra_id,
      centro_custo_id,
      ordem_compra_id,
      data_emissao,
      data_vencimento,
      valor_total,
      itens,
      deposito_destino_id
    } = await req.json();

    // ========================================
    // VALIDAÇÃO DE INTEGRIDADE
    // ========================================
    await validarIntegridadeObraCentroCusto(base44, {
      entidade: 'NotaFiscal',
      funcao: 'processarNotaFiscalCompleta',
      obra_id,
      centro_custo_id,
      tipo_impacto: 'custo',
      usuario_id: user.email,
      payload: { nf_id, numero_nf, valor_total }
    });

    // ========================================
    // 1) VALIDAÇÕES OBRIGATÓRIAS
    // ========================================

    if (!nf_id || !chave_nf || !numero_nf || !fornecedor_id || !valor_total || !itens || itens.length === 0) {
      return Response.json({ 
        error: 'Campos obrigatórios: nf_id, chave_nf, numero_nf, fornecedor_id, valor_total, itens' 
      }, { status: 400 });
    }

    // OBRA OBRIGATÓRIA
    if (!obra_id) {
      return Response.json({ 
        error: 'obra_id é OBRIGATÓRIO. Nenhuma NF pode ser processada sem obra vinculada.' 
      }, { status: 400 });
    }

    // CENTRO DE CUSTO OBRIGATÓRIO - usar obra_id como fallback
    const centroCustoFinal = centro_custo_id || obra_id;

    // ========================================
    // 2) IDEMPOTÊNCIA - Verificar duplicidade
    // ========================================

    const nfJaProcessada = await base44.entities.ContaFinanceira.filter({
      referencia_tipo: 'nota_fiscal',
      nota_fiscal: numero_nf
    });

    if (nfJaProcessada.length > 0) {
      // Registrar tentativa duplicada
      await base44.asServiceRole.entities.LogProcessamentoNF.create({
        nf_id,
        chave_nf,
        numero_nf,
        data_processamento: new Date().toISOString(),
        usuario_id: user.email,
        obra_id,
        fornecedor_id,
        valor_total,
        status: 'duplicado',
        mensagem_erro: 'NF já foi processada anteriormente'
      });

      return Response.json({ 
        error: 'NF já processada anteriormente',
        conta_pagar_existente: nfJaProcessada[0].id,
        duplicado: true
      }, { status: 409 });
    }

    // ========================================
    // 3) BUSCAR FORNECEDOR
    // ========================================

    const fornecedor = await base44.entities.Fornecedor.get(fornecedor_id);
    if (!fornecedor) {
      return Response.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
    }

    // ========================================
    // 4) GERAR CONTA A PAGAR
    // ========================================

    const contaPagar = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'pagar',
      descricao: `NF ${numero_nf} - ${fornecedor.nome}`,
      valor: valor_total,
      data_vencimento: data_vencimento || new Date().toISOString().split('T')[0],
      status: 'pendente',
      obra_id,
      categoria: 'material', // Default, pode ser ajustado
      centro_custo: centroCustoFinal,
      fornecedor_cliente: fornecedor.nome,
      nota_fiscal: numero_nf,
      referencia_tipo: 'nota_fiscal',
      referencia_id: nf_id,
      observacao: `Chave NF: ${chave_nf}`
    });

    // AUDITORIA: Conta a Pagar criada
    await registrarAuditoria(base44, {
      entidade: 'ContaFinanceira',
      entidade_id: contaPagar.id,
      operacao: 'criar',
      dados_antes: null,
      dados_depois: contaPagar,
      usuario_id: user.email,
      obra_id,
      origem_funcao: 'processarNotaFiscalCompleta'
    });

    // ========================================
    // 5) CLASSIFICAR E PROCESSAR ITENS
    // ========================================

    const movimentacoesGeradas = [];
    let itensMateriaisCount = 0;
    let itensServicosCount = 0;
    const errosItens = [];

    for (const item of itens) {
      try {
        const { 
          tipo, // 'material' ou 'servico'
          insumo_id, 
          codigo,
          descricao,
          unidade,
          quantidade, 
          valor_unitario 
        } = item;

        if (!tipo || !quantidade || quantidade <= 0) {
          errosItens.push({ item, erro: 'Dados incompletos do item' });
          continue;
        }

        // ========================================
        // 6) MATERIAL: GERAR ENTRADA DE ESTOQUE
        // ========================================

        if (tipo === 'material') {
          if (!insumo_id) {
            errosItens.push({ item, erro: 'Material sem insumo_id' });
            continue;
          }

          // Se não tem depósito, usar o primeiro ou permitir sem depósito
          // (continuamos, não falhamos aqui)

          // Buscar insumo
          const insumo = await base44.entities.Insumo.get(insumo_id);
          if (!insumo) {
            errosItens.push({ item, erro: 'Insumo não encontrado' });
            continue;
          }

          // Buscar saldo atual
          const saldos = await base44.entities.SaldoEstoque.filter({
            insumo_id,
            deposito_id: deposito_destino_id
          });

          const saldoAtual = saldos[0] || { 
            quantidade: 0, 
            custo_medio: 0,
            deposito_id: deposito_destino_id,
            insumo_id
          };

          // Calcular novo custo médio ponderado
          const valorTotalAnterior = saldoAtual.quantidade * saldoAtual.custo_medio;
          const valorTotalEntrada = quantidade * valor_unitario;
          const novaQuantidade = saldoAtual.quantidade + quantidade;
          const novoCustoMedio = novaQuantidade > 0 
            ? (valorTotalAnterior + valorTotalEntrada) / novaQuantidade 
            : valor_unitario;

          // Criar movimentação de entrada
          const movimentacao = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
            data: data_emissao || new Date().toISOString(),
            tipo: 'entrada',
            insumo_id,
            codigo_insumo: codigo || insumo.codigo,
            descricao_insumo: descricao || insumo.descricao,
            unidade: unidade || insumo.unidade,
            quantidade,
            valor_unitario,
            valor_total: quantidade * valor_unitario,
            deposito_destino_id,
            obra_id, // Para rastreio de origem
            referencia_tipo: 'nota_fiscal',
            referencia_id: nf_id,
            usuario_id: user.email,
            observacao: `Entrada via NF ${numero_nf}`,
            saldo_anterior: saldoAtual.quantidade,
            saldo_atual: novaQuantidade,
            custo_medio_anterior: saldoAtual.custo_medio,
            custo_medio_atual: novoCustoMedio,
            documento_fiscal: numero_nf
          });

          // Atualizar saldo
          if (saldos[0]) {
            await base44.asServiceRole.entities.SaldoEstoque.update(saldos[0].id, {
              quantidade: novaQuantidade,
              custo_medio: novoCustoMedio,
              ultima_movimentacao: new Date().toISOString()
            });
          } else {
            await base44.asServiceRole.entities.SaldoEstoque.create({
              insumo_id,
              deposito_id: deposito_destino_id,
              quantidade: novaQuantidade,
              custo_medio: novoCustoMedio,
              ultima_movimentacao: new Date().toISOString()
            });
          }

          movimentacoesGeradas.push(movimentacao.id);
          itensMateriaisCount++;

        } else if (tipo === 'servico') {
          // Serviço: apenas custo financeiro, sem movimentação de estoque
          itensServicosCount++;
        }

      } catch (error) {
        errosItens.push({ item, erro: error.message });
      }
    }

    // ========================================
    // 7) VÍNCULO COM ORDEM DE COMPRA
    // ========================================

    if (ordem_compra_id) {
      try {
        const oc = await base44.entities.OrdemCompra.get(ordem_compra_id);
        if (oc) {
          // Atualizar status da OC
          await base44.asServiceRole.entities.OrdemCompra.update(ordem_compra_id, {
            status: 'recebida_parcial',
            nf_vinculada: numero_nf
          });
        }
      } catch (error) {
        console.error('Erro ao vincular OC:', error);
      }
    }

    // ========================================
    // 8) LOG DE AUDITORIA
    // ========================================

    const log = await base44.asServiceRole.entities.LogProcessamentoNF.create({
      nf_id,
      chave_nf,
      numero_nf,
      data_processamento: new Date().toISOString(),
      usuario_id: user.email,
      obra_id,
      fornecedor_id,
      valor_total,
      conta_pagar_id: contaPagar.id,
      movimentacoes_geradas: movimentacoesGeradas,
      itens_processados: itens.length,
      itens_materiais: itensMateriaisCount,
      itens_servicos: itensServicosCount,
      ordem_compra_id,
      status: 'sucesso'
    });

    return Response.json({
      success: true,
      mensagem: 'Nota Fiscal processada com sucesso',
      conta_pagar_id: contaPagar.id,
      movimentacoes_geradas: movimentacoesGeradas.length,
      itens_processados: {
        total: itens.length,
        materiais: itensMateriaisCount,
        servicos: itensServicosCount,
        erros: errosItens.length
      },
      log_id: log.id,
      erros_itens: errosItens
    });

  } catch (error) {
    console.error('Erro ao processar NF:', error);
    
    // Tentar registrar erro no log
    try {
      const { nf_id, chave_nf, numero_nf, obra_id, fornecedor_id, valor_total } = await req.json();
      await base44.asServiceRole.entities.LogProcessamentoNF.create({
        nf_id,
        chave_nf,
        numero_nf,
        data_processamento: new Date().toISOString(),
        usuario_id: user?.email || 'desconhecido',
        obra_id,
        fornecedor_id,
        valor_total,
        status: 'erro',
        mensagem_erro: error.message
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return Response.json({ 
      error: error.message || 'Erro ao processar Nota Fiscal' 
    }, { status: 500 });
  }
});