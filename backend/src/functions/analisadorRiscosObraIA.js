import { coletarFinanceiroObra, resumoObra } from './_gestaoObras.js';
import { invokeLLM, llmAvailable } from '../llm.js';
import { podeAcessarObra } from '../escopoObra.js';

// Gestor de Riscos Proativo da obra. As métricas vêm dos dados reais; a IA
// identifica os riscos e ações de mitigação. Retorna { riscos, metricas }.

const SCHEMA = {
  type: 'object',
  properties: {
    riscos_identificados: { type: 'array', items: { type: 'object', properties: {
      descricao: { type: 'string' },
      tipo: { type: 'string' },
      area_afetada: { type: 'string' },
      severidade: { type: 'number', description: '0 a 10' },
    } } },
    acoes_mitigacao: { type: 'array', items: { type: 'object', properties: {
      acao: { type: 'string' }, responsavel: { type: 'string' }, prazo: { type: 'string' }, custo_estimado: { type: 'string' },
    } } },
    indicadores_alerta: { type: 'array', items: { type: 'string' } },
    impactos_potenciais: { type: 'array', items: { type: 'string' } },
    prioridade_intervencao: { type: 'array', items: { type: 'string' } },
  },
};

export default async function analisadorRiscosObraIA({ body, user }) {
  const id = body?.obraId || body?.obra_id;
  if (!id) throw Object.assign(new Error('obraId é obrigatório'), { status: 400 });

  if (!(await podeAcessarObra(user, id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const f = await coletarFinanceiroObra(id);

  const riscos = {
    riscos_identificados: [],
    acoes_mitigacao: [],
    indicadores_alerta: [],
    impactos_potenciais: [],
    prioridade_intervencao: [],
  };

  if (llmAvailable()) {
    try {
      const out = await invokeLLM({
        system: 'Você é um gestor de riscos de obras de construção civil. Baseie-se nos dados fornecidos. Escreva em português do Brasil. Atribua severidade de 0 a 10 (8+ crítico, 5-7 alto, <5 médio).',
        prompt: `Identifique e analise os riscos desta obra (cronograma, orçamento, fornecedores, fluxo de caixa, execução).\n\n${resumoObra(f)}\n\nProduza:\n- riscos_identificados: cada um com descricao, tipo, area_afetada e severidade (0-10).\n- acoes_mitigacao: ações com responsavel, prazo e custo_estimado.\n- indicadores_alerta: KPIs a monitorar.\n- impactos_potenciais: consequências caso os riscos se materializem.\n- prioridade_intervencao: ordem de prioridade de atuação.`,
        response_json_schema: SCHEMA,
      });
      if (out && typeof out === 'object' && !out._raw) {
        // Garante um id estável por risco (a UI usa risco.id como key e para expandir).
        riscos.riscos_identificados = (out.riscos_identificados || []).map((r, i) => ({
          id: `risco-${i}`,
          descricao: r.descricao || '',
          tipo: r.tipo || 'geral',
          area_afetada: r.area_afetada || '-',
          severidade: Math.max(0, Math.min(10, Math.round(Number(r.severidade) || 0))),
        }));
        riscos.acoes_mitigacao = out.acoes_mitigacao || [];
        riscos.indicadores_alerta = out.indicadores_alerta || [];
        riscos.impactos_potenciais = out.impactos_potenciais || [];
        riscos.prioridade_intervencao = out.prioridade_intervencao || [];
      }
    } catch { /* mantém listas vazias */ }
  }

  const metricas = {
    total_itens_risco: riscos.riscos_identificados.length,
    total_contratos_risco: f.contratosRisco,
    contas_atrasadas: f.contasAtrasadas,
  };

  return { riscos, metricas };
}
