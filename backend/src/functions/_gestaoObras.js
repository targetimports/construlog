import { store } from '../entityStore.js';

// Helpers compartilhados pelas funções de IA da tela "Análise por Obra"
// (GestaoObrasAvancada). Reúnem o financeiro REAL da obra a partir das mesmas
// fontes usadas pela DRE (LancamentoCustoObra por categoria, BM aprovadas,
// ApontamentoMaoObra, ContaFinanceira), para servir de base às análises do LLM.

export const num = (v) => Number(v) || 0;
export const r2 = (n) => Math.round(num(n) * 100) / 100;

// Coleta e consolida os números financeiros da obra.
export async function coletarFinanceiroObra(obra_id) {
  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) throw Object.assign(new Error('Obra não encontrada'), { status: 404 });

  // Custos realizados por categoria (fonte oficial: LancamentoCustoObra).
  const lcs = await store.filter('LancamentoCustoObra', { obra_id }, '-data_lancamento', 5000).catch(() => []);
  const despesasPorCategoria = {};
  for (const l of lcs) {
    const cat = String(l.categoria || 'outros').toLowerCase().trim() || 'outros';
    despesasPorCategoria[cat] = r2((despesasPorCategoria[cat] || 0) + num(l.valor));
  }
  let custoAtual = r2(Object.values(despesasPorCategoria).reduce((s, v) => s + v, 0));

  // Mão de obra: se não houver lançamento de custo, cai para apontamentos aprovados.
  if (!despesasPorCategoria['mao_de_obra']) {
    const aps = await store.filter('ApontamentoMaoObra', { obra_id, status: 'APROVADO' }, '-data', 5000).catch(() => []);
    const mo = aps.reduce((s, a) => s + num(a.total ?? a.valor_diaria), 0);
    if (mo > 0) { despesasPorCategoria['mao_de_obra'] = r2(mo); custoAtual = r2(custoAtual + mo); }
  }

  // Receitas: faturado = medido acumulado das BMs aprovadas (ou valor_realizado da obra).
  const bms = (await store.filter('BM', { obra_id }).catch(() => []))
    .filter((b) => String(b.status).toUpperCase() === 'APROVADA');
  const medidoAcum = bms.reduce((mx, b) => Math.max(mx, num(b.total_acumulado)), 0);
  const receitaAtual = r2(num(obra.valor_realizado) || medidoAcum);
  const receitaContratada = r2(num(obra.valor_contrato) || num(obra.valor_orcado) || num(obra.total_orcamento));
  const valorOrcado = r2(num(obra.valor_orcado) || num(obra.total_orcamento) || receitaContratada);

  const progressoFisico = Math.round(num(obra.percentual_concluido) || num(obra.percentual_fisico) || 0);
  // Projeção linear: custo final ≈ custo atual / fração concluída.
  const custoProjetado = progressoFisico >= 5 ? r2(custoAtual / (progressoFisico / 100)) : r2(valorOrcado || custoAtual);

  const margem = receitaAtual > 0 ? r2(((receitaAtual - custoAtual) / receitaAtual) * 100) : 0;
  const margemProjetada = receitaContratada > 0 ? r2(((receitaContratada - custoProjetado) / receitaContratada) * 100) : 0;

  // Contas a pagar atrasadas (risco de fluxo de caixa).
  const contas = await store.filter('ContaFinanceira', { obra_id }, '-data_vencimento', 5000).catch(() => []);
  const hoje = new Date();
  const atrasadas = contas.filter((c) => (c.status === 'pendente' || c.status === 'aberto')
    && c.data_vencimento && new Date(c.data_vencimento) < hoje);
  const contasAtrasadas = atrasadas.length;
  const contasAtrasadasValor = r2(atrasadas.reduce((s, c) => s + num(c.valor), 0));

  // Contratos/fornecedores da obra vencendo nos próximos 30 dias.
  const contratos = await store.filter('Contrato', { obra_id }, '-data_vencimento', 2000).catch(() => []);
  const em30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  const contratosRisco = contratos.filter((c) => c.data_vencimento
    && new Date(c.data_vencimento) >= hoje && new Date(c.data_vencimento) <= em30).length;

  return {
    obra, despesasPorCategoria,
    custoAtual, custoProjetado, receitaAtual, receitaContratada, valorOrcado,
    progressoFisico, margem, margemProjetada,
    contasAtrasadas, contasAtrasadasValor, contratosRisco,
    lancamentosCount: lcs.length, medicoesCount: bms.length,
  };
}

// Resumo textual dos dados da obra, para alimentar o prompt do LLM.
export function resumoObra(f) {
  const o = f.obra;
  const linhas = Object.entries(f.despesasPorCategoria)
    .map(([k, v]) => `  - ${k}: R$ ${v.toLocaleString('pt-BR')}`)
    .join('\n') || '  (sem lançamentos de custo registrados)';
  return `OBRA: ${o.nome} (status: ${o.status || '-'}, tipo: ${o.tipo || '-'})
Datas: início ${o.data_inicio || '-'} / previsão de fim ${o.data_prevista_fim || '-'}
Progresso físico: ${f.progressoFisico}%
Valor de contrato: R$ ${f.receitaContratada.toLocaleString('pt-BR')}
Valor orçado: R$ ${f.valorOrcado.toLocaleString('pt-BR')}
Receita faturada/realizada: R$ ${f.receitaAtual.toLocaleString('pt-BR')}
Custo realizado até agora: R$ ${f.custoAtual.toLocaleString('pt-BR')}
Custo final projetado (linear): R$ ${f.custoProjetado.toLocaleString('pt-BR')}
Margem atual: ${f.margem}% | margem projetada: ${f.margemProjetada}%
Contas a pagar atrasadas: ${f.contasAtrasadas} (R$ ${f.contasAtrasadasValor.toLocaleString('pt-BR')})
Contratos vencendo em 30 dias: ${f.contratosRisco}
Custos por categoria:
${linhas}`;
}

// Confiança do modelo preditivo conforme a quantidade de dados disponíveis.
export function confiancaModelo(f) {
  let c = 45;
  if (f.lancamentosCount > 0) c += 20;
  if (f.lancamentosCount >= 10) c += 5;
  if (f.medicoesCount > 0) c += 10;
  if (f.progressoFisico >= 10) c += 15;
  if (f.receitaContratada > 0) c += 5;
  return Math.max(30, Math.min(95, c));
}
