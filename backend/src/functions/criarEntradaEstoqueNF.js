import { store } from '../entityStore.js';

const getOne = async (entity, id) => (await store.filter(entity, { id }, null, 1))[0];

// Cria as MovimentacaoEstoque de ENTRADA para os itens MATERIAL (com produto mapeado) de uma NF.
export default async function criarEntradaEstoqueNF({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { nota_fiscal_id } = body || {};
  if (!nota_fiscal_id) throw Object.assign(new Error('nota_fiscal_id obrigatório'), { status: 400 });

  const nf = await getOne('NotaFiscal', nota_fiscal_id);
  if (!nf) throw Object.assign(new Error('NF não encontrada'), { status: 404 });

  const itens = await store.filter('NotaFiscalItem', { nota_fiscal_id });
  const entradas = [];
  const erros = [];

  for (const item of itens) {
    if (item.categoria !== 'MATERIAL') continue;
    if (!item.produto_id) { erros.push(`Item "${item.descricao}" sem produto_id mapeado`); continue; }
    try {
      const mov = await store.create('MovimentacaoEstoque', {
        tipo: 'ENTRADA',
        produto_id: item.produto_id,
        obra_id: nf.obra_id,
        quantidade: item.quantidade,
        unidade: item.unidade || 'un',
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        descricao: `NF ${nf.numero}/${nf.serie} - ${nf.fornecedor_nome}`,
        referencia_tipo: 'NotaFiscalItem',
        referencia_id: item.id,
        nf_id: nf.id,
        registrado_por: user.email
      });
      entradas.push({ item_id: item.id, movimentacao_id: mov.id, produto_id: item.produto_id, quantidade: item.quantidade });
    } catch (err) {
      erros.push(`Erro ao criar entrada para "${item.descricao}": ${err.message}`);
    }
  }

  try {
    await store.create('AuditLogNF', { nota_fiscal_id, acao: 'ESTOQUE_PROCESSADO', usuario_email: user.email, descricao: `${entradas.length} entradas criadas. ${erros.length} erros.` });
  } catch { /* auditoria best-effort */ }

  return { message: 'Entradas de estoque criadas', entradas, erros: erros.length > 0 ? erros : null };
}
