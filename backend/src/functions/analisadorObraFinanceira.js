import { coletarFinanceiroObra, resumoObra } from './_gestaoObras.js';
import { invokeLLM, llmAvailable } from '../llm.js';
import { podeAcessarObra } from '../escopoObra.js';

// "Análise por Obra" → dashboard financeiro + análise textual da IA.
// Retorna { obra, metricas, despesasPorCategoria, analise } no formato que
// ObraKPIs / ObraDespesasChart / ObraAnaliseIA consomem.

const FALLBACK = {
  kpis: 'Indicadores calculados a partir dos dados reais da obra. (Análise textual da IA indisponível no momento.)',
  analise_custos: '',
  riscos: [], oportunidades: [], otimizacao_recursos: [], recomendacoes: [],
};

const SCHEMA = {
  type: 'object',
  properties: {
    kpis: { type: 'string' },
    analise_custos: { type: 'string' },
    riscos: { type: 'array', items: { type: 'object', properties: {
      risco: { type: 'string' }, impacto: { type: 'string' }, mitigacao: { type: 'string' },
    } } },
    oportunidades: { type: 'array', items: { type: 'object', properties: {
      oportunidade: { type: 'string' }, economia: { type: 'string' }, implementacao: { type: 'string' },
    } } },
    otimizacao_recursos: { type: 'array', items: { type: 'object', properties: {
      area: { type: 'string' }, sugestao: { type: 'string' }, beneficio: { type: 'string' },
    } } },
    recomendacoes: { type: 'array', items: { type: 'string' } },
  },
};

export default async function analisadorObraFinanceira({ body, user }) {
  const id = body?.obraId || body?.obra_id;
  if (!id) throw Object.assign(new Error('obraId é obrigatório'), { status: 400 });

  if (!(await podeAcessarObra(user, id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const f = await coletarFinanceiroObra(id);

  const metricas = {
    custoAtual: f.custoAtual,
    custoProjetado: f.custoProjetado,
    margem: f.margem,
    margemProjetada: f.margemProjetada,
    receitaAtual: f.receitaAtual,
    progressoFisico: f.progressoFisico,
  };

  let analise = FALLBACK;
  if (llmAvailable()) {
    try {
      const out = await invokeLLM({
        system: 'Você é um analista financeiro sênior de obras de construção civil. Use os números fornecidos, seja específico e acionável, e escreva em português do Brasil. Nunca invente dados que não foram fornecidos.',
        prompt: `Analise a saúde financeira desta obra.\n\n${resumoObra(f)}\n\nProduza:\n- kpis: parágrafo com os KPIs críticos e o que indicam.\n- analise_custos: parágrafo analisando os custos por categoria e o ritmo de gasto vs. progresso físico.\n- riscos: riscos financeiros (campos: risco, impacto, mitigacao).\n- oportunidades: oportunidades de economia (campos: oportunidade, economia, implementacao).\n- otimizacao_recursos: estratégias de otimização (campos: area, sugestao, beneficio).\n- recomendacoes: até 5 ações concretas para os próximos 30 dias.`,
        response_json_schema: SCHEMA,
      });
      if (out && typeof out === 'object' && !out._raw) analise = { ...FALLBACK, ...out };
    } catch { /* mantém o fallback — a página renderiza com os KPIs reais */ }
  }

  return {
    obra: { nome: f.obra.nome, status: f.obra.status, id: f.obra.id },
    metricas,
    despesasPorCategoria: f.despesasPorCategoria,
    analise,
  };
}
