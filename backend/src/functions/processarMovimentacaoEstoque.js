import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Registra ENTRADA/SAIDA/TRANSFERENCIA no estoque. Catálogo = Insumo.
// Grava a EstoqueMovimentacao (event source de getSaldosEstoque) e mantém o
// SaldoEstoque materializado sincronizado (compat das telas), ambos carimbados com
// empresa_id do local (escopo multi-empresa). Valida os níveis nas transferências
// (Central → Empresa → Obra). A migração das telas para a fonte única (getSaldosEstoque)
// é gradual; enquanto isso os dois convivem.
export default async function processarMovimentacaoEstoque({ body, user }) {
  requirePermission(user, 'ESTOQUE_EDIT');
  const {
    tipo,
    origem_local_id, destino_local_id,
    almox_origem_id, almox_destino_id, // compat (telas antigas)
    obra_id, documento_ref, observacao, itens = [],
  } = body || {};

  const origem = origem_local_id || almox_origem_id || null;
  const destino = destino_local_id || almox_destino_id || null;

  if (!tipo) return { success: false, error: 'tipo de movimentação obrigatório' };
  const itensValidos = (itens || []).filter(
    (it) => (it.insumo_id || it.material_id) && (Number(it.qtd ?? it.quantidade) || 0) > 0,
  );
  if (itensValidos.length === 0) return { success: false, error: 'Nenhum item válido na movimentação' };

  // Locais envolvidos (nível + empresa).
  const ids = [origem, destino].filter(Boolean);
  const locais = ids.length ? await store.filter('LocalEstoque', { id: { $in: ids } }) : [];
  const localById = Object.fromEntries(locais.map((l) => [l.id, l]));
  const nivelDe = (id) => (localById[id]?.nivel || localById[id]?.tipo || null);
  const empresaDe = (id) => (localById[id]?.empresa_id ?? null);
  const empresaMov = empresaDe(destino) ?? empresaDe(origem) ?? null;

  // Transferência é permitida em QUALQUER direção entre locais diferentes:
  // distribuição desce (Central→Empresa→Obra), devolução sobe (Obra→Empresa→Central)
  // e movimentação lateral no mesmo nível. O que garante a coerência física é o
  // guard de saldo abaixo (não deixa a origem ficar negativa). Só barra origem=destino.
  if (tipo === 'TRANSFERENCIA' && origem && destino && origem === destino) {
    return { success: false, error: 'Origem e destino não podem ser o mesmo local.' };
  }

  // Guard de saldo (defesa em profundidade): recusa ANTES de mover qualquer coisa se
  // a origem não tiver saldo suficiente. O front já valida, mas isto fecha a brecha de
  // corrida (outro usuário consome no intervalo) e de chamadas diretas à API — evitando
  // saldo negativo. Vale para SAIDA e TRANSFERENCIA (as que debitam a origem).
  if ((tipo === 'SAIDA' || tipo === 'TRANSFERENCIA') && origem) {
    // Soma a quantidade requerida por insumo (caso o mesmo insumo apareça em vários itens).
    const requerido = {};
    for (const it of itensValidos) {
      const iid = it.insumo_id || it.material_id;
      requerido[iid] = (requerido[iid] || 0) + (Number(it.qtd ?? it.quantidade) || 0);
    }
    // Lê o disponível na origem tolerando os DOIS esquemas de SaldoEstoque que convivem:
    // (A) movimentações → { local_estoque_id, saldo_atual } e (B) recebimento de OC
    // (confirmarRecebimentoMaterial) → { almoxarifado_id, quantidade_disponivel }. O mesmo
    // id identifica o local nos dois. Sem isto, estoque que entrou por OC era lido como 0
    // e barrava saídas/transferências legítimas.
    const dispDe = async (iid) => {
      const porLocal = (await store.filter('SaldoEstoque', { local_estoque_id: origem, insumo_id: iid })) || [];
      const porAlmox = (await store.filter('SaldoEstoque', { almoxarifado_id: origem, insumo_id: iid })) || [];
      const rows = [...porLocal, ...porAlmox].filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);
      const saldoRow = (r) => Number(r?.saldo_atual ?? r?.quantidade_disponivel) || 0;
      const disp = rows.reduce((m, r) => Math.max(m, saldoRow(r)), 0);
      const nome = rows[0]?.material_nome || rows[0]?.insumo_nome || rows[0]?.descricao_insumo || null;
      return { disp, nome };
    };
    const faltas = [];
    for (const [iid, req] of Object.entries(requerido)) {
      const { disp, nome: nomeRow } = await dispDe(iid);
      if (req > disp + 0.0001) {
        const it = itensValidos.find((x) => (x.insumo_id || x.material_id) === iid);
        const nome = nomeRow || it?.material_nome || it?.insumo_nome || iid;
        faltas.push(`${nome}: solicitado ${r2(req)}, disponível ${r2(disp)}`);
      }
    }
    if (faltas.length) {
      return { success: false, error: `Saldo insuficiente na origem — ${faltas.join('; ')}` };
    }
  }

  const agora = new Date().toISOString();

  // Atualiza o SaldoEstoque materializado (compat) de um insumo num local.
  const ajustarSaldo = async (localId, insumoId, nome, und, delta, custoUnit) => {
    if (!localId) return;
    const existentes = (await store.filter('SaldoEstoque', { local_estoque_id: localId, insumo_id: insumoId })) || [];
    const atual = existentes[0];
    const saldoAntigo = Number(atual?.saldo_atual) || 0;
    const custoAntigo = Number(atual?.custo_unitario_medio) || 0;
    const novoSaldo = r2(saldoAntigo + delta);
    // Custo médio PONDERADO: só recalcula na entrada/crédito (delta>0); na saída o
    // custo médio não muda. Ex.: 100 un a R$10 + 10 un a R$4 → 110 un a ~R$9,45
    // (antes sobrescrevia direto para R$4). denom>0 evita divisão por zero.
    let custo = custoAntigo;
    if (delta > 0) {
      const denom = saldoAntigo + delta;
      if (custoUnit > 0 && denom > 0) custo = r2((saldoAntigo * custoAntigo + delta * custoUnit) / denom);
      else if (custoAntigo === 0) custo = custoUnit || 0;
    }
    const payload = {
      local_estoque_id: localId, empresa_id: empresaDe(localId),
      insumo_id: insumoId, material_id: insumoId,
      insumo_nome: nome || atual?.material_nome || null, insumo_unidade: und || atual?.material_unidade || null,
      material_nome: nome || atual?.material_nome || null, material_unidade: und || atual?.material_unidade || null,
      saldo_atual: novoSaldo, custo_unitario_medio: custo, valor_total_estoque: r2(novoSaldo * custo),
    };
    if (atual) await store.update('SaldoEstoque', atual.id, payload);
    else await store.create('SaldoEstoque', payload, user?.email || null);
  };

  let primeiroMovId = null;
  let valorTotalGeral = 0;

  for (const item of itensValidos) {
    const insumoId = item.insumo_id || item.material_id;
    const nome = item.insumo_nome || item.material_nome || null;
    const und = item.insumo_unidade || item.material_unidade || null;
    const qtd = Number(item.qtd ?? item.quantidade) || 0;
    const custoUnit = Number(item.custo_unit ?? item.custo_unitario) || 0;
    const valorItem = r2(qtd * custoUnit);
    valorTotalGeral += valorItem;

    // 1) Grava o EstoqueMovimentacao PRIMEIRO — é a fonte da verdade (getSaldosEstoque
    //    recalcula dela). Se algo falhar depois, o event-source já está consistente e a
    //    reconciliação do cache resolve, sem "perder" material (era o risco do débito
    //    aplicado no cache sem o crédito, agravado pelo antigo .catch() mudo).
    const mov = await store.create('EstoqueMovimentacao', {
      tipo,
      empresa_id: empresaMov,
      // obra_id do movimento = a obra do local FÍSICO tocado (destino/origem), com prioridade
      // sobre o obra_id vindo do cliente. Isto casa o log da obra com o saldo (ambos por local)
      // e evita o caso em que um seletor de obra solto diverge do almoxarifado escolhido —
      // fazendo a movimentação aparecer no log de uma obra sem alterar o saldo dela. Só cai no
      // obra_id do cliente quando nenhum local de obra está envolvido (atribuição de custo).
      obra_id: localById[destino]?.obra_id || localById[origem]?.obra_id || obra_id || null,
      origem_local_id: origem,
      destino_local_id: destino,
      insumo_id: insumoId, insumo_nome: nome, insumo_unidade: und,
      material_id: insumoId, material_nome: nome, material_unidade: und, // aliases compat
      quantidade: qtd,
      qtd_itens: 1,
      custo_unitario: custoUnit, custo_unit: custoUnit, custo: custoUnit,
      valor_total: valorItem, valor_total_movimentacao: valorItem,
      documento_ref: documento_ref || null,
      observacao: observacao || null,
      data_mov: agora,
      registrado_por: user?.email || null,
    }, user?.email || null);
    if (!primeiroMovId) primeiroMovId = mov.id;

    // 2) Atualiza o cache materializado (SaldoEstoque). Se falhar aqui, o movimento
    //    acima já garante a fonte da verdade; a reconciliação repõe o cache.
    if (tipo === 'SAIDA') await ajustarSaldo(origem, insumoId, nome, und, -qtd, custoUnit);
    else if (tipo === 'ENTRADA') await ajustarSaldo(destino || origem, insumoId, nome, und, +qtd, custoUnit);
    else if (tipo === 'TRANSFERENCIA') {
      await ajustarSaldo(origem, insumoId, nome, und, -qtd, custoUnit);
      await ajustarSaldo(destino, insumoId, nome, und, +qtd, custoUnit);
    }
  }

  return { success: true, movimentacao_id: primeiroMovId, valor_total: r2(valorTotalGeral), itens: itensValidos.length };
}
