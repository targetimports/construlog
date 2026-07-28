import { store } from '../entityStore.js';
import { podeAcessarObra } from '../escopoObra.js';

// Busca global por obra: procura o termo em OCs, NFs, medições, contas, movimentações e receitas.
export default async function searchGlobal({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });

  // A tela envia obraId (camelCase); aceitamos ambos por robustez.
  const obra_id = body?.obra_id || body?.obraId;
  const termo = body?.termo;
  if (!obra_id || !termo || termo.length < 2) {
    throw Object.assign(new Error('obra_id e termo (mín. 2 caracteres) são obrigatórios'), { status: 400 });
  }
  if (!(await podeAcessarObra(user, obra_id))) throw Object.assign(new Error('Sem acesso a esta obra (outra empresa)'), { status: 403 });

  const t = termo.toLowerCase();
  const inc = (...vals) => vals.some((v) => String(v || '').toLowerCase().includes(t));

  const [ocs, nfs, medicoes, contas, movimentos, receitas] = await Promise.all([
    store.filter('OrdemCompra', { obra_id }).catch(() => []),
    store.filter('NotaFiscal', { obra_id }).catch(() => []),
    store.filter('Medicao', { obra_id }).catch(() => []),
    store.filter('ContaFinanceira', { obra_id }).catch(() => []),
    store.filter('MovimentacaoEstoque', { obra_id }).catch(() => []),
    store.filter('ReceitaObra', { obra_id }).catch(() => [])
  ]);

  const resultados = {
    ordens_compra: (ocs || []).filter((oc) => inc(oc.numero, oc.fornecedor_nome)).slice(0, 5),
    notas_fiscais: (nfs || []).filter((nf) => inc(nf.numero_nf, nf.numero, nf.descricao, nf.fornecedor_nome)).slice(0, 5),
    medicoes: (medicoes || []).filter((m) => inc(m.numero, m.observacoes)).slice(0, 5),
    contas: (contas || []).filter((c) => inc(c.descricao, c.nota_fiscal)).slice(0, 5),
    movimentacoes: (movimentos || []).filter((m) => inc(m.descricao_insumo, m.codigo_insumo, m.descricao)).slice(0, 5),
    receitas: (receitas || []).filter((r) => inc(r.descricao)).slice(0, 5)
  };
  const total = Object.values(resultados).reduce((s, a) => s + a.length, 0);

  return { ok: true, data: { termo, obra_id, total, resultados } };
}
