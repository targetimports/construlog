import { store } from '../entityStore.js';
import { requirePermission, podeEditarObra } from '../rbac.js';

// A OBRA AVISA QUE TERMINOU DE USAR o ativo.
//
// É o gatilho da viagem de volta: enquanto a obra não encerra o uso, ninguém manda
// um caminhão buscar uma máquina que ainda está trabalhando. Não devolve o ativo
// (isso continua sendo a vistoria de entrada + devolverEmprestimoAtivo, que é quem
// calcula o custo) — apenas sinaliza que ele está liberado para retornar ao pátio.
export default async function encerrarUsoAtivoObra({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const { emprestimo_id, cancelar = false, observacao } = body || {};
  if (!emprestimo_id) return { success: false, error: 'emprestimo_id é obrigatório' };

  const emp = (await store.filter('EmprestimoAtivo', { id: emprestimo_id }))[0];
  if (!emp) return { success: false, error: 'Empréstimo não encontrado' };
  if (emp.status !== 'em_uso') return { success: false, error: `Empréstimo não está em uso (${emp.status}).` };

  // Quem manda no ativo dentro da obra é quem responde por ela.
  const obra = emp.obra_id ? (await store.filter('Obra', { id: emp.obra_id }))[0] : null;
  if (obra && !podeEditarObra(user, obra)) {
    return { success: false, error: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem encerrar o uso.' };
  }

  if (cancelar) {
    await store.update('EmprestimoAtivo', emprestimo_id, {
      devolucao_solicitada: false, devolucao_solicitada_em: null, devolucao_solicitada_por: null,
    });
    return { success: true, devolucao_solicitada: false };
  }

  await store.update('EmprestimoAtivo', emprestimo_id, {
    devolucao_solicitada: true,
    devolucao_solicitada_em: new Date().toISOString(),
    devolucao_solicitada_por: user?.email || null,
    observacao_devolucao: observacao || null,
  });

  return { success: true, devolucao_solicitada: true, ativo_nome: emp.ativo_nome || null };
}
