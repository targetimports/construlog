import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal } from '../middleware.js';

// Fase 3 — aprovação do empréstimo pela MATRIZ (dona dos ativos). Ao aprovar, registra
// o medidor de SAÍDA (km/horímetro), marca o ativo como em uso na obra e o empréstimo
// como em_uso. Rejeição grava o motivo. Só a Matriz (global) aprova.
const num = (v) => Number(v) || 0;

export default async function aprovarEmprestimoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  if (!isGlobal(user)) return { success: false, error: 'Apenas a Matriz aprova empréstimos de ativos.' };

  const { emprestimo_id, aprovar = true, medidor_saida, motivo_rejeicao } = body || {};
  if (!emprestimo_id) return { success: false, error: 'emprestimo_id é obrigatório' };

  const emp = (await store.filter('EmprestimoAtivo', { id: emprestimo_id }))[0];
  if (!emp) return { success: false, error: 'Empréstimo não encontrado' };
  if (emp.status !== 'solicitado') return { success: false, error: `Empréstimo não está pendente (${emp.status})` };

  if (!aprovar) {
    await store.update('EmprestimoAtivo', emprestimo_id, {
      status: 'rejeitado', motivo_rejeicao: motivo_rejeicao || null, aprovador: user?.email || null,
    });
    return { success: true, status: 'rejeitado' };
  }

  // VISTORIA DE SAÍDA OBRIGATÓRIA (cliente, 2026-07-17): não se entrega ativo sem
  // registrar como ele saiu (medidor + fotos + estado). Sem isso não há como provar
  // avaria depois — e é justamente na correria que a prova falta.
  const vistoriaSaida = ((await store.filter('Vistoria', { emprestimo_id, tipo: 'SAIDA' })) || [])[0];
  if (!vistoriaSaida) {
    return { success: false, error: 'Faça a vistoria de saída (medidor, fotos e estado do ativo) antes de liberar.' };
  }

  const ativo = (await store.filter('Ativo', { id: emp.ativo_id }))[0];
  const medAtual = emp.medidor_tipo === 'km' ? num(ativo?.km_atual) : num(ativo?.horimetro_atual);
  // O medidor da vistoria manda: é o que foi conferido fisicamente no ato da entrega.
  const medSaida = num(vistoriaSaida.medidor) || (medidor_saida != null ? num(medidor_saida) : medAtual);

  // ORDEM DE SERVIÇO — o comprovante do empréstimo. Numeração OS-{ano}-{seq}.
  const ano = new Date().getFullYear();
  const todas = (await store.filter('EmprestimoAtivo', {}, undefined, 100000)) || [];
  const seq = todas.filter((e) => String(e.os_numero || '').startsWith(`OS-${ano}-`)).length + 1;
  const osNumero = emp.os_numero || `OS-${ano}-${String(seq).padStart(4, '0')}`;

  await store.update('EmprestimoAtivo', emprestimo_id, {
    status: 'em_uso', medidor_saida: medSaida,
    data_saida: emp.data_saida || new Date().toISOString().slice(0, 10),
    aprovador: user?.email || null,
    os_numero: osNumero,
    os_emitida_em: new Date().toISOString(),
    vistoria_saida_id: vistoriaSaida.id,
  });
  // Sincroniza o medidor do ativo com a leitura da entrega: é a leitura física mais
  // recente que existe. Sem isto, ativo e empréstimo passam a contar histórias
  // diferentes (a tela do ativo mostra um número, a do empréstimo mostra outro).
  if (ativo) {
    const patch = { status: 'em_uso', obra_atual_id: emp.obra_id || null };
    const atual = emp.medidor_tipo === 'km' ? num(ativo.km_atual) : num(ativo.horimetro_atual);
    if (medSaida > atual) {
      if (emp.medidor_tipo === 'km') patch.km_atual = medSaida; else patch.horimetro_atual = medSaida;
    }
    await store.update('Ativo', ativo.id, patch);
  }

  return { success: true, status: 'em_uso', medidor_saida: medSaida, os_numero: osNumero, vistoria_saida_id: vistoriaSaida.id };
}
