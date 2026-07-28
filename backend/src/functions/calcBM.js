import { calcularBM } from '../bmCalc.js';

// Calcula (e opcionalmente persiste) a planilha de um Boletim de Medição.
// Usada pela página /BMPlanilha. Ver regras em bmCalc.js.
export default async function calcBM({ body, user }) {
  const { bm_id, items_override = [], persist = false } = body || {};
  return calcularBM({ bm_id, items_override, persist, userEmail: user?.email || null });
}
