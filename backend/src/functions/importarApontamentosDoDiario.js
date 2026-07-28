import { store } from '../entityStore.js';

// Porte adaptado de importarApontamentosDoDiario.
// Origem dos dados no self-host: ApontamentoMaoObra (registro diário único de
// presença/horas por obra+colaborador+dia) — gera ApontamentoHora (horas RH/folha).
// Idempotente por (obra, colaborador, data, origem='diario', referencia_id).
const getById = async (name, id) => (id ? (await store.filter(name, { id }))[0] : null) || null;

function custoVigente(custos, data) {
  for (const c of (custos || [])) {
    const inicio = new Date(c.vigencia_inicio);
    const fim = c.vigencia_fim ? new Date(c.vigencia_fim) : null;
    const d = new Date(data);
    if (d >= inicio && (!fim || d <= fim)) return c;
  }
  return null;
}

export default async function importarApontamentosDoDiario({ body, user }) {
  const { obra_id, de, ate } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });
  if (!de || !ate) throw Object.assign(new Error('de e ate são obrigatórios'), { status: 400 });

  const diarios = (await store.filter('ApontamentoMaoObra', { obra_id }, '-data', 5000)) || [];
  const periodo = diarios.filter((d) => d.data && d.data >= de && d.data <= ate);

  let criados = 0; let noops = 0; let ignorados = 0;

  for (const ap of periodo) {
    const colaborador_id = ap.profissional_id;
    if (!colaborador_id) { ignorados++; continue; }
    if (ap.presenca && ap.presenca !== 'presente') { ignorados++; continue; }

    const existentes = await store.filter('ApontamentoHora', {
      obra_id, colaborador_id, data: ap.data, origem: 'diario', referencia_id: ap.id,
    }, '-created_date', 10);
    if (existentes && existentes.length) { noops++; continue; }

    const colab = await getById('Colaborador', colaborador_id);
    if (!colab) { ignorados++; continue; }

    const custos = await store.filter('CustoHoraColaborador', { colaborador_id, ativo: true }, '-vigencia_inicio', 10).catch(() => []);
    const cv = custoVigente(custos, ap.data);
    const custo_hora = cv ? Number(cv.custo_hora) || 0 : 0;
    const custo_extra = cv?.custo_hora_extra != null ? Number(cv.custo_hora_extra) : custo_hora * 1.5;
    const horas_normais = Number(ap.horas_normais) || 0;
    const horas_extras = Number(ap.horas_extra) || 0;
    const custo_total = (horas_normais * custo_hora) + (horas_extras * custo_extra);

    await store.create('ApontamentoHora', {
      obra_id, colaborador_id, data: ap.data,
      horas_normais, horas_extras, custo_hora, custo_hora_extra: custo_extra, custo_total,
      origem: 'diario', referencia_tipo: 'apontamento_mao_obra', referencia_id: ap.id,
      status: 'rascunho',
    }, user?.email || null);
    criados++;
  }

  return { ok: true, criados, noops, ignorados, total_analisado: periodo.length };
}
