import { store } from '../entityStore.js';
import { can } from '../rbac.js';
import { invokeLLM, llmAvailable } from '../llm.js';
import { coletarFinanceiroObra, resumoObra } from './_gestaoObras.js';
import { isGlobal, empresaIdDe } from '../middleware.js';
import { podeAcessarObra } from '../escopoObra.js';

// Perguntas (somente leitura). Monta um resumo financeiro REAL da obra (custos
// por categoria via LancamentoCustoObra, receita, margem) + contas a pagar/
// receber, e responde com a IA. Gated por FINANCEIRO_VIEW.

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function resumoContas(contas) {
  const hoje = new Date();
  const soma = (arr) => arr.reduce((s, c) => s + num(c.valor), 0);
  const pagar = contas.filter((c) => c.tipo === 'pagar');
  const receber = contas.filter((c) => c.tipo === 'receber');
  const aPagar = pagar.filter((c) => c.status !== 'pago');
  const aReceber = receber.filter((c) => c.status !== 'recebido');
  const atrasadas = aPagar.filter((c) => c.data_vencimento && new Date(c.data_vencimento) < hoje);
  return `Contas a pagar (pendentes): ${fmtBRL(soma(aPagar))} (${aPagar.length}); atrasadas: ${atrasadas.length} = ${fmtBRL(soma(atrasadas))}
Contas a receber (pendentes): ${fmtBRL(soma(aReceber))} (${aReceber.length})
Já pago: ${fmtBRL(soma(pagar.filter((c) => c.status === 'pago')))} | Já recebido: ${fmtBRL(soma(receber.filter((c) => c.status === 'recebido')))}`;
}

export default async function assistenteConsulta({ body, user }) {
  const pergunta = String(body?.pergunta || '').trim();
  const ctx = body?.contexto || {};
  if (!pergunta) return { success: false };

  if (!can(user, 'FINANCEIRO_VIEW')) {
    return { success: true, resposta: 'Você não tem permissão para consultar os dados financeiros.' };
  }

  let resumo = '';
  if (ctx.obraId) {
    // Isolamento multi-empresa: membro não-global não pode consultar obra de outra empresa.
    if (!(await podeAcessarObra(user, ctx.obraId))) {
      return { success: true, resposta: 'Você não tem acesso aos dados desta obra (outra empresa).' };
    }
    // Resumo rico da obra (gastos = custo realizado, por categoria, receita, margem).
    try {
      const f = await coletarFinanceiroObra(ctx.obraId);
      resumo = resumoObra(f);
    } catch {
      resumo = 'Não foi possível carregar os dados desta obra.';
    }
  } else {
    // Global: total de custos lançados em todas as obras.
    let lcs = await store.filter('LancamentoCustoObra', {}, '-data_lancamento', 20000).catch(() => []);
    // Isolamento multi-empresa: membro não-global só vê custos da própria empresa.
    if (!isGlobal(user)) {
      const eid = empresaIdDe(user);
      lcs = lcs.filter((r) => r.empresa_id === eid);
    }
    const porCat = {};
    for (const l of lcs) {
      const c = String(l.categoria || 'outros').toLowerCase();
      porCat[c] = num(porCat[c]) + num(l.valor);
    }
    const total = Object.values(porCat).reduce((s, v) => s + v, 0);
    const linhas = Object.entries(porCat).map(([k, v]) => `  - ${k}: ${fmtBRL(v)}`).join('\n') || '  (sem custos lançados)';
    resumo = `Custo total realizado (todas as obras): ${fmtBRL(total)}\nPor categoria:\n${linhas}`;
  }

  // Contas a pagar/receber (escopo da obra selecionada ou geral).
  let contas = await store.filter('ContaFinanceira', ctx.obraId ? { obra_id: ctx.obraId } : {}, '-data_vencimento', 5000).catch(() => []);
  // Isolamento multi-empresa: no ramo global, membro não-global só vê contas da própria empresa.
  // (No ramo por-obra, a obra já foi validada por podeAcessarObra e o filtro é por obra_id.)
  if (!ctx.obraId && !isGlobal(user)) {
    const eid = empresaIdDe(user);
    contas = contas.filter((r) => r.empresa_id === eid);
  }
  resumo += `\n\n${resumoContas(contas)}`;

  if (!llmAvailable()) return { success: true, resposta: resumo };

  try {
    const resposta = await invokeLLM({
      system: `Você é um assistente financeiro de obras. Responda de forma objetiva e em português do Brasil COM BASE nos dados abaixo. "Gastos", "custos" e "despesas" referem-se ao custo realizado. Se algum número for zero, explique que ainda não há lançamentos correspondentes (não responda apenas "não há informação"). Nunca invente números que não estejam nos dados.`,
      prompt: `Dados financeiros disponíveis:\n${resumo}\n\nPergunta do usuário: ${pergunta}`,
    });
    return { success: true, resposta: String(resposta || resumo) };
  } catch {
    return { success: true, resposta: resumo };
  }
}
