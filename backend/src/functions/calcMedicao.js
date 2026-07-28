import { calcularBM } from '../bmCalc.js';

// Motor de cálculo de medição (mesma lógica de calcBM). Usada pela página
// /CalculoMedicao para simular (persist=false) o cálculo do BM.
export default async function calcMedicao({ body, user }) {
  const { bm_id, items_override = [], persist = false } = body || {};
  return calcularBM({ bm_id, items_override, persist, userEmail: user?.email || null });
}
