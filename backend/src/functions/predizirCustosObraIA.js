import { coletarFinanceiroObra, resumoObra, confiancaModelo, r2, num } from './_gestaoObras.js';
import { invokeLLM, llmAvailable } from '../llm.js';
import { podeAcessarObra } from '../escopoObra.js';

// Análise Preditiva de Custos da obra. Os NÚMEROS são calculados a partir dos
// dados reais (garantia de consistência); a IA preenche apenas as listas
// qualitativas (alertas, pontos críticos, otimizações, KPIs a acompanhar).
// Retorna { predicao, metricas_atuais }.

const SCHEMA = {
  type: 'object',
  properties: {
    alertas: { type: 'array', items: { type: 'string' } },
    pontos_criticos: { type: 'array', items: { type: 'string' } },
    otimizacoes_financeiras: { type: 'array', items: { type: 'object', properties: {
      titulo: { type: 'string' }, descricao: { type: 'string' }, economia_potencial: { type: 'string' },
    } } },
    acompanhamento_recomendado: { type: 'array', items: { type: 'string' } },
  },
};

export default async function predizirCustosObraIA({ body, user }) {
  const id = body?.obraId || body?.obra_id;
  if (!id) throw Object.assign(new Error('obraId é obrigatório'), { status: 400 });

  if (!(await podeAcessarObra(user, id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const f = await coletarFinanceiroObra(id);

  const previsaoCustoFinal = f.custoProjetado;
  const desvioPrevisto = f.valorOrcado > 0 ? r2(((previsaoCustoFinal - f.valorOrcado) / f.valorOrcado) * 100) : 0;
  // Risco de estouramento (0-10) escalado pelo desvio previsto.
  const riscoEstouramento = Math.max(0, Math.min(10, Math.round(desvioPrevisto / 3)));

  const predicao = {
    desvio_percentual_previsto: desvioPrevisto,
    previsao_custo_final: previsaoCustoFinal,
    risco_estouramento: riscoEstouramento,
    alertas: [],
    pontos_criticos: [],
    otimizacoes_financeiras: [],
    acompanhamento_recomendado: [],
  };

  const metricas_atuais = {
    valor_orcado: f.valorOrcado,
    valor_realizado: f.custoAtual,
    confianca_modelo: confiancaModelo(f),
  };

  if (llmAvailable()) {
    try {
      const out = await invokeLLM({
        system: 'Você é um controller de custos de obras. Baseie-se nos números fornecidos. Escreva em português do Brasil, de forma objetiva e acionável.',
        prompt: `Com base nos dados desta obra, gere a parte qualitativa de uma previsão de custos.\n\n${resumoObra(f)}\n\nDesvio previsto sobre o orçado: ${desvioPrevisto}%. Risco de estouramento: ${riscoEstouramento}/10.\n\nProduza:\n- alertas: avisos imediatos relevantes.\n- pontos_criticos: itens/categorias que mais ameaçam o custo final.\n- otimizacoes_financeiras: ações de economia (campos: titulo, descricao, economia_potencial).\n- acompanhamento_recomendado: KPIs a monitorar.`,
        response_json_schema: SCHEMA,
      });
      if (out && typeof out === 'object' && !out._raw) {
        predicao.alertas = out.alertas || [];
        predicao.pontos_criticos = out.pontos_criticos || [];
        predicao.otimizacoes_financeiras = out.otimizacoes_financeiras || [];
        predicao.acompanhamento_recomendado = out.acompanhamento_recomendado || [];
      }
    } catch { /* mantém números calculados, listas vazias */ }
  }

  return { predicao, metricas_atuais };
}
