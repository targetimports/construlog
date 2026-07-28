import { store } from '../entityStore.js';

// Status de consolidação do orçamento de uma obra. O finalizarImportacaoCompleta
// grava um registro OrcamentoConsolidacaoStatus (status DONE/ERROR + contagens);
// aqui apenas lemos o mais recente. Usado pela tela de sucesso do import OrçaFácil
// (polling) — por isso é tolerante: nunca lança, sempre devolve um shape válido.
export default async function getOrcamentoConsolidacaoStatus({ body }) {
  const obraId = body?.obraId || body?.obra_id;
  if (!obraId) {
    return { consolidado: false, total_itens: 0, processados: 0, status: 'pending' };
  }

  let reg = null;
  try {
    const regs = await store.filter('OrcamentoConsolidacaoStatus', { obra_id: obraId }, '-created_date', 1);
    reg = regs?.[0] || null;
  } catch { /* sem registro */ }

  if (!reg) {
    return { consolidado: false, total_itens: 0, processados: 0, status: 'pending' };
  }

  const consolidado = reg.status === 'DONE';
  const total = Number(reg.total_itens) || 0;
  const processados = Number(reg.itens_consolidados ?? (consolidado ? total : 0)) || 0;

  return {
    consolidado,
    total_itens: total,
    processados,
    status: reg.status === 'ERROR' ? 'error' : (consolidado ? 'done' : 'pending'),
    erro_fatal: reg.status === 'ERROR' ? (reg.erro || reg.mensagem || 'Erro na consolidação do orçamento') : undefined,
  };
}
