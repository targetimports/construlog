import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dados, contexto = {} } = await req.json();

    if (!dados || Object.keys(dados).length === 0) {
      return Response.json({ error: 'Dados para análise são obrigatórios' }, { status: 400 });
    }

    const prompt = `Você é um especialista em análise de dados de construção civil.
Analise os dados abaixo e identifique anomalias, insights e oportunidades de melhoria.

Contexto:
- Obra: ${contexto.obraNome || 'Não especificada'}
- Período: ${contexto.periodo || 'Não especificado'}
- Tipo: ${contexto.tipo || 'Análise geral'}

Dados:
${JSON.stringify(dados, null, 2)}

Retorne análise estruturada com:

## 🚨 Anomalias Detectadas
- Lista de valores anormais ou preocupantes

## 💡 Insights Principais
- Descobertas interessantes ou padrões

## 📈 Recomendações
- Ações sugeridas baseadas na análise

Seja conciso e direto ao ponto. Use emojis para melhor visualização.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false
    });

    // Classificar insights por severidade
    const analise = {
      anomalias: extrairAnomalias(response),
      insights: extrairInsights(response),
      recomendacoes: extrairRecomendacoes(response),
      analiseCompleta: response,
      timestamp: new Date().toISOString(),
      usuario: user.email
    };

    return Response.json(analise);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extrairAnomalias(texto) {
  const match = texto.match(/🚨 Anomalias Detectadas([\s\S]*?)(?=## 💡|$)/);
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
    .map(l => l.replace(/^[-•]\s*/, '').trim())
    .filter(l => l.length > 0);
}

function extrairInsights(texto) {
  const match = texto.match(/💡 Insights Principais([\s\S]*?)(?=## 📈|$)/);
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
    .map(l => l.replace(/^[-•]\s*/, '').trim())
    .filter(l => l.length > 0);
}

function extrairRecomendacoes(texto) {
  const match = texto.match(/📈 Recomendações([\s\S]*?)$/);
  if (!match) return [];
  
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
    .map(l => l.replace(/^[-•]\s*/, '').trim())
    .filter(l => l.length > 0);
}