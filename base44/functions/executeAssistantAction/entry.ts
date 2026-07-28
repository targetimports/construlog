import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Executa ActionDraft validado
 * CRIA/EDITA/EXCLUI registros no banco
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { actionDraft } = await req.json();

    if (!actionDraft || actionDraft.status !== 'validated') {
      return Response.json({ 
        error: 'ActionDraft deve ser validado antes da execução' 
      }, { status: 400 });
    }

    const { acao, dados, entidade_alvo } = actionDraft;
    let resultado = {};
    let registroId = null;

    // === CRIAR DESPESA ===
    if (acao === 'CREATE_EXPENSE') {
      const dadosNovo = {
        data: dados.data || new Date().toISOString().split('T')[0],
        valor: dados.valor,
        descricao: dados.descricao,
        forma_pagamento: dados.forma_pagamento || 'pix',
        obra_id: dados.obra_id
      };

      // Criar pessoa se necessário
      if (dados.fornecedor_cliente && !dados.pessoa_id) {
        const pessoa = await base44.asServiceRole.entities.Pessoa.create({
          nome: dados.fornecedor_cliente,
          tipo: 'fornecedor'
        });
        dados.pessoa_id = pessoa.id;
      }

      // Adicionar campos específicos por categoria
      if (entidade_alvo === 'Material') {
        dadosNovo.fornecedor_id = dados.pessoa_id;
        dadosNovo.descricao_material = dados.descricao;
        dadosNovo.quantidade = 1;
        dadosNovo.unidade = 'un';
        dadosNovo.valor_total = dados.valor;
      } else if (entidade_alvo === 'Frete') {
        dadosNovo.fornecedor_id = dados.pessoa_id;
      } else if (entidade_alvo === 'Imposto') {
        dadosNovo.tipo = 'outro';
        dadosNovo.data_pagamento = dadosNovo.data;
      } else if (entidade_alvo === 'Retirada') {
        dadosNovo.pessoa_id = dados.pessoa_id;
        dadosNovo.motivo = dados.descricao;
      } else if (entidade_alvo === 'Alimentacao') {
        dadosNovo.fornecedor_id = dados.pessoa_id;
        dadosNovo.categoria = 'refeicao';
      } else if (entidade_alvo === 'AluguelEquipamento') {
        dadosNovo.fornecedor_id = dados.pessoa_id;
        dadosNovo.tipo = 'aluguel_equipamento';
        dadosNovo.unidade = 'dia';
        dadosNovo.quantidade = 1;
      } else if (entidade_alvo === 'MaoDeObra') {
        dadosNovo.pessoa_id = dados.pessoa_id;
        dadosNovo.tipo = 'avulso';
      }

      resultado = await base44.asServiceRole.entities[entidade_alvo].create(dadosNovo);
      registroId = resultado.id;
    }

    // === CRIAR RECEITA ===
    else if (acao === 'CREATE_INCOME') {
      const dadosNovo = {
        data: dados.data || new Date().toISOString().split('T')[0],
        valor: dados.valor,
        descricao: dados.descricao,
        forma_pagamento: dados.forma_pagamento || 'pix',
        obra_id: dados.obra_id,
        categoria: 'receita_avulsa'
      };

      resultado = await base44.asServiceRole.entities.LancamentoGenerico.create(dadosNovo);
      registroId = resultado.id;
    }

    // === CRIAR CONTA A PAGAR ===
    else if (acao === 'CREATE_AP') {
      // Criar pessoa se necessário
      if (dados.fornecedor_cliente && !dados.pessoa_id) {
        const pessoa = await base44.asServiceRole.entities.Pessoa.create({
          nome: dados.fornecedor_cliente,
          tipo: 'fornecedor'
        });
        dados.pessoa_id = pessoa.id;
      }

      const dadosNovo = {
        tipo: 'pagar',
        descricao: dados.descricao,
        valor: dados.valor,
        data_vencimento: dados.data_vencimento,
        status: 'pendente',
        obra_id: dados.obra_id,
        fornecedor_id: dados.pessoa_id,
        fornecedor_cliente: dados.fornecedor_cliente,
        categoria: dados.categoria || 'outros'
      };

      resultado = await base44.asServiceRole.entities.ContaFinanceira.create(dadosNovo);
      registroId = resultado.id;
    }

    // === CRIAR CONTA A RECEBER ===
    else if (acao === 'CREATE_AR') {
      // Criar pessoa se necessário
      if (dados.fornecedor_cliente && !dados.pessoa_id) {
        const pessoa = await base44.asServiceRole.entities.Pessoa.create({
          nome: dados.fornecedor_cliente,
          tipo: 'cliente'
        });
        dados.pessoa_id = pessoa.id;
      }

      const dadosNovo = {
        tipo: 'receber',
        descricao: dados.descricao,
        valor: dados.valor,
        data_vencimento: dados.data_vencimento,
        status: 'pendente',
        obra_id: dados.obra_id,
        cliente_id: dados.pessoa_id,
        fornecedor_cliente: dados.fornecedor_cliente,
        categoria: dados.categoria || 'receita'
      };

      resultado = await base44.asServiceRole.entities.ContaFinanceira.create(dadosNovo);
      registroId = resultado.id;
    }

    // === PAGAR CONTA ===
    else if (acao === 'PAY_AP') {
      const conta = await base44.asServiceRole.entities.ContaFinanceira.get(dados.conta_id);
      
      if (conta.tipo !== 'pagar') {
        return Response.json({ error: 'Conta não é do tipo "a pagar"' }, { status: 400 });
      }

      resultado = await base44.asServiceRole.entities.ContaFinanceira.update(dados.conta_id, {
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        valor_pago: conta.valor
      });
      registroId = dados.conta_id;
    }

    // === RECEBER CONTA ===
    else if (acao === 'RECEIVE_AR') {
      const conta = await base44.asServiceRole.entities.ContaFinanceira.get(dados.conta_id);
      
      if (conta.tipo !== 'receber') {
        return Response.json({ error: 'Conta não é do tipo "a receber"' }, { status: 400 });
      }

      resultado = await base44.asServiceRole.entities.ContaFinanceira.update(dados.conta_id, {
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        valor_recebido: conta.valor
      });
      registroId = dados.conta_id;
    }

    // === EDITAR REGISTRO ===
    else if (acao === 'EDIT_RECORD') {
      // Buscar registro para salvar valor anterior
      const registroAnterior = await base44.asServiceRole.entities[entidade_alvo].get(dados.registro_id);
      
      const dadosAtualizacao = {};
      if (dados.valor !== undefined) dadosAtualizacao.valor = dados.valor;
      if (dados.descricao !== undefined) dadosAtualizacao.descricao = dados.descricao;

      resultado = await base44.asServiceRole.entities[entidade_alvo].update(dados.registro_id, dadosAtualizacao);
      registroId = dados.registro_id;
      
      // Salvar valor anterior para desfazer
      dados.valor_anterior = registroAnterior;
    }

    // === EXCLUIR REGISTRO ===
    else if (acao === 'DELETE_RECORD') {
      // Buscar registro para salvar antes de excluir
      const registroAnterior = await base44.asServiceRole.entities[entidade_alvo].get(dados.registro_id);
      
      await base44.asServiceRole.entities[entidade_alvo].delete(dados.registro_id);
      registroId = dados.registro_id;
      
      dados.valor_anterior = registroAnterior;
      resultado = { mensagem: 'Registro excluído com sucesso' };
    }

    else {
      return Response.json({ error: 'Ação não suportada' }, { status: 400 });
    }

    // Registrar log da ação
    await base44.asServiceRole.entities.LogAcaoIA.create({
      usuario_solicitante: user.email,
      comando_original: actionDraft.comando_original,
      acao_realizada: acao,
      entidade_afetada: entidade_alvo,
      registro_id: registroId,
      valor_anterior: dados.valor_anterior || null,
      valor_novo: resultado,
      status: 'executado',
      data_hora: new Date().toISOString()
    });

    return Response.json({
      success: true,
      action: acao,
      result: resultado,
      registro_id: registroId,
      entidade: entidade_alvo
    });

  } catch (error) {
    console.error('Erro ao executar:', error);
    
    // Tratamento de erros específicos
    let errorMessage = error.message || 'Erro ao executar ação';
    
    if (error.message?.includes('required')) {
      errorMessage = 'Campos obrigatórios faltando: verifique os dados';
    } else if (error.message?.includes('not found')) {
      errorMessage = 'Registro não encontrado';
    } else if (error.message?.includes('permission')) {
      errorMessage = 'Sem permissão para esta operação';
    }

    return Response.json({ 
      success: false,
      error: errorMessage,
      details: error.stack?.substring(0, 300)
    }, { status: 500 });
  }
});