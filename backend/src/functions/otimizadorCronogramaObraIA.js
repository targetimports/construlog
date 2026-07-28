import { coletarFinanceiroObra, resumoObra, num } from './_gestaoObras.js';
import { invokeLLM, llmAvailable } from '../llm.js';
import { podeAcessarObra } from '../escopoObra.js';

// Otimizador de Cronograma. Estima risco de atraso e previsão de conclusão a
// partir do progresso físico vs. tempo decorrido; a IA detalha gargalos,
// otimizações e plano de ação. Retorna { analise }.

const SCHEMA = {
  type: 'object',
  properties: {
    gargalos_identificados: { type: 'array', items: { type: 'string' } },
    metricas_comparativas: { type: 'object', properties: {
      tempo_medio_historico: { type: 'string' }, comparacao: { type: 'string' },
    } },
    otimizacoes: { type: 'array', items: { type: 'object', properties: {
      titulo: { type: 'string' }, descricao: { type: 'string' }, impacto: { type: 'string' },
    } } },
    recursos_necessarios: { type: 'array', items: { type: 'object', properties: {
      recurso: { type: 'string' }, valor: { type: 'string' },
    } } },
    plano_acao: { type: 'array', items: { type: 'string' } },
  },
};

const diasEntre = (a, b) => Math.round((b - a) / (24 * 60 * 60 * 1000));

export default async function otimizadorCronogramaObraIA({ body, user }) {
  const id = body?.obraId || body?.obra_id;
  if (!id) throw Object.assign(new Error('obraId é obrigatório'), { status: 400 });

  if (!(await podeAcessarObra(user, id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const f = await coletarFinanceiroObra(id);
  const o = f.obra;
  const hoje = new Date();
  const inicio = o.data_inicio ? new Date(o.data_inicio) : null;
  const fimPrevisto = o.data_prevista_fim ? new Date(o.data_prevista_fim) : null;

  // Previsão de conclusão por ritmo: progresso/% por dia decorrido.
  let previsaoConclusao = o.data_prevista_fim || null;
  let diasAtrasoPrevisto = 0;
  if (inicio && f.progressoFisico > 0) {
    const decorridos = Math.max(1, diasEntre(inicio, hoje));
    const ritmo = f.progressoFisico / decorridos; // % por dia
    const diasRestantes = ritmo > 0 ? Math.round((100 - f.progressoFisico) / ritmo) : 0;
    const dataFimEstimada = new Date(hoje.getTime() + diasRestantes * 24 * 60 * 60 * 1000);
    previsaoConclusao = dataFimEstimada.toISOString().slice(0, 10);
    if (fimPrevisto) diasAtrasoPrevisto = diasEntre(fimPrevisto, dataFimEstimada);
  }

  // Risco de atraso (0-10) a partir dos dias de atraso previstos.
  let riscoAtraso = 0;
  if (diasAtrasoPrevisto > 0) riscoAtraso = Math.min(10, Math.round(diasAtrasoPrevisto / 7) + 2);
  else if (fimPrevisto && fimPrevisto < hoje && f.progressoFisico < 100) riscoAtraso = 9;

  const analise = {
    risco_atraso: riscoAtraso,
    previsao_conclusao: previsaoConclusao,
    dias_atraso_previsto: diasAtrasoPrevisto,
    gargalos_identificados: [],
    metricas_comparativas: null,
    otimizacoes: [],
    recursos_necessarios: {},
    plano_acao: [],
  };

  if (llmAvailable()) {
    try {
      const out = await invokeLLM({
        system: 'Você é um planejador de obras (engenharia de cronograma). Use os números fornecidos. Escreva em português do Brasil, objetivo e acionável.',
        prompt: `Analise o cronograma desta obra e proponha otimizações.\n\n${resumoObra(f)}\n\nPrevisão de conclusão estimada por ritmo: ${previsaoConclusao || '-'} (atraso previsto: ${diasAtrasoPrevisto} dias). Risco de atraso: ${riscoAtraso}/10.\n\nProduza:\n- gargalos_identificados: principais gargalos.\n- metricas_comparativas: { tempo_medio_historico, comparacao } comparando com obras semelhantes do setor.\n- otimizacoes: ações para acelerar (campos: titulo, descricao, impacto).\n- recursos_necessarios: recursos críticos recomendados (campos: recurso, valor).\n- plano_acao: passos prioritários em ordem.`,
        response_json_schema: SCHEMA,
      });
      if (out && typeof out === 'object' && !out._raw) {
        analise.gargalos_identificados = out.gargalos_identificados || [];
        analise.metricas_comparativas = out.metricas_comparativas || null;
        analise.otimizacoes = out.otimizacoes || [];
        analise.plano_acao = out.plano_acao || [];
        // recursos_necessarios: array {recurso, valor} → objeto { recurso: valor }.
        const rn = {};
        for (const it of (out.recursos_necessarios || [])) {
          if (it?.recurso) rn[it.recurso] = it.valor ?? '';
        }
        analise.recursos_necessarios = rn;
      }
    } catch { /* mantém números calculados */ }
  }

  return { analise };
}
