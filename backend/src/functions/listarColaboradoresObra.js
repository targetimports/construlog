import { store } from '../entityStore.js';

// Porte de listarColaboradoresObra: lista os vínculos (ObraColaborador) da obra,
// enriquecidos com nome/cargo do Colaborador. Inativos são opcionais.
export default async function listarColaboradoresObra({ body }) {
  const { obra_id, mostrarInativos } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });

  const vinculos = (await store.filter('ObraColaborador', { obra_id })) || [];

  // Mapa de colaboradores (uma leitura só).
  const todos = (await store.filter('Colaborador', {}, '-created_date', 5000)) || [];
  const colMap = {};
  for (const c of todos) colMap[c.id] = c;

  const ativos = vinculos.filter((v) => (v.status || 'ativo') !== 'inativo');
  const fonte = mostrarInativos ? vinculos : ativos;

  const colaboradores = fonte.map((v) => {
    const c = colMap[v.colaborador_id] || {};
    return {
      vinculo_id: v.id,
      colaborador_id: v.colaborador_id,
      nome: c.nome || v.colaborador_nome || '—',
      cargo: c.cargo || '—',
      funcao_na_obra: v.funcao_na_obra || null,
      status: v.status || 'ativo',
      data_inicio: v.data_inicio || (v.created_date ? String(v.created_date).slice(0, 10) : null),
    };
  });

  return {
    colaboradores,
    total: ativos.length,
    totalComInativos: vinculos.length,
  };
}
