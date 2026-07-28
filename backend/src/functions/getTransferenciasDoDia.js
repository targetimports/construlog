import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Quem, entre os colaboradores desta obra, já está apontado em OUTRA obra neste dia.
//
// Por que uma function e não um filter na tela: ApontamentoMaoObra é escopado por
// empresa, então o responsável da obraA (empresaA) não enxerga o apontamento feito
// na obraC (empresaC) — e é justamente esse o caso do empréstimo entre empresas do
// grupo. Sem isso, a obraA veria uma linha em branco e não saberia se o ponto foi
// esquecido ou se o colaborador está trabalhando em outro lugar.
//
// Vazamento controlado: devolve só o nome da obra que está usando o colaborador (e
// as horas), nada de valores/custo. É informação que o responsável precisa para não
// marcar falta indevida — e são obras do MESMO grupo.
//
// SÓ LEITURA.
const num = (v) => Number(v) || 0;
const STATUS_FORA = new Set(['REJEITADO', 'CANCELADO', 'CANCELADA']);

export default async function getTransferenciasDoDia({ body, user }) {
  requirePermission(user, 'OBRAS_VIEW');
  const { obra_id, data, colaboradores_ids } = body || {};
  if (!obra_id || !data) return { success: true, transferidos: {} };

  const dia = String(data).slice(0, 10);
  const alvo = new Set(colaboradores_ids || []);

  // FONTE 1 — a ALOCAÇÃO de transferência que PARTIU desta obra.
  // Vale desde o instante em que a transferência é feita, antes de qualquer ponto:
  // sem isso a obra de origem só descobria o empréstimo depois que o destino
  // marcasse o ponto, e até lá ficava cobrando presença de quem não está lá.
  const vigente = (a) => {
    if (a.data_inicio && dia < String(a.data_inicio).slice(0, 10)) return false;
    if (a.data_fim && dia > String(a.data_fim).slice(0, 10)) return false;
    return true;
  };
  const alocs = ((await store.filter('AlocacaoObra', { obra_origem_id: obra_id }, undefined, 5000)) || [])
    .filter((a) => a.tipo === 'transferencia' && String(a.status || '') !== 'finalizada')
    .filter((a) => a.obra_id && a.obra_id !== obra_id)
    .filter((a) => !alvo.size || alvo.has(a.colaborador_id))
    .filter(vigente);

  // FONTE 2 — o PONTO lançado em outra obra no dia (fato consumado).
  // Cobre o caso em que a pessoa foi apontada em outro lugar sem transferência
  // formal, e é o que sustenta a trava de "um dia, uma obra".
  const aps = ((await store.filter('ApontamentoMaoObra', { data: dia }, undefined, 10000)) || [])
    .filter((a) => a.obra_id && a.obra_id !== obra_id)
    .filter((a) => !STATUS_FORA.has(String(a.status || '').toUpperCase()))
    .filter((a) => num(a.horas_normais) + num(a.horas_extra) > 0)
    .filter((a) => !alvo.size || alvo.has(a.profissional_id || a.colaborador_id));

  if (alocs.length === 0 && aps.length === 0) return { success: true, transferidos: {} };

  const obraIds = [...new Set([...alocs.map((a) => a.obra_id), ...aps.map((a) => a.obra_id)])];
  const obras = (await store.filter('Obra', { id: { $in: obraIds } }, undefined, 1000)) || [];
  const nome = Object.fromEntries(obras.map((o) => [o.id, o.nome]));

  const transferidos = {};
  for (const a of alocs) {
    transferidos[a.colaborador_id] = {
      obra_id: a.obra_id,
      obra_nome: nome[a.obra_id] || 'outra obra',
      horas: 0,
      presenca: '',
      via: 'alocacao',          // transferido, mas o destino ainda não bateu o ponto
      alocacao_id: a.id,
      data_fim: a.data_fim || '',
    };
  }
  // O ponto tem a palavra final: se já há horas lançadas, mostra-as.
  for (const a of aps) {
    const cid = a.profissional_id || a.colaborador_id;
    if (!cid) continue;
    transferidos[cid] = {
      ...(transferidos[cid] || {}),
      obra_id: a.obra_id,
      obra_nome: nome[a.obra_id] || 'outra obra',
      horas: num(a.horas_normais),
      presenca: a.presenca || '',
      via: 'ponto',
    };
  }
  return { success: true, transferidos };
}
