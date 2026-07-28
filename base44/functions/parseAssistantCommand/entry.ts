import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Parse de comando de texto para ActionDraft estruturado
 * Suporta: despesas, receitas, contas a pagar/receber, pagamentos, recebimentos
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { comando, contexto } = await req.json();

    if (!comando || typeof comando !== 'string') {
      return Response.json({ error: 'Comando inválido' }, { status: 400 });
    }

    // Extrair valor monetário brasileiro (R$ 13.167,55)
    const regexValor = /R\$?\s*([\d.]+,\d{2})/i;
    const matchValor = comando.match(regexValor);
    let valorExtraido = null;
    
    if (matchValor) {
      const valorStr = matchValor[1].replace(/\./g, '').replace(',', '.');
      valorExtraido = parseFloat(valorStr);
    }

    // Data atual para contexto
    const currentDate = new Date().toISOString().split('T')[0];

    // Parser inteligente com IA - SCHEMA ESTRITO
    let interpretacao;
    try {
      interpretacao = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um interpretador determinístico de comandos financeiros em português do Brasil.
Converta a frase do usuário em um JSON ActionDraft seguindo o schema.

COMANDO: "${comando}"

CONTEXTO:
- current_date: ${currentDate}
- obraId: ${contexto?.obraId || null}
- user: ${user.email}
- perfil: ${user.perfil_sistema || user.cargo || 'user'}

REGRAS:
- Retorne SOMENTE JSON válido.
- Se faltar dado obrigatório, preencha "missing_fields" e marque needs_clarification=true.
- Valores monetários: converter "500 BRL", "R$500", "500 reais" para number 500.00 e currency="BRL".
- Datas:
  - "hoje" = ${currentDate}
  - "amanhã" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
  - se não citar data: usar ${currentDate}
- Se não citar obra e existir obra selecionada no contexto, use context.obraId.
- Se não houver obra selecionada e a ação exigir obra, marcar missing_fields=["obraId"].

AÇÕES SUPORTADAS:
- CREATE_EXPENSE: criar despesa (material, frete, combustível, etc)
- CREATE_INCOME: criar receita
- CREATE_AP: criar conta a pagar (AP = Accounts Payable)
- CREATE_AR: criar conta a receber (AR = Accounts Receivable)
- PAY_AP: pagar conta a pagar
- RECEIVE_AR: receber conta a receber
- EDIT_RECORD: editar registro existente
- DELETE_RECORD: excluir registro

CATEGORIAS: material, frete, combustivel, mao_obra, equipamento, imposto, taxa, alimentacao, aluguel, estadia, retirada, investimento, empreita, servico, outros

EXEMPLOS:
"bota 500 BRL combustível hoje" → CREATE_EXPENSE, category="combustivel", amount=500
"criar conta a pagar 3500 fornecedor posto ABC vence dia 20" → CREATE_AP, supplierName="posto ABC", amount=3500, dueDate="${currentDate.substring(0,8)}20"
"recebi 1200 do cliente João" → CREATE_INCOME, customerName="João", amount=1200

Responda APENAS JSON válido:`,
      response_json_schema: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["CREATE_EXPENSE", "CREATE_INCOME", "CREATE_AP", "CREATE_AR", 
                   "PAY_AP", "RECEIVE_AR", "EDIT_RECORD", "DELETE_RECORD"] 
          },
          confidence: { type: "number" },
          needs_clarification: { type: "boolean" },
          missing_fields: { type: "array", items: { type: "string" } },
          entities: {
            type: "object",
            properties: {
              obraId: { type: "string" },
              category: { type: "string" },
              supplierName: { type: "string" },
              customerName: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              date: { type: "string" },
              description: { type: "string" },
              dueDate: { type: "string" },
              recordRef: { type: "string" }
            }
          }
        },
        required: ["action", "confidence", "needs_clarification", "entities"]
      }
    });
    } catch (llmError) {
      console.error('Erro na LLM:', llmError);
      return Response.json({
        success: false,
        error: 'Não consegui entender o comando',
        hint: 'Tente reformular ou use um dos exemplos',
        details: llmError.message
      }, { status: 400 });
    }

    // Validar estrutura retornada
    if (!interpretacao || !interpretacao.action || !interpretacao.entities) {
      return Response.json({
        success: false,
        error: 'Resposta inválida da IA',
        hint: 'Tente reformular o comando'
      }, { status: 400 });
    }

    // Usar valor extraído se disponível
    if (valorExtraido && !interpretacao.entities.amount) {
      interpretacao.entities.amount = valorExtraido;
    }

    // Usar obraId do contexto se não veio da IA
    if (contexto?.obraId && !interpretacao.entities.obraId) {
      interpretacao.entities.obraId = contexto.obraId;
    }

    // Verificar se precisa clarificação
    if (interpretacao.needs_clarification) {
      return Response.json({
        success: false,
        needs_clarification: true,
        missing_fields: interpretacao.missing_fields,
        message: `Dados faltando: ${interpretacao.missing_fields.join(', ')}`,
        actionDraft: null
      });
    }

    // Construir ActionDraft estruturado
    const actionDraft = {
      id: crypto.randomUUID(),
      comando_original: comando,
      acao: interpretacao.action,
      confidence: interpretacao.confidence,
      entidade_alvo: mapearEntidadeV2(interpretacao),
      dados: {
        obra_id: interpretacao.entities.obraId || contexto?.obraId,
        categoria: interpretacao.entities.category,
        valor: interpretacao.entities.amount,
        descricao: interpretacao.entities.description,
        data: interpretacao.entities.date || currentDate,
        data_vencimento: interpretacao.entities.dueDate,
        fornecedor_cliente: interpretacao.entities.supplierName || interpretacao.entities.customerName,
        forma_pagamento: 'pix',
        conta_id: interpretacao.entities.recordRef?.startsWith('id:') ? interpretacao.entities.recordRef.substring(3) : null,
        registro_id: interpretacao.entities.recordRef?.startsWith('id:') ? interpretacao.entities.recordRef.substring(3) : null,
        recordRef: interpretacao.entities.recordRef,
        usuario_solicitante: user.email,
        usuario_perfil: user.perfil_sistema || user.cargo,
        timestamp: new Date().toISOString()
      },
      contexto: {
        userId: user.id,
        userEmail: user.email,
        perfil: user.perfil_sistema || user.cargo,
        obraId: contexto?.obraId,
        empresaId: contexto?.empresaId
      },
      status: 'draft',
      requires_approval: requiredApprovalV2(user, interpretacao),
      validation_errors: []
    };

    return Response.json({
      success: true,
      actionDraft
    });

  } catch (error) {
    console.error('Erro no parse:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar comando',
      hint: 'Tente reformular o comando'
    }, { status: 500 });
  }
});

function mapearEntidadeV2(interpretacao) {
  const { action, entities } = interpretacao;
  
  if (action === 'CREATE_EXPENSE') {
    const mapa = {
      material: 'Material',
      frete: 'Frete',
      combustivel: 'Frete',
      combustível: 'Frete',
      mao_obra: 'MaoDeObra',
      imposto: 'Imposto',
      alimentacao: 'Alimentacao',
      alimentação: 'Alimentacao',
      aluguel: 'AluguelEquipamento',
      estadia: 'Estadia',
      retirada: 'Retirada',
      investimento: 'Investimento',
      empreita: 'Empreita',
      servico: 'LancamentoGenerico',
      outros: 'LancamentoGenerico'
    };
    return mapa[entities.category?.toLowerCase()] || 'LancamentoGenerico';
  }
  
  if (action === 'CREATE_INCOME') {
    return 'LancamentoGenerico';
  }
  
  if (action === 'CREATE_AP' || action === 'PAY_AP') {
    return 'ContaFinanceira';
  }
  
  if (action === 'CREATE_AR' || action === 'RECEIVE_AR') {
    return 'ContaFinanceira';
  }
  
  if (action === 'EDIT_RECORD' || action === 'DELETE_RECORD') {
    // Será definido na execução baseado no recordRef
    return 'ContaFinanceira'; // Default
  }
  
  return null;
}

function requiredApprovalV2(user, interpretacao) {
  // Admin não precisa aprovação
  if (user.role === 'admin' || user.perfil_sistema === 'admin') {
    return false;
  }
  
  // Financeiro e Diretoria não precisam aprovação para operações financeiras
  if (['financeiro', 'diretoria', 'executivo'].includes(user.perfil_sistema || user.cargo)) {
    return false;
  }
  
  // Valores acima de 5.000 requerem aprovação
  if (interpretacao.entities.amount > 5000) {
    return true;
  }
  
  // Ações de edição/exclusão requerem aprovação para não-admin
  if (['EDIT_RECORD', 'DELETE_RECORD'].includes(interpretacao.action)) {
    return true;
  }
  
  return false;
}