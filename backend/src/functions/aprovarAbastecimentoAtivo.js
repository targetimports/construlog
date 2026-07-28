import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal } from '../middleware.js';
import { gerarContaDoAbastecimento } from './registrarAbastecimentoAtivo.js';

// APROVAÇÃO do abastecimento lançado na obra.
//
// Quem está na obra registra o que abasteceu (com nota/cupom), mas quem autoriza a
// despesa é o responsável pela frota, na Matriz. Só na aprovação nasce a conta a
// pagar do posto — antes disso o lançamento existe como pendência, não como dívida.
//
// Rejeitar não apaga: o registro fica com o motivo, para haver rastro de quem lançou
// o quê (é exatamente nos abastecimentos que aparece desvio de combustível).
export default async function aprovarAbastecimentoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  if (!isGlobal(user)) return { success: false, error: 'Apenas a Matriz aprova abastecimentos.' };

  const { abastecimento_id, aprovar = true, motivo_rejeicao } = body || {};
  if (!abastecimento_id) return { success: false, error: 'abastecimento_id é obrigatório' };

  const ab = (await store.filter('Abastecimento', { id: abastecimento_id }))[0];
  if (!ab) return { success: false, error: 'Abastecimento não encontrado' };
  if (ab.status && ab.status !== 'PENDENTE') {
    return { success: false, error: `Este abastecimento já foi ${String(ab.status).toLowerCase()}.` };
  }

  if (!aprovar) {
    await store.update('Abastecimento', abastecimento_id, {
      status: 'REJEITADO',
      motivo_rejeicao: motivo_rejeicao || null,
      aprovado_por: user?.email || null,
      aprovado_em: new Date().toISOString(),
    });
    return { success: true, status: 'REJEITADO' };
  }

  const conta = await gerarContaDoAbastecimento(ab, user);
  await store.update('Abastecimento', abastecimento_id, {
    status: 'APROVADO',
    aprovado_por: user?.email || null,
    aprovado_em: new Date().toISOString(),
  });

  return {
    success: true,
    status: 'APROVADO',
    conta_financeira_id: conta.id,
    valor_total: conta.valor,
    obra_nome: ab.obra_nome || null,
  };
}
