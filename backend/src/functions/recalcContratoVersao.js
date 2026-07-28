import { store } from '../entityStore.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Porte de recalcContratoVersao: recalcula preco_total de cada ContratoItem
// (qtd × preço c/ BDI) e o total_contrato da versão.
export default async function recalcContratoVersao({ body }) {
  const { contrato_versao_id } = body || {};
  if (!contrato_versao_id) throw Object.assign(new Error('contrato_versao_id obrigatório'), { status: 400 });

  const versao = (await store.filter('ContratoVersao', { id: contrato_versao_id }))[0];
  if (!versao) throw Object.assign(new Error('Versão de contrato não encontrada'), { status: 404 });

  const itens = (await store.filter('ContratoItem', { contrato_versao_id })) || [];
  let total = 0;
  for (const it of itens) {
    const qtd = Number(it.qtd_contrato) || 0;
    const preco = Number(it.preco_unit_com_bdi) || Number(it.preco_unit) || 0;
    const precoTotal = r2(qtd * preco);
    total += precoTotal;
    if (precoTotal !== Number(it.preco_total) || precoTotal !== Number(it.total)) {
      await store.update('ContratoItem', it.id, { preco_total: precoTotal, total: precoTotal }).catch(() => {});
    }
  }
  total = r2(total);
  await store.update('ContratoVersao', contrato_versao_id, { total_contrato: total }).catch(() => {});

  // Contrato "vivo": quando a versão é a ATIVA, o novo total reflete no valor de
  // contrato da própria Obra e nas BMs ainda em RASCUNHO. As BMs APROVADAS mantêm
  // o snapshot do momento da aprovação (medição assinada não se reescreve).
  let rascunhosAtualizados = 0;
  if (String(versao.status || '').toUpperCase() === 'ATIVA' && versao.obra_id) {
    await store.update('Obra', versao.obra_id, { valor_contrato: total }).catch(() => {});
    const bms = (await store.filter('BM', { obra_id: versao.obra_id })) || [];
    for (const bm of bms) {
      if (String(bm.status || '').toUpperCase() !== 'RASCUNHO') continue;
      const acumulado = Number(bm.total_acumulado) || 0;
      const percent = total > 0 ? r2((acumulado / total) * 100) : 0;
      await store.update('BM', bm.id, { total_contrato: total, percent_concluida: percent }).catch(() => {});
      rascunhosAtualizados += 1;
    }
  }

  return { ok: true, total_contrato: total, itens: itens.length, rascunhos_atualizados: rascunhosAtualizados };
}
