import { store } from '../entityStore.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Saldo consolidado por (local, insumo) calculado a partir de EstoqueMovimentacao
// — fonte única de verdade (event-sourced). ENTRADA soma no destino; SAIDA subtrai
// na origem; TRANSFERENCIA move origem→destino. Custo médio por insumo (das ENTRADAs
// com custo). Valor = saldo × custo médio.
//
// Multi-empresa: cada saldo carrega o nivel/empresa_id do LocalEstoque. Membro só vê
// os locais da PRÓPRIA empresa (EMPRESA/OBRA); matriz (global) vê tudo, inclusive o CENTRAL.
//
// Catálogo = Insumo (insumo_id); mantém material_* no retorno por compatibilidade de tela
// durante a transição.
// Opções: { local_estoque_id?, obra_id? }. Retorna { saldos: [...] }.

const num = (v) => Number(v) || 0;
const itemKey = (m) => m.insumo_id || m.material_id;
const custoUnitDe = (m) => num(m.custo_unitario ?? m.custo_unit ?? m.custo);

export default async function getSaldosEstoque({ body, user }) {
  const { local_estoque_id, obra_id } = body || {};
  const [movs, locais] = await Promise.all([
    store.filter('EstoqueMovimentacao', {}, '-data_mov', 100000),
    store.filter('LocalEstoque', {}, null, 100000),
  ]);
  const localMap = Object.fromEntries((locais || []).map((l) => [l.id, l]));

  // Custo médio por insumo (média ponderada das ENTRADAs com custo > 0).
  const custoSoma = {}; const custoQtd = {};
  for (const m of movs) {
    if (String(m.tipo || '').toUpperCase().startsWith('ENTRADA') && custoUnitDe(m) > 0) {
      const it = itemKey(m); if (!it) continue;
      custoSoma[it] = (custoSoma[it] || 0) + num(m.quantidade) * custoUnitDe(m);
      custoQtd[it] = (custoQtd[it] || 0) + num(m.quantidade);
    }
  }
  const custoMedio = (it) => (custoQtd[it] ? custoSoma[it] / custoQtd[it] : 0);

  // Saldo por (local|insumo).
  const mapa = {};
  const add = (local, m, q) => {
    const it = itemKey(m);
    if (!local || !it) return;
    const k = `${local}|${it}`;
    const nome = m.insumo_nome || m.material_nome || '';
    const und = m.insumo_unidade || m.material_unidade || '';
    if (!mapa[k]) {
      mapa[k] = {
        local_estoque_id: local, insumo_id: it, material_id: it,
        insumo_nome: nome, insumo_unidade: und, material_nome: nome, material_unidade: und,
        obra_id: m.obra_id || null, saldo: 0,
      };
    }
    mapa[k].saldo += q;
    if (nome) { mapa[k].insumo_nome = nome; mapa[k].material_nome = nome; }
    if (und) { mapa[k].insumo_unidade = und; mapa[k].material_unidade = und; }
    if (m.obra_id) mapa[k].obra_id = m.obra_id;
  };

  // Tolera as duas convenções de campo de local (origem/destino_local_id e almox_*).
  for (const m of movs) {
    const tipo = String(m.tipo || '').toUpperCase().replace(/_.*/, '');
    const q = num(m.quantidade);
    const origem = m.origem_local_id || m.almox_origem_id || null;
    const destino = m.destino_local_id || m.almox_destino_id || null;
    if (tipo === 'ENTRADA') add(destino || origem, m, q);
    else if (tipo === 'SAIDA') add(origem, m, -q);
    else if (tipo === 'TRANSFERENCIA') { if (destino) add(destino, m, q); if (origem) add(origem, m, -q); }
  }

  let saldos = Object.values(mapa).map((r) => {
    const l = localMap[r.local_estoque_id] || {};
    const custo = custoMedio(r.insumo_id);
    return {
      ...r,
      nivel: l.nivel || l.tipo || null,
      empresa_id: l.empresa_id ?? null,
      local_nome: l.nome || '',
      custo_medio: custo,
      valor: r.saldo * custo,
    };
  });

  // Escopo multi-empresa: membro só vê os locais da própria empresa (EMPRESA/OBRA).
  if (user && !isGlobal(user)) {
    const eid = empresaIdDe(user);
    saldos = saldos.filter((r) => r.empresa_id === eid);
  }
  if (local_estoque_id) saldos = saldos.filter((r) => r.local_estoque_id === local_estoque_id);
  if (obra_id) saldos = saldos.filter((r) => r.obra_id === obra_id);

  return { saldos };
}
