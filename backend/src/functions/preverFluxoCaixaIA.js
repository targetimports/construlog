import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { invokeLLM, llmAvailable } from '../llm.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Previsão de fluxo de caixa: números calculados de ContaFinanceira (a receber/
// pagar pendentes) + análise qualitativa da IA (alertas, sugestões).

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const ymd = (d) => d.toISOString().slice(0, 10);

export default async function preverFluxoCaixaIA({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const obraId = body?.obra_id;

  let contas = await store.filter('ContaFinanceira', {}, '-data_vencimento', 100000).catch(() => []);
  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    contas = contas.filter((c) => c.empresa_id === eid);
  }
  if (obraId) contas = contas.filter((c) => c.obra_id === obraId);

  const hoje = new Date();
  const hojeStr = ymd(hoje);
  const limite = (dias) => ymd(new Date(hoje.getTime() + dias * 86400000));
  const sum = (arr) => r2(arr.reduce((s, c) => s + num(c.valor), 0));

  const receber = contas.filter((c) => c.tipo === 'receber' && c.status !== 'recebido' && c.status !== 'cancelado');
  const pagar = contas.filter((c) => c.tipo === 'pagar' && c.status !== 'pago' && c.status !== 'cancelado');

  const totalReceitasFuturas = sum(receber);
  const totalDespesasFuturas = sum(pagar);
  const atrasadas = receber.filter((c) => c.data_vencimento && c.data_vencimento < hojeStr);
  const taxaInadimplencia = totalReceitasFuturas > 0 ? r2((sum(atrasadas) / totalReceitasFuturas) * 100) : 0;

  const proj = (dias) => {
    const lim = limite(dias);
    const r = sum(receber.filter((c) => c.data_vencimento && c.data_vencimento <= lim));
    const p = sum(pagar.filter((c) => c.data_vencimento && c.data_vencimento <= lim));
    return r2(r - p);
  };
  const p30 = proj(30), p60 = proj(60), p90 = proj(90);
  const nivel_risco = p30 < 0 ? 'alto' : p90 < 0 ? 'medio' : 'baixo';
  const tendencia = p90 >= p30 ? 'estável' : 'queda';

  const dados_base = {
    total_receitas_futuras: totalReceitasFuturas,
    total_despesas_futuras: totalDespesasFuturas,
    taxa_inadimplencia: taxaInadimplencia,
    quantidade_contas_pendentes: receber.length + pagar.length,
  };

  const previsao = {
    previsao_fluxo_caixa: { previsao_30_dias: p30, previsao_60_dias: p60, previsao_90_dias: p90, nivel_risco, tendencia },
    alertas_criticos: [],
    analise_detalhada: { pontos_atencao: [], oportunidades: [], riscos_identificados: [] },
    sugestoes_otimizacao: [],
  };

  if (llmAvailable()) {
    try {
      const schema = {
        type: 'object',
        properties: {
          alertas_criticos: { type: 'array', items: { type: 'object', properties: { mensagem: { type: 'string' }, acao_recomendada: { type: 'string' }, gravidade: { type: 'string' } } } },
          analise_detalhada: { type: 'object', properties: { pontos_atencao: { type: 'array', items: { type: 'string' } }, oportunidades: { type: 'array', items: { type: 'string' } }, riscos_identificados: { type: 'array', items: { type: 'string' } } } },
          sugestoes_otimizacao: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, descricao: { type: 'string' }, prioridade: { type: 'string' }, impacto_estimado: { type: 'string' }, categoria: { type: 'string' } } } },
        },
      };
      const out = await invokeLLM({
        system: 'Você é um analista financeiro de fluxo de caixa em construção civil. Baseie-se nos números fornecidos. Escreva em português do Brasil, objetivo e acionável.',
        prompt: `Dados de fluxo de caixa:\n- Receitas futuras (a receber pendente): R$ ${totalReceitasFuturas}\n- Despesas futuras (a pagar pendente): R$ ${totalDespesasFuturas}\n- Projeção líquida 30d: R$ ${p30} | 60d: R$ ${p60} | 90d: R$ ${p90}\n- Taxa de inadimplência (a receber atrasado): ${taxaInadimplencia}%\n- Nível de risco: ${nivel_risco}\n\nProduza:\n- alertas_criticos: {mensagem, acao_recomendada, gravidade}.\n- analise_detalhada: {pontos_atencao[], oportunidades[], riscos_identificados[]}.\n- sugestoes_otimizacao: {titulo, descricao, prioridade, impacto_estimado, categoria}.`,
        response_json_schema: schema,
      });
      if (out && typeof out === 'object' && !out._raw) {
        previsao.alertas_criticos = out.alertas_criticos || [];
        previsao.analise_detalhada = {
          pontos_atencao: out.analise_detalhada?.pontos_atencao || [],
          oportunidades: out.analise_detalhada?.oportunidades || [],
          riscos_identificados: out.analise_detalhada?.riscos_identificados || [],
        };
        previsao.sugestoes_otimizacao = out.sugestoes_otimizacao || [];
      }
    } catch { /* mantém números calculados, listas vazias */ }
  }

  return { sucesso: true, previsao, dados_base };
}
