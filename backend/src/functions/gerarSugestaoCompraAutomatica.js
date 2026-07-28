import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Gera uma SugestaoCompra a partir dos saldos de um almoxarifado: identifica os
// materiais que precisam de reposição (ruptura, abaixo do mínimo ou no ponto de
// reposição) e calcula a quantidade sugerida. Tolerante a dados esparsos —
// campos ausentes (mínimo/ponto/consumo) contam como 0.

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function gerarSugestaoCompraAutomatica({ body, user }) {
  requirePermission(user, 'ESTOQUE_VIEW');

  const almoxId = body?.almoxarifado_id;
  if (!almoxId) return { success: false, error: 'Selecione um almoxarifado.' };

  const local = (await store.filter('LocalEstoque', { id: almoxId }))[0];
  const saldos = await store.filter('SaldoEstoque', { local_estoque_id: almoxId }, '-saldo_atual', 5000).catch(() => []);

  const itens = [];
  for (const s of saldos) {
    const saldo = num(s.saldo_atual);
    const minima = num(s.quantidade_minima);
    const ponto = num(s.ponto_reposicao);
    const consumo = num(s.consumo_medio_mensal ?? s.consumo_medio);
    const custo = num(s.custo_unitario_medio);

    let motivo = null;
    if (saldo === 0) motivo = 'Ruptura (saldo zero)';
    else if (minima > 0 && saldo < minima) motivo = 'Abaixo do mínimo';
    else if (ponto > 0 && saldo <= ponto) motivo = 'Ponto de reposição';
    if (!motivo) continue;

    // Alvo de reposição: maior entre mínimo, 2× ponto de reposição e 1 mês de consumo.
    const alvo = Math.max(minima, ponto * 2, consumo);
    let sugerido = r2(alvo - saldo);
    if (sugerido <= 0) sugerido = motivo.startsWith('Ruptura') ? r2(Math.max(consumo, minima, 1)) : 0;
    if (sugerido <= 0) continue;

    itens.push({
      material_id: s.material_id,
      material_nome: s.material_nome || '—',
      unidade: s.material_unidade || s.unidade || 'UN',
      saldo_atual: saldo,
      sugerido,
      valor_estimado: r2(sugerido * custo),
      motivo,
      selecionado: true,
    });
  }

  if (itens.length === 0) {
    return { success: true, message: 'Nenhum item precisa de reposição no momento.', qtd_itens: 0 };
  }

  const valorTotal = r2(itens.reduce((s, i) => s + i.valor_estimado, 0));
  const rec = await store.create('SugestaoCompra', {
    almoxarifado_id: almoxId,
    almoxarifado_nome: local?.nome || 'Almoxarifado',
    status: 'gerada',
    qtd_itens: itens.length,
    valor_total_estimado: valorTotal,
    gerado_em: new Date().toISOString(),
    gerado_por: user?.email || null,
    itens,
  }, user?.email || null);

  return { success: true, message: `Sugestão gerada com ${itens.length} item(ns).`, sugestao_id: rec.id, qtd_itens: itens.length };
}
