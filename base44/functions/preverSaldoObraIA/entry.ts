import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, contas, medicoes, obra } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Calcular totais
    const totalPagar = contas
      .filter(c => c.tipo === 'pagar' && c.status === 'pendente')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const totalReceber = contas
      .filter(c => c.tipo === 'receber' && c.status === 'pendente')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const totalPago = contas
      .filter(c => c.tipo === 'pagar' && c.status === 'pago')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const totalRecebido = contas
      .filter(c => c.tipo === 'receber' && c.status === 'pago')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const saldoAtual = totalRecebido - totalPago;

    // Medições aprovadas e pendentes
    const medicoesAprovadas = medicoes.filter(m => m.status === 'aprovada');
    const medicoesPendentes = medicoes.filter(m => m.status === 'pendente');

    const valorMedicoesRecebidas = medicoesAprovadas.reduce((sum, m) => sum + (m.valor_total || 0), 0);
    const valorMedicoesPendentes = medicoesPendentes.reduce((sum, m) => sum + (m.valor_total || 0), 0);

    // Contexto para IA
    const contexto = `
    Obra: ${obra?.nome || 'N/A'}
    Valor Orçado: R$ ${(obra?.valor_orcado || 0).toLocaleString('pt-BR')}
    Valor do Contrato: R$ ${(obra?.valor_contrato || 0).toLocaleString('pt-BR')}
    
    Situação Financeira Atual:
    - Saldo Atual: R$ ${saldoAtual.toLocaleString('pt-BR')}
    - Total a Pagar (Pendente): R$ ${totalPagar.toLocaleString('pt-BR')}
    - Total a Receber (Pendente): R$ ${totalReceber.toLocaleString('pt-BR')}
    - Total Já Pago: R$ ${totalPago.toLocaleString('pt-BR')}
    - Total Já Recebido: R$ ${totalRecebido.toLocaleString('pt-BR')}
    
    Medições:
    - Valor de Medições Aprovadas: R$ ${valorMedicoesRecebidas.toLocaleString('pt-BR')}
    - Valor de Medições Pendentes: R$ ${valorMedicoesPendentes.toLocaleString('pt-BR')}
    - Total de Medições: ${medicoes.length}
    
    Contas:
    - Total de contas a pagar: ${contas.filter(c => c.tipo === 'pagar').length}
    - Total de contas a receber: ${contas.filter(c => c.tipo === 'receber').length}
    `;

    // Chamar IA para análise
    const resultadoIA = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um analista financeiro especializado em obras de construção civil.
      
      Analise a situação financeira da obra abaixo e forneça:
      1. Previsão de saldo para 30 dias
      2. Previsão de saldo para 90 dias
      3. Nível de risco financeiro (baixo/medio/alto)
      4. Lista de recomendações práticas (3-5 itens)
      5. Análise detalhada da saúde financeira
      
      Dados da Obra:
      ${contexto}
      
      Considere:
      - Contas a vencer nos próximos 30 e 90 dias
      - Medições pendentes que podem ser aprovadas
      - Histórico de pagamentos
      - Valor orçado vs valor do contrato
      - Padrão de gastos
      
      Seja específico e prático nas recomendações.`,
      response_json_schema: {
        type: "object",
        properties: {
          previsao_30_dias: {
            type: "number",
            description: "Saldo previsto em 30 dias"
          },
          previsao_90_dias: {
            type: "number",
            description: "Saldo previsto em 90 dias"
          },
          risco: {
            type: "string",
            enum: ["baixo", "medio", "alto"],
            description: "Nível de risco financeiro"
          },
          recomendacoes: {
            type: "array",
            items: { type: "string" },
            description: "Lista de recomendações"
          },
          analise: {
            type: "string",
            description: "Análise detalhada da situação financeira"
          },
          alertas: {
            type: "array",
            items: { type: "string" },
            description: "Alertas importantes"
          }
        },
        required: ["previsao_30_dias", "previsao_90_dias", "risco", "recomendacoes", "analise"]
      }
    });

    return Response.json({
      ...resultadoIA,
      saldo_atual: saldoAtual,
      total_pagar: totalPagar,
      total_receber: totalReceber,
      obra_nome: obra?.nome
    });

  } catch (error) {
    console.error('Erro ao prever saldo:', error);
    return Response.json({ 
      error: 'Erro ao gerar previsão',
      details: error.message 
    }, { status: 500 });
  }
});