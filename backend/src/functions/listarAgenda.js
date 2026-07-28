import { store } from '../entityStore.js';

// Lista eventos da agenda com filtros (obra, tipos, status, prioridade, faixa de datas).
// store suporta igualdade e $in; a faixa de datas ($gte/$lte) é aplicada em JS.
export default async function listarAgenda({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { de, ate, obra_id, tipos, status, prioridade, pagina = 0, limit = 50 } = body || {};

  const filtro = {};
  if (obra_id) filtro.obra_id = obra_id;
  if (Array.isArray(tipos) && tipos.length > 0) filtro.tipo = { $in: tipos };
  if (Array.isArray(status) && status.length > 0) filtro.status = { $in: status };
  if (prioridade) filtro.prioridade = prioridade;

  let eventos = await store.filter('AgendaEvento', filtro, '-data_inicio', 1000);

  if (de && ate) {
    eventos = eventos.filter((e) => e.data_inicio && e.data_inicio >= de && e.data_inicio <= ate);
  }

  const contadores = { total: eventos.length, por_status: {}, por_tipo: {} };
  eventos.forEach((e) => {
    contadores.por_status[e.status] = (contadores.por_status[e.status] || 0) + 1;
    contadores.por_tipo[e.tipo] = (contadores.por_tipo[e.tipo] || 0) + 1;
  });

  const start = pagina * limit;
  const pageItems = eventos.slice(start, start + limit);

  return { ok: true, eventos: pageItems, contadores, pagina, limit };
}
