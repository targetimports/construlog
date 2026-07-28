import { invokeLLM, llmAvailable } from '../llm.js';
import { store } from '../entityStore.js';
import { ACTION_SPEC, APPROVAL_THRESHOLD, num, hoje } from './_assistenteOperacional.js';

// Passo 1: interpreta o comando em linguagem natural → actionDraft estruturado.
// Não executa nada; só monta o rascunho que será validado e confirmado.
//
// Para pagar/receber/excluir, quando o usuário não informa o ID, a conta é
// RESOLVIDA por descrição/fornecedor/valor com desambiguação segura:
//   - 0 correspondências  → pede para refinar
//   - várias              → lista as candidatas para o usuário escolher
//   - exatamente 1        → usa essa (nunca age em correspondência ambígua)

const SCHEMA = {
  type: 'object',
  properties: {
    acao: { type: 'string', enum: [...Object.keys(ACTION_SPEC), 'DESCONHECIDA'] },
    dados: {
      type: 'object',
      properties: {
        valor: { type: 'number' },
        descricao: { type: 'string' },
        categoria: { type: 'string' },
        data: { type: 'string', description: 'AAAA-MM-DD' },
        fornecedor_cliente: { type: 'string' },
        data_vencimento: { type: 'string', description: 'AAAA-MM-DD' },
      },
    },
    registro_id: { type: 'string' },
    confidence: { type: 'number', description: '0 a 1' },
  },
};

// Ações cujo alvo pode ser resolvido por descrição/fornecedor/valor (dados = critério de busca).
const RESOLVIVEIS = new Set(['PAY_AP', 'RECEIVE_AR', 'DELETE_RECORD']);

const descConta = (c) =>
  `${c.descricao || c.fornecedor_cliente || 'conta'} R$ ${num(c.valor).toLocaleString('pt-BR')}${c.data_vencimento ? ` venc ${c.data_vencimento}` : ''}`;

async function resolverConta(entidade, acao, dados, obraId) {
  const filtro = {};
  if (obraId) filtro.obra_id = obraId;
  if (acao === 'PAY_AP') filtro.tipo = 'pagar';
  if (acao === 'RECEIVE_AR') filtro.tipo = 'receber';

  let contas = await store.filter(entidade, filtro, '-data_vencimento', 2000).catch(() => []);
  if (acao === 'PAY_AP') contas = contas.filter((c) => c.status !== 'pago');
  if (acao === 'RECEIVE_AR') contas = contas.filter((c) => c.status !== 'recebido');

  const termo = String(dados.descricao || dados.fornecedor_cliente || '').toLowerCase().trim();
  const valor = num(dados.valor);
  let cand = contas;
  if (termo) {
    cand = cand.filter((c) =>
      String(c.descricao || '').toLowerCase().includes(termo) ||
      String(c.fornecedor_cliente || '').toLowerCase().includes(termo));
  }
  if (valor > 0) {
    const exatos = cand.filter((c) => Math.abs(num(c.valor) - valor) < 0.01);
    if (exatos.length) cand = exatos; // valor exato tem prioridade na desambiguação
  }
  return cand;
}

export default async function parseAssistantCommand({ body }) {
  const comando = String(body?.comando || '').trim();
  const ctx = body?.contexto || {};
  if (!comando) return { success: false };
  if (!llmAvailable()) return { success: false, error: 'IA não configurada no servidor.' };

  let out;
  try {
    out = await invokeLLM({
      system: `Você converte comandos em português para ações financeiras estruturadas de um ERP de obras. Hoje é ${hoje()}.
Ações possíveis:
- CREATE_EXPENSE: despesa já paga.
- CREATE_INCOME: receita já recebida.
- CREATE_AP: conta a pagar pendente.
- CREATE_AR: conta a receber pendente.
- PAY_AP: pagar uma conta a pagar existente.
- RECEIVE_AR: receber uma conta a receber existente.
- EDIT_RECORD / DELETE_RECORD: editar/excluir um registro existente.
Extraia valor (número), descricao, categoria, data (AAAA-MM-DD), fornecedor_cliente e data_vencimento quando houver. Para pagar/receber/excluir, extraia a descrição/fornecedor/valor que identifiquem a conta (não invente um ID). Se não for uma ação financeira clara, use acao=DESCONHECIDA. confidence de 0 a 1. Nunca invente valores que não estejam no comando.`,
      prompt: `Comando: "${comando}"`,
      response_json_schema: SCHEMA,
    });
  } catch {
    return { success: false, error: 'Falha ao interpretar o comando.' };
  }

  if (!out || typeof out !== 'object' || out._raw) return { success: false };

  const spec = ACTION_SPEC[out.acao];
  if (!spec) {
    return {
      needs_clarification: true,
      missing_fields: ['ação clara (ex.: "criar conta a pagar 3500 fornecedor X vence 20/08")'],
    };
  }

  const dados = { ...(out.dados || {}) };
  if (dados.valor != null) dados.valor = num(dados.valor);
  let registro_id = out.registro_id || null;

  if (spec.op === 'create') {
    if (!(num(dados.valor) > 0)) return { needs_clarification: true, missing_fields: ['valor'] };
    if (!dados.data) dados.data = hoje();
    if ((out.acao === 'CREATE_AP' || out.acao === 'CREATE_AR') && !dados.data_vencimento) {
      dados.data_vencimento = dados.data;
    }
  } else if (!registro_id) {
    // update/delete sem ID explícito
    if (!RESOLVIVEIS.has(out.acao)) {
      return { needs_clarification: true, missing_fields: ['ID do registro a editar'] };
    }
    const temCriterio = (dados.descricao && dados.descricao.trim())
      || (dados.fornecedor_cliente && dados.fornecedor_cliente.trim())
      || num(dados.valor) > 0;
    if (!temCriterio) {
      return { needs_clarification: true, missing_fields: ['descrição, fornecedor ou valor da conta'] };
    }
    const cand = await resolverConta(spec.entidade, out.acao, dados, ctx.obraId);
    if (cand.length === 0) {
      return { needs_clarification: true, missing_fields: ['nenhuma conta encontrada — refine a descrição/fornecedor'] };
    }
    if (cand.length > 1) {
      return {
        needs_clarification: true,
        missing_fields: ['mais de uma conta corresponde, especifique', ...cand.slice(0, 5).map(descConta)],
      };
    }
    // Exatamente uma: usa essa e reflete os dados reais no preview.
    const c = cand[0];
    registro_id = c.id;
    dados.descricao = c.descricao || dados.descricao || '';
    dados.fornecedor_cliente = c.fornecedor_cliente || dados.fornecedor_cliente || '';
    dados.valor = num(c.valor);
    if (c.data_vencimento) dados.data_vencimento = c.data_vencimento;
  }

  const actionDraft = {
    acao: out.acao,
    entidade_alvo: spec.entidade,
    dados,
    registro_id,
    obra_id: ctx.obraId || null,
    comando_original: comando,
    confidence: typeof out.confidence === 'number' ? out.confidence : 0.7,
    requires_approval: num(dados.valor) >= APPROVAL_THRESHOLD,
  };
  return { success: true, actionDraft };
}
