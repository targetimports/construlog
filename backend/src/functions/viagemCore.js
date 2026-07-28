import { store } from '../entityStore.js';

// VIAGEM DE TRANSFERÊNCIA — o veículo que leva o material de um estoque ao outro.
//
// Pedido do cliente (2026-07-20): transferência de material é feita com veículo da
// empresa e precisa de motorista; o veículo fica indisponível durante a viagem e
// acumula custo (hodômetro, combustível).
//
// DECISÃO DE NEGÓCIO: a viagem é DESPESA DA MATRIZ, não da obra. Diferente do
// empréstimo de ativo (que é rateado para a obra que operou a máquina por dias ou
// semanas), a viagem é o frete interno do grupo — dura horas e serve à logística,
// não à produção da obra. Por isso NÃO gera tarifa nem rateio; o que aparece no
// financeiro é o combustível, que já vira conta a pagar do posto, sem obra_id.
// O que a viagem leva. Mesma máquina de estados nos dois casos — muda só a carga e
// a quem ela está amarrada (requisição de material ou empréstimo de ativo).
export const TIPO_VIAGEM = {
  TRANSFERENCIA: 'TRANSFERENCIA',       // material de um estoque para outro
  TRANSPORTE_ATIVO: 'TRANSPORTE_ATIVO', // máquina/equipamento pesado em cima do caminhão
};

export const STATUS_VIAGEM = ['PLANEJADA', 'A_CAMINHO', 'NO_DESTINO', 'RETORNANDO', 'FINALIZADA', 'CANCELADA'];
export const VIAGEM_ABERTA = ['PLANEJADA', 'A_CAMINHO', 'NO_DESTINO', 'RETORNANDO'];

// Ordem do fluxo: só se avança para o próximo estado (ou cancela). Impede que uma
// viagem "volte" para a estrada depois de finalizada.
export const PROXIMO_STATUS = {
  PLANEJADA: ['A_CAMINHO', 'CANCELADA'],
  A_CAMINHO: ['NO_DESTINO', 'CANCELADA'],
  NO_DESTINO: ['RETORNANDO', 'FINALIZADA'],
  RETORNANDO: ['FINALIZADA'],
};

/**
 * DISPONIBILIDADE DO ATIVO — fonte ÚNICA de verdade.
 *
 * Dois módulos disputam o mesmo veículo: o empréstimo para obra (EmprestimoAtivo) e
 * a viagem de transferência (Viagem). Sem uma checagem comum, um veículo em viagem
 * poderia ser emprestado, ou o fim de uma viagem devolveria para "disponível" um
 * veículo que está emprestado a uma obra. Ambos os lados chamam esta função.
 *
 * @returns {Promise<{livre: boolean, motivo?: string, por?: 'emprestimo'|'viagem'}>}
 */
export async function disponibilidadeDoAtivo(ativo_id, { ignorarViagemId, ignorarEmprestimoId } = {}) {
  if (!ativo_id) return { livre: false, motivo: 'Ativo não informado.' };

  const ativo = (await store.filter('Ativo', { id: ativo_id }))[0];
  if (!ativo) return { livre: false, motivo: 'Ativo não encontrado.' };
  if (['inativo', 'manutencao'].includes(String(ativo.status))) {
    return { livre: false, motivo: `Ativo indisponível (${ativo.status}).` };
  }

  const emps = await store.filter('EmprestimoAtivo', { ativo_id }, undefined, 1000).catch(() => []);
  const emp = emps.find((e) => ['solicitado', 'em_uso'].includes(e.status) && e.id !== ignorarEmprestimoId);
  if (emp) {
    return { livre: false, por: 'emprestimo', motivo: `Este ativo está em empréstimo aberto (${emp.numero || emp.id}) para "${emp.obra_nome || 'uma obra'}".` };
  }

  const viagens = await store.filter('Viagem', { veiculo_id: ativo_id }, undefined, 1000).catch(() => []);
  const vg = viagens.find((v) => VIAGEM_ABERTA.includes(String(v.status)) && v.id !== ignorarViagemId);
  if (vg) {
    return { livre: false, por: 'viagem', motivo: `Este veículo está em viagem aberta (${vg.numero || vg.id}) para "${vg.destino_nome || 'entrega'}".` };
  }

  return { livre: true };
}

/**
 * Libera o ativo SE nada mais o estiver prendendo. Nunca marca "disponível" às cegas:
 * a viagem pode acabar enquanto um empréstimo segue aberto (e vice-versa).
 */
export async function liberarAtivoSePossivel(ativo_id, { ignorarViagemId, ignorarEmprestimoId } = {}) {
  const d = await disponibilidadeDoAtivo(ativo_id, { ignorarViagemId, ignorarEmprestimoId });
  if (!d.livre) return false;
  await store.update('Ativo', ativo_id, { status: 'disponivel' }).catch(() => {});
  return true;
}

// Numeração VG-{ano}-{seq}, no mesmo padrão de EMP/OS do resto da frota.
export async function proximoNumeroViagem() {
  const ano = new Date().getFullYear();
  const todas = await store.filter('Viagem', {}, undefined, 100000).catch(() => []);
  const seq = todas.filter((v) => String(v.numero || '').startsWith(`VG-${ano}-`)).length + 1;
  return `VG-${ano}-${String(seq).padStart(4, '0')}`;
}
