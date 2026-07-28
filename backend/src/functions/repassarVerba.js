import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal } from '../middleware.js';
import { registrarSaidaCaixa, ajustarVerbaEmpresa } from './tesourariaCore.js';

// Repasse de VERBA da Matriz para uma empresa-membro (Fase 2 multi-empresa).
// A verba é o orçamento alocado que DECRESCE conforme a empresa gasta (pagar/baixa).
// Repasse é ação da MATRIZ (global). Opcionalmente debita um caixa da Matriz (saída
// real de dinheiro); o efeito principal é incrementar Empresa.saldo_verba do membro.
const num = (v) => Number(v) || 0;
const hoje = () => new Date().toISOString().slice(0, 10);

export default async function repassarVerba({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');
  if (!isGlobal(user)) return { success: false, error: 'Apenas a Matriz pode alocar verba.' };

  const { empresa_id, valor, conta_tesouraria_id, descricao } = body || {};
  if (!empresa_id) return { success: false, error: 'Empresa é obrigatória' };
  const v = num(valor);
  if (v <= 0) return { success: false, error: 'Valor deve ser maior que zero' };

  const emp = (await store.filter('Empresa', { id: empresa_id }))[0];
  if (!emp) return { success: false, error: 'Empresa não encontrada' };
  if (emp.tipo === 'matriz') return { success: false, error: 'Não se aloca verba para a própria Matriz' };

  // Saída de caixa da Matriz (opcional — repasse pode ser só orçamentário).
  let movCaixa = null;
  if (conta_tesouraria_id) {
    const r = await registrarSaidaCaixa({
      conta_id: conta_tesouraria_id, valor: v, user,
      meta: { categoria: 'repasse_verba', descricao: descricao || `Repasse de verba — ${emp.nome}`, data: hoje() },
    });
    if (r.error) return { success: false, error: r.error };
    movCaixa = r.movimentacao_id;
  }

  const rv = await ajustarVerbaEmpresa({ empresa_id, delta: +v, user });
  return { success: true, saldo_verba: rv.saldo_verba, movimentacao_caixa_id: movCaixa, empresa_nome: emp.nome };
}
