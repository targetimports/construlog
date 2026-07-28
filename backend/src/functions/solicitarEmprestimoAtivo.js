import { store } from '../entityStore.js';
import { requirePermission, podeEditarObra } from '../rbac.js';
import { disponibilidadeDoAtivo } from './viagemCore.js';

// Fase 3 — empréstimo de ativo (frota unificada). A empresa-membro SOLICITA um ativo
// da Matriz para uma obra, por um período. A tarifa (custo de uso) vem do próprio ativo.
// empresa_id (tomadora) é herdado da obra (store.create). Status: solicitado.
const num = (v) => Number(v) || 0;

export function tarifaDoAtivo(ativo) {
  const ehVeiculo = /veiculo|carro|moto|caminh/.test(String(ativo?.tipo || '').toLowerCase());
  const medidor_tipo = ehVeiculo ? 'km' : 'horimetro';
  let tarifa_tipo, tarifa_valor;
  if (!ehVeiculo && num(ativo?.custo_hora) > 0) { tarifa_tipo = 'hora'; tarifa_valor = num(ativo.custo_hora); }
  else if (num(ativo?.custo_diaria) > 0) { tarifa_tipo = 'dia'; tarifa_valor = num(ativo.custo_diaria); }
  else if (num(ativo?.custo_hora) > 0) { tarifa_tipo = 'hora'; tarifa_valor = num(ativo.custo_hora); }
  else { tarifa_tipo = 'dia'; tarifa_valor = 0; }
  return { medidor_tipo, tarifa_tipo, tarifa_valor };
}

export default async function solicitarEmprestimoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const { ativo_id, obra_id, data_saida, data_prevista_retorno, motivo, observacao } = body || {};
  if (!ativo_id || !obra_id) return { success: false, error: 'ativo_id e obra_id são obrigatórios' };

  const ativo = (await store.filter('Ativo', { id: ativo_id }))[0];
  if (!ativo) return { success: false, error: 'Ativo não encontrado' };
  // Disponibilidade pela fonte ÚNICA (viagemCore): considera empréstimo aberto E
  // viagem de transferência em curso. Sem isso, um veículo que saiu levando material
  // poderia ser emprestado a uma obra ao mesmo tempo.
  const disp = await disponibilidadeDoAtivo(ativo_id);
  if (!disp.livre) return { success: false, error: disp.motivo };

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!podeEditarObra(user, obra)) {
    return { success: false, error: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem solicitar empréstimos nesta obra.' };
  }
  const { medidor_tipo, tarifa_tipo, tarifa_valor } = tarifaDoAtivo(ativo);

  const todos = await store.filter('EmprestimoAtivo', {}, '-created_date', 100000);
  const numero = `EMP-${new Date().getFullYear()}-${String(todos.length + 1).padStart(4, '0')}`;

  const emprestimo = await store.create('EmprestimoAtivo', {
    numero,
    ativo_id, ativo_nome: ativo.nome || ativo.codigo || 'Ativo', ativo_tipo: ativo.tipo || null,
    obra_id, obra_nome: obra?.nome || '',
    medidor_tipo, tarifa_tipo, tarifa_valor,
    medidor_saida: null, medidor_retorno: null,
    data_saida: data_saida || null, data_prevista_retorno: data_prevista_retorno || null, data_retorno: null,
    status: 'solicitado', custo_total: 0, conta_financeira_id: null,
    solicitante: user?.email || null, motivo: motivo || null, observacao: observacao || null,
  }, user?.email || null);

  return { success: true, emprestimo };
}
