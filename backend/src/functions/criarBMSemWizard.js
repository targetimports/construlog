import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';

// Porte de criarBMSemWizard: cria um Boletim de Medição (BM) em RASCUNHO para a
// versão de contrato ativa da obra. Sem itens no contrato → devolve código tratado.
export default async function criarBMSemWizard({ body, user }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!podeEditarObra(user, obra)) {
    return { ok: false, code: 'SEM_PERMISSAO', obra_id, error: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem criar medições.' };
  }

  const ativas = (await store.filter('ContratoVersao', { obra_id, status: 'ATIVA' })) || [];
  const versao = ativas[0];
  if (!versao) {
    return { ok: false, code: 'SEM_CONTRATO', obra_id, error: 'Nenhuma versão de contrato ativa. Gere o contrato do orçamento primeiro.' };
  }

  const itens = (await store.filter('ContratoItem', { contrato_versao_id: versao.id })) || [];
  if (itens.length === 0) {
    return { ok: false, code: 'CONTRATO_SEM_ITENS', contrato_versao_id: versao.id, obra_id, error: 'O contrato ativo não possui itens.' };
  }

  const bms = (await store.filter('BM', { obra_id })) || [];
  const numero = bms.reduce((m, b) => Math.max(m, Number(b.numero) || 0), 0) + 1;
  const hoje = new Date().toISOString().split('T')[0];

  const bm = await store.create('BM', {
    obra_id,
    contrato_versao_id: versao.id,
    numero,
    status: 'RASCUNHO',
    data_inicio: hoje,
    data_fim: hoje,
    total_contrato: Number(versao.total_contrato) || 0,
    total_anterior: 0,
    total_periodo: 0,
    total_acumulado: 0,
    percent_concluida: 0,
  }, user?.email || null);

  return { ok: true, bm_id: bm.id, numero };
}
