import { calcularBM } from '../bmCalc.js';

// Salva as quantidades do período de um BM (persist) a partir da lista de itens
// editados. Usada pelo "Salvar Cálculo" da página /CalculoMedicao.
// body: { bm_id, items: [{ contrato_item_id, qtd_periodo_input }] }
export default async function updateBMPeriodQuantities({ body, user }) {
  const { bm_id, items = [] } = body || {};
  const items_override = (items || []).map((i) => ({
    contrato_item_id: i.contrato_item_id,
    qtd_periodo_input: i.qtd_periodo_input,
    override_manual: true,
  }));
  return calcularBM({ bm_id, items_override, persist: true, userEmail: user?.email || null });
}
