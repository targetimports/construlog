import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';

// Encerra o empréstimo de um colaborador NESTA obra (a de destino).
//
// O par de adicionarColaboradorAObra: fecha a AlocacaoObra da transferência e
// INATIVA o vínculo ObraColaborador — que é o que mantinha a pessoa na lista do
// Ponto daqui. Sem inativar o vínculo, fechar a alocação não adianta: o Ponto lista
// por vínculo OU equipe OU alocação, e ele continuaria aparecendo.
//
// Preserva histórico: o vínculo é inativado (não apagado) e a alocação vira
// 'finalizada' com data_fim — se ele for emprestado de novo, adicionarColaboradorAObra
// reativa o mesmo vínculo. Os apontamentos já lançados NÃO são tocados: o custo dos
// dias que ele trabalhou aqui continua sendo desta obra (e desta empresa), como deve.
export default async function encerrarTransferenciaObra({ body, user }) {
  const { obra_id, colaborador_id, data_fim } = body || {};
  if (!obra_id || !colaborador_id) {
    throw Object.assign(new Error('obra_id e colaborador_id são obrigatórios'), { status: 400 });
  }

  const obra = (await store.filter('Obra', { id: obra_id }))[0];

  const alocs = ((await store.filter('AlocacaoObra', { obra_id, colaborador_id })) || [])
    .filter((a) => String(a.status || '') !== 'finalizada');

  // Quem pode encerrar: o responsável da obra de DESTINO (devolve quem pegou
  // emprestado) ou o da obra de ORIGEM (chama o próprio pessoal de volta) — as duas
  // pontas têm interesse legítimo, e o empréstimo não é decisão unilateral de uma só.
  const origemIds = [...new Set(alocs.map((a) => a.obra_origem_id).filter(Boolean))];
  const origens = origemIds.length
    ? (await store.filter('Obra', { id: { $in: origemIds } }, undefined, 100)) || []
    : [];
  const pode = podeEditarObra(user, obra) || origens.some((o) => podeEditarObra(user, o));
  if (!pode) {
    throw Object.assign(new Error('Apenas responsáveis pela obra de origem ou de destino (ou Admin/TI/Financeiro) podem encerrar a transferência.'), { status: 403 });
  }

  const fim = String(data_fim || new Date().toISOString().split('T')[0]).slice(0, 10);
  for (const a of alocs) {
    await store.update('AlocacaoObra', a.id, { status: 'finalizada', data_fim: fim });
  }

  const vinculos = ((await store.filter('ObraColaborador', { obra_id, colaborador_id })) || [])
    .filter((v) => (v.status || 'ativo') !== 'inativo');
  for (const v of vinculos) {
    await store.update('ObraColaborador', v.id, { status: 'inativo', data_fim: fim });
  }

  return { success: true, alocacoes_encerradas: alocs.length, vinculos_inativados: vinculos.length, data_fim: fim };
}
