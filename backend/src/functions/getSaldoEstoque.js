import { store } from '../entityStore.js';

// Calcula o saldo de cada material num local de estoque, a partir das
// movimentações (ENTRADA soma no destino, SAIDA subtrai na origem,
// TRANSFERENCIA move entre origem/destino). Também devolve o custo médio
// por material (ponderado pelas ENTRADAs que têm custo).
// Retorna { saldos: { material_id: qtd }, custos: { material_id: custoMedio } }.

const num = (v) => Number(v) || 0;

export default async function getSaldoEstoque({ body }) {
  const { local_estoque_id } = body || {};
  const movs = await store.filter('EstoqueMovimentacao', {}, '-data_mov', 100000);

  // Custo médio por material (material-level, das ENTRADAs com custo > 0).
  const custoSoma = {};
  const custoQtd = {};
  for (const m of movs) {
    if (String(m.tipo || '').toUpperCase() === 'ENTRADA' && num(m.custo_unitario) > 0) {
      const mat = m.material_id;
      if (!mat) continue;
      const q = num(m.quantidade);
      custoSoma[mat] = (custoSoma[mat] || 0) + q * num(m.custo_unitario);
      custoQtd[mat] = (custoQtd[mat] || 0) + q;
    }
  }
  const custos = {};
  for (const k of Object.keys(custoSoma)) custos[k] = custoQtd[k] ? custoSoma[k] / custoQtd[k] : 0;

  if (!local_estoque_id) return { saldos: {}, custos };

  const saldos = {};
  const add = (mat, q) => { if (mat) saldos[mat] = (saldos[mat] || 0) + q; };
  // Considera ambas as convenções: origem/destino_local_id e almox_origem/destino_id.
  for (const m of movs) {
    const tipo = String(m.tipo || '').toUpperCase().replace(/_.*/, '');
    const q = num(m.quantidade);
    const mat = m.material_id;
    const origem = m.origem_local_id || m.almox_origem_id || null;
    const destino = m.destino_local_id || m.almox_destino_id || null;
    const ehDestino = destino === local_estoque_id;
    const ehOrigem = origem === local_estoque_id;
    if (tipo === 'ENTRADA' && ehDestino) add(mat, q);
    else if (tipo === 'SAIDA' && ehOrigem) add(mat, -q);
    else if (tipo === 'TRANSFERENCIA') {
      if (ehDestino) add(mat, q);
      if (ehOrigem) add(mat, -q);
    }
  }

  return { saldos, custos };
}
