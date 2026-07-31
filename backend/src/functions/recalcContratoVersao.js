import { store } from '../entityStore.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Porte de recalcContratoVersao: recalcula preco_total de cada ContratoItem
// (qtd × preço c/ BDI) e o total_contrato da versão.
export default async function recalcContratoVersao({ body }) {
  const { contrato_versao_id } = body || {};
  if (!contrato_versao_id) throw Object.assign(new Error('contrato_versao_id obrigatório'), { status: 400 });

  const versao = (await store.filter('ContratoVersao', { id: contrato_versao_id }))[0];
  if (!versao) throw Object.assign(new Error('Versão de contrato não encontrada'), { status: 404 });

  // BDI da obra: usado para dar custo previsto a item adicionado à mão. A tela
  // /ContratoVersao cria o item direto pela API da entidade, informando só
  // preço de venda — sem custo, esse item vira um buraco na linha-base e o
  // desvio dele nunca aparece.
  const obra = versao.obra_id ? (await store.filter('Obra', { id: versao.obra_id }))[0] : null;
  const bdi = Number(obra?.bdi_percentual) || 0;

  const itens = (await store.filter('ContratoItem', { contrato_versao_id })) || [];
  let total = 0;
  let completados = 0;
  for (const it of itens) {
    const qtd = Number(it.qtd_contrato) || 0;
    const preco = Number(it.preco_unit_com_bdi) || Number(it.preco_unit) || 0;
    const precoTotal = r2(qtd * preco);
    total += precoTotal;

    const patch = {};
    if (precoTotal !== Number(it.preco_total) || precoTotal !== Number(it.total)) {
      patch.preco_total = precoTotal;
      patch.total = precoTotal;
    }
    // Item criado pela tela não recebe obra_id. Sem ele o item fica fora do
    // escopo por empresa e some dos relatórios que filtram por obra.
    if (!it.obra_id && versao.obra_id) patch.obra_id = versao.obra_id;

    // Custo previsto ausente. Duas formas de obtê-lo, na mesma ordem de
    // confiança da importação do orçamento:
    //
    //  1. O formulário tem os dois preços e o "sem BDI" é menor que o "com BDI".
    //     Então o sem BDI JÁ é o custo — está escrito, não se deduz.
    //  2. Só há um preço: deriva do BDI da obra.
    if (!(Number(it.custo_unit_previsto) > 0) && preco > 0) {
      const semBdi = Number(it.preco_unit) || 0;
      const comBdi = Number(it.preco_unit_com_bdi) || 0;
      let custoUnit = 0;
      let origem = null;

      if (semBdi > 0 && comBdi > semBdi) {
        custoUnit = r2(semBdi);
        origem = 'contrato_sem_bdi';
      } else if (bdi > 0) {
        custoUnit = r2(preco / (1 + bdi / 100));
        origem = 'bdi_obra';
      }

      if (custoUnit > 0) {
        patch.custo_unit_previsto = custoUnit;
        patch.custo_total_previsto = r2(custoUnit * qtd);
        patch.custo_origem = origem;
        completados += 1;
      }
    }

    if (Object.keys(patch).length) {
      await store.update('ContratoItem', it.id, patch).catch(() => {});
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

  return {
    ok: true,
    total_contrato: total,
    itens: itens.length,
    custos_completados: completados,
    rascunhos_atualizados: rascunhosAtualizados,
  };
}
