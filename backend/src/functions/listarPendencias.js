import { store } from '../entityStore.js';
import { can } from '../rbac.js';
import { escopoEmpresaDe, podeAcessarObra } from '../escopoObra.js';

// Pendências & Notificações (plano §34/§35): calcula AO VIVO as pendências das
// obras (sem depender de cron). NF foi deixada de fora propositalmente (módulo
// ainda não implementado).
//
// Tipos cobertos:
//   - diario_nao_lancado     (obra ativa sem diário de hoje)
//   - bm_pendente            (BM em rascunho aguardando aprovação)
//   - recebimento_atrasado   (RecebimentoPrevisto vencido e não recebido)
//   - custo_vencido          (PlannedCostItem vencido e não pago)
//   - material_em_falta      (necessidade prevista > recebido na obra)
//   - caixa_negativo         (recebimentos previstos < custos previstos)
//
// Cada tipo só aparece para o perfil que pode resolvê-lo (role-aware).
// Entrada: { obra_id? } — sem obra_id, varre as obras não encerradas.

const num = (v) => Number(v) || 0;

// Tipo de pendência → permissão necessária para vê-la/resolvê-la.
const TIPO_PERMISSAO = {
  diario_nao_lancado: 'DIARIO_CREATE',
  bm_pendente: 'MEDICOES_EDIT',
  recebimento_atrasado: 'ESTOQUE_CREATE',
  custo_vencido: 'FINANCEIRO_VIEW',
  material_em_falta: 'ESTOQUE_VIEW',
  caixa_negativo: 'FINANCEIRO_VIEW',
};

export default async function listarPendencias({ body, user }) {
  const { obra_id } = body || {};
  const today = new Date().toISOString().split('T')[0];

  const eid = escopoEmpresaDe(user); // membro só vê pendências das obras da própria empresa
  let obras;
  if (obra_id) {
    obras = (await podeAcessarObra(user, obra_id))
      ? [(await store.filter('Obra', { id: obra_id }))[0]].filter(Boolean)
      : [];
  } else {
    const todas = await store.filter('Obra', eid ? { empresa_id: eid } : {}, '-created_date', 300).catch(() => []);
    const encerradas = ['concluida', 'cancelada', 'encerrada', 'CONCLUIDA', 'CANCELADA', 'ENCERRADA'];
    obras = todas.filter((o) => !encerradas.includes(String(o.status)));
  }

  const pend = [];
  // id estável (tipo::obra) para o app marcar a pendência como "vista".
  const push = (p) => pend.push({ id: `${p.tipo}::${p.obra_id || ''}`, fonte: 'pendencia', data: today, ...p });

  for (const o of obras) {
    const oid = o.id;
    const onome = o.nome || 'Obra';
    const ativa = ['em_andamento', 'EM_ANDAMENTO', 'ativa'].includes(String(o.status));

    const [diariosHoje, bms, recs, custos, necessidades, movs] = await Promise.all([
      ativa ? store.filter('DiarioObra', { obra_id: oid, data: today }).catch(() => []) : Promise.resolve([]),
      store.filter('BM', { obra_id: oid }).catch(() => []),
      store.filter('RecebimentoPrevisto', { obra_id: oid }).catch(() => []),
      store.filter('PlannedCostItem', { obra_id: oid }).catch(() => []),
      store.filter('NecessidadeMaterialObra', { obra_id: oid }).catch(() => []),
      store.filter('EstoqueMovimentacao', { obra_id: oid }, '-created_date', 20000).catch(() => []),
    ]);

    // 1) Diário de hoje não lançado (só obra ativa)
    if (ativa && diariosHoje.length === 0) {
      push({ tipo: 'diario_nao_lancado', severidade: 'media', titulo: 'Diário de hoje não lançado',
        mensagem: `A obra "${onome}" ainda não teve o diário de hoje registrado.`, obra_id: oid, obra_nome: onome,
        link: `/DiarioObra?obra_id=${oid}` });
    }

    // 2) BM em rascunho (pendente de aprovação)
    const rascunhos = (bms || []).filter((b) => String(b.status).toUpperCase() === 'RASCUNHO');
    if (rascunhos.length) {
      push({ tipo: 'bm_pendente', severidade: 'media', titulo: `${rascunhos.length} medição(ões) aguardando aprovação`,
        mensagem: `A obra "${onome}" tem BM em rascunho não aprovada.`, obra_id: oid, obra_nome: onome,
        link: `/BMDetalhes?bm_id=${rascunhos[0].id}` });
    }

    // 3) Recebimentos atrasados
    const recAtras = (recs || []).filter((r) => !['RECEBIDO', 'CANCELADO'].includes(r.status) && r.data_prevista && r.data_prevista < today);
    if (recAtras.length) {
      push({ tipo: 'recebimento_atrasado', severidade: 'alta', titulo: `${recAtras.length} recebimento(s) atrasado(s)`,
        mensagem: `A obra "${onome}" tem recebimento previsto vencido.`, obra_id: oid, obra_nome: onome,
        link: `/ObraDetalhes?id=${oid}&secao=recebimentos` });
    }

    // 4) Custos previstos vencidos (não pagos)
    const custoAtras = (custos || []).filter((c) => !['PAGO', 'CANCELADO'].includes(c.status) && c.data_prevista && c.data_prevista < today);
    if (custoAtras.length) {
      push({ tipo: 'custo_vencido', severidade: 'media', titulo: `${custoAtras.length} custo(s) previsto(s) vencido(s)`,
        mensagem: `A obra "${onome}" tem custo previsto vencido não pago.`, obra_id: oid, obra_nome: onome,
        link: `/ObraDetalhes?id=${oid}&secao=custos_previstos` });
    }

    // 5) Material em falta (previsto > recebido na obra)
    const recebidoPorMat = {};
    for (const m of movs || []) {
      const k = m.material_id; if (!k) continue;
      const t = String(m.tipo || '').toUpperCase();
      if (t === 'ENTRADA' || t === 'TRANSFERENCIA') recebidoPorMat[k] = (recebidoPorMat[k] || 0) + num(m.quantidade);
    }
    let emFalta = 0;
    for (const n of necessidades || []) {
      if (!n.material_id && !n.insumo_id) continue;
      const previsto = num(n.quantidade_prevista);
      const recebido = Math.max(
        n.material_id ? num(recebidoPorMat[n.material_id]) : 0,
        num(n.quantidade_comprada) + num(n.quantidade_transferida) + num(n.quantidade_em_estoque)
      );
      if (recebido < previsto) emFalta++;
    }
    if (emFalta > 0) {
      push({ tipo: 'material_em_falta', severidade: 'media', titulo: `${emFalta} material(is) em falta`,
        mensagem: `A obra "${onome}" tem material planejado ainda não disponível no estoque.`, obra_id: oid, obra_nome: onome,
        link: `/ObraDetalhes?id=${oid}&secao=materiais` });
    }

    // 6) Caixa projetado negativo (recebimentos previstos < custos previstos)
    const totalReceb = (recs || []).filter((r) => r.status !== 'CANCELADO').reduce((s, r) => s + num(r.valor_previsto), 0);
    const totalCusto = (custos || []).filter((c) => c.status !== 'CANCELADO').reduce((s, c) => s + num(c.valor_previsto ?? c.valor_estimado), 0);
    if (totalReceb > 0 && totalCusto > 0 && totalReceb < totalCusto) {
      push({ tipo: 'caixa_negativo', severidade: 'alta', titulo: 'Fluxo de caixa projetado negativo',
        mensagem: `Em "${onome}", os recebimentos previstos não cobrem os custos previstos.`, obra_id: oid, obra_nome: onome,
        link: `/FinanceiroObraAvancado` });
    }
  }

  // Role-aware: cada usuário só vê as pendências que pode resolver (super vê todas).
  const visiveis = pend.filter((p) => can(user, TIPO_PERMISSAO[p.tipo]));

  const ordem = { alta: 0, media: 1, baixa: 2 };
  visiveis.sort((a, b) => (ordem[a.severidade] ?? 9) - (ordem[b.severidade] ?? 9));

  return { pendencias: visiveis, total: visiveis.length };
}
