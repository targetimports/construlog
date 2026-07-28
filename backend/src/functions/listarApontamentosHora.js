import { store } from '../entityStore.js';

// Porte de listarApontamentosHora: lista ApontamentoHora com filtros + paginação.
const POR_PAGINA = 20;

export default async function listarApontamentosHora({ body }) {
  const { obra_id, colaborador_id, equipe_id, status, de, ate, origem, pagina = 1 } = body || {};

  const filtro = {};
  if (obra_id) filtro.obra_id = obra_id;
  if (colaborador_id) filtro.colaborador_id = colaborador_id;
  if (equipe_id) filtro.equipe_id = equipe_id;
  if (status) filtro.status = status;
  if (origem) filtro.origem = origem;

  let resultado = (await store.filter('ApontamentoHora', filtro, '-data', 500)) || [];

  if (de || ate) {
    resultado = resultado.filter((ap) => {
      const d = new Date(ap.data);
      if (de && d < new Date(de)) return false;
      if (ate && d > new Date(ate)) return false;
      return true;
    });
  }

  const total = resultado.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const p = Math.min(Math.max(1, Number(pagina) || 1), paginas);
  const inicio = (p - 1) * POR_PAGINA;
  const paginado = resultado.slice(inicio, inicio + POR_PAGINA);

  return { ok: true, apontamentos: paginado, paginacao: { pagina: p, porPagina: POR_PAGINA, total, paginas } };
}
