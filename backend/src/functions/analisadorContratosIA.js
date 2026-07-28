import { store } from '../entityStore.js';
import { invokeLLM, llmAvailable } from '../llm.js';

// "Contratos Inteligente" → análise de risco do contrato. Baseia-se nos dados
// reais do contrato (valores, prazos, tipo, observações) e, quando houver, no
// texto/cláusulas enviado. Retorna { analise } no formato que
// AnalisadorContratosIA consome.

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtData = (d) => { try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return String(d); } };
const SEV = ['alta', 'média', 'baixa'];

const SCHEMA = {
  type: 'object',
  properties: {
    score_risco: { type: 'number', description: '0 a 10' },
    avisos_urgentes: { type: 'array', items: { type: 'string' } },
    clausulasChave: { type: 'array', items: { type: 'string' } },
    riscosIdentificados: { type: 'array', items: { type: 'object', properties: {
      tipo: { type: 'string' }, descricao: { type: 'string' },
      severidade: { type: 'string', enum: ['alta', 'média', 'baixa'] },
    } } },
    sugestoesAditivos: { type: 'array', items: { type: 'object', properties: {
      tipo: { type: 'string' }, descricao: { type: 'string' }, motivo: { type: 'string' },
    } } },
    datas_criticas: { type: 'array', items: { type: 'object', properties: {
      rotulo: { type: 'string' }, valor: { type: 'string' },
    } } },
    recomendacoes: { type: 'array', items: { type: 'string' } },
  },
};

export default async function analisadorContratosIA({ body }) {
  const id = body?.contratoId || body?.contrato_id;
  const conteudo = String(body?.conteudoContrato || '').slice(0, 8000);
  if (!id) throw Object.assign(new Error('contratoId é obrigatório'), { status: 400 });

  const c = (await store.filter('Contrato', { id }))[0];
  if (!c) throw Object.assign(new Error('Contrato não encontrado'), { status: 404 });

  const obra = c.obra_id ? (await store.filter('Obra', { id: c.obra_id }).catch(() => []))[0] : null;
  const hoje = new Date();

  // Datas críticas reais (com dias restantes/vencido).
  const datas_criticas = {};
  if (c.data_assinatura) datas_criticas['Assinatura'] = fmtData(c.data_assinatura);
  if (c.data_inicio) datas_criticas['Início'] = fmtData(c.data_inicio);
  if (c.data_fim_prevista) {
    const dias = Math.round((new Date(c.data_fim_prevista) - hoje) / 86400000);
    datas_criticas['Fim previsto'] = `${fmtData(c.data_fim_prevista)}` +
      (dias >= 0 ? ` (em ${dias} dias)` : ` (vencido há ${Math.abs(dias)} dias)`);
  }

  // Score de risco base por prazo/valor (a IA pode sobrescrever).
  let scoreBase = 2;
  if (c.data_fim_prevista) {
    const dias = Math.round((new Date(c.data_fim_prevista) - hoje) / 86400000);
    if (dias < 0) scoreBase = 8; else if (dias <= 30) scoreBase = 6; else if (dias <= 90) scoreBase = 4;
  } else {
    scoreBase = 5; // sem prazo definido já é um risco
  }
  if (num(c.valor_total) === 0) scoreBase = Math.max(scoreBase, 4);

  const resumo = `CONTRATO
Número: ${c.numero || '-'}
Título: ${c.titulo || '-'}
Tipo: ${c.tipo || '-'}
Status: ${c.status || '-'}
Obra: ${obra?.nome || c.obra_id || '-'}
Valor inicial: ${fmtBRL(c.valor_inicial)}
Valor total: ${fmtBRL(c.valor_total)}
Datas: assinatura ${c.data_assinatura || '-'} / início ${c.data_inicio || '-'} / fim previsto ${c.data_fim_prevista || '-'}
Observações: ${c.observacoes || '-'}${conteudo ? `\n\nTexto/cláusulas do contrato:\n${conteudo}` : ''}`;

  const analise = {
    score_risco: scoreBase,
    avisos_urgentes: [],
    clausulasChave: [],
    riscosIdentificados: [],
    sugestoesAditivos: [],
    datas_criticas,
    recomendacoes: [],
  };

  if (llmAvailable()) {
    try {
      const out = await invokeLLM({
        system: 'Você é um advogado/analista de contratos de obras de construção civil. Avalie riscos contratuais, cláusulas e prazos. Use os dados fornecidos; se o texto das cláusulas não foi enviado, baseie-se nos metadados (valores, prazos, tipo, status). Escreva em português do Brasil. Severidade ∈ {alta, média, baixa}; score_risco de 0 a 10. Não invente cláusulas que não foram fornecidas.',
        prompt: `Analise este contrato.\n\n${resumo}\n\nProduza:\n- score_risco (0-10).\n- avisos_urgentes: alertas que exigem ação imediata (ex.: vencimento próximo, ausência de prazo).\n- clausulasChave: cláusulas/pontos-chave (ou, se não houver texto, os pontos contratuais relevantes).\n- riscosIdentificados: {tipo, descricao, severidade}.\n- sugestoesAditivos: {tipo, descricao, motivo}.\n- datas_criticas: {rotulo, valor} (prazos/datas a observar).\n- recomendacoes: ações recomendadas.`,
        response_json_schema: SCHEMA,
      });
      if (out && typeof out === 'object' && !out._raw) {
        if (typeof out.score_risco === 'number') {
          analise.score_risco = Math.max(0, Math.min(10, Math.round(out.score_risco)));
        }
        analise.avisos_urgentes = out.avisos_urgentes || [];
        analise.clausulasChave = out.clausulasChave || [];
        analise.riscosIdentificados = (out.riscosIdentificados || []).map((r) => ({
          tipo: r.tipo || '-',
          descricao: r.descricao || '',
          severidade: SEV.includes(r.severidade) ? r.severidade : 'média',
        }));
        analise.sugestoesAditivos = out.sugestoesAditivos || [];
        // Mescla as datas críticas do LLM (array {rotulo, valor}) com as reais.
        for (const d of (out.datas_criticas || [])) {
          if (d?.rotulo) analise.datas_criticas[d.rotulo] = d.valor ?? '';
        }
        analise.recomendacoes = out.recomendacoes || [];
      }
    } catch { /* mantém heurística + datas reais */ }
  }

  return { analise };
}
