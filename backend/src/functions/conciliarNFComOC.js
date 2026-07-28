import { store } from '../entityStore.js';

// Concilia os itens de uma NF com as Ordens de Compra da obra (por produto_id ou
// descrição), vincula NotaFiscalItem→OC, valida quantidade e compara com o
// planejamento de insumos da etapa (tolerância 10%), gerando alertas.
export default async function conciliarNFComOC({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { nota_fiscal_id } = body || {};
  if (!nota_fiscal_id) throw Object.assign(new Error('nota_fiscal_id obrigatório'), { status: 400 });

  const nfs = await store.filter('NotaFiscal', { id: nota_fiscal_id }, null, 1);
  const nf = nfs[0];
  if (!nf) throw Object.assign(new Error('NF não encontrada'), { status: 404 });

  const ocs = await store.filter('OrdemCompra', { obra_id: nf.obra_id });
  const itensNF = await store.filter('NotaFiscalItem', { nota_fiscal_id });

  const conciliados = [];
  const alertas = [];

  for (const itemNF of itensNF) {
    let ocEncontrada = null;
    for (const oc of ocs) {
      if (!oc.itens) continue;
      for (const itemOC of oc.itens) {
        if (itemNF.produto_id && itemOC.produto_id === itemNF.produto_id) {
          ocEncontrada = { oc_id: oc.id, item_oc: itemOC };
          break;
        }
        if (!itemNF.produto_id && (itemNF.descricao || '').toLowerCase().includes((itemOC.descricao || '').toLowerCase())) {
          ocEncontrada = { oc_id: oc.id, item_oc: itemOC };
          break;
        }
      }
      if (ocEncontrada) break;
    }

    if (ocEncontrada) {
      const qtdOC = ocEncontrada.item_oc.quantidade_aprovada || 0;
      const qtdNF = itemNF.quantidade || 0;
      if (Math.abs(qtdNF - qtdOC) > 0.01) {
        alertas.push(`Item "${itemNF.descricao}": OC espera ${qtdOC}, NF tem ${qtdNF}`);
      }
      await store.update('NotaFiscalItem', itemNF.id, { ordem_compra_id: ocEncontrada.oc_id });
      conciliados.push({ item_nf_id: itemNF.id, oc_id: ocEncontrada.oc_id });
    } else if (itemNF.categoria === 'MATERIAL') {
      alertas.push(`Item "${itemNF.descricao}": Nenhuma OC encontrada`);
    }
  }

  // Comparar com o planejamento de insumos das etapas (tolerância 10%)
  const etapas = await store.filter('EtapaObra', { obra_id: nf.obra_id });
  for (const itemNF of itensNF) {
    if (itemNF.categoria !== 'MATERIAL') continue;
    for (const etapa of etapas) {
      const planejamentos = await store.filter('PlanejamentoInsumosEtapa', { etapa_obra_id: etapa.id, produto_id: itemNF.produto_id });
      for (const plan of planejamentos) {
        const consumido = plan.consumido_anterior || 0;
        const planejado = plan.quantidade_planejada || 0;
        const novoTotal = consumido + (itemNF.quantidade || 0);
        if (novoTotal > planejado * 1.1) {
          alertas.push(`Etapa "${etapa.nome}": Item excede 10% do planejado (planejado: ${planejado}, será: ${novoTotal})`);
        }
      }
    }
  }

  try {
    await store.create('AuditLogNF', { nota_fiscal_id, acao: 'CONCILIACAO_PROCESSADA', usuario_email: user.email, descricao: `${conciliados.length} itens conciliados. ${alertas.length} alertas.` });
  } catch { /* auditoria best-effort */ }

  return { message: 'Conciliação processada', conciliados, alertas: alertas.length > 0 ? alertas : null };
}
