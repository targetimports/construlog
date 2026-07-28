import { store } from '../entityStore.js';
import { escopoEmpresaDe } from '../escopoObra.js';

// Lista contratos (com terceiros/fornecedores) com filtros + paginação.
// Resposta no formato que a página Contratos espera: { contratos, total, total_paginas, pagina }.
// Página é 0-based.

const num = (v) => Number(v) || 0;

export default async function listarContratos({ body, user }) {
  const { obra_id, fornecedor_id, tipo, status, busca, texto, pagina = 0, limit = 20 } = body || {};

  // Membro só vê contratos da própria empresa (Contrato ∈ ESCOPO_POR_EMPRESA).
  const eid = escopoEmpresaDe(user);
  let contratos = await store.filter('Contrato', eid ? { empresa_id: eid } : {}, '-created_date', 5000).catch(() => []);
  const term = String(busca || texto || '').toLowerCase().trim();

  contratos = contratos.filter((c) =>
    (!obra_id || c.obra_id === obra_id) &&
    (!fornecedor_id || c.fornecedor_id === fornecedor_id) &&
    (!tipo || c.tipo === tipo) &&
    (!status || c.status === status) &&
    (!term || String(c.numero || '').toLowerCase().includes(term) || String(c.titulo || '').toLowerCase().includes(term))
  );

  const total = contratos.length;
  const lim = num(limit) || 20;
  const pg = Math.max(0, num(pagina));
  const total_paginas = Math.max(1, Math.ceil(total / lim));
  const inicio = pg * lim;
  const itens = contratos.slice(inicio, inicio + lim);

  return { contratos: itens, total, total_paginas, pagina: pg };
}
