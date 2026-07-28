import { store } from '../entityStore.js';

// "Alertas IA Logística" → analisa as viagens finalizadas e os abastecimentos e
// gera registros AlertaViagemIA para anomalias (KM inconsistente, consumo
// anormal, falta de foto, uso excessivo). Detecção determinística (regras),
// com deduplicação por (viagem, tipo) enquanto o alerta não for resolvido.

const num = (v) => Number(v) || 0;
const r1 = (n) => Math.round(num(n) * 10) / 10;
const FINALIZADAS = new Set(['finalizada', 'concluida']);
const BASELINE_LKM = 0.15; // 15 L / 100 km como linha de base

const kmDeclarado = (v) => num(v.km_rodado ?? v.km_rodados ?? v.km_percorrido);
const kmCalc = (v) => (v.km_final != null && v.km_inicial != null) ? num(v.km_final) - num(v.km_inicial) : null;
const temFoto = (v) => Boolean(
  v.foto_painel_url || v.foto_painel_final_url || v.foto_painel_km_url ||
  v.foto_veiculo_url || v.foto_veiculo_final_url ||
  (Array.isArray(v.midias) && v.midias.length) || (Array.isArray(v.fotos) && v.fotos.length),
);

export default async function gerarAlertasViagemIA({ user } = {}) {
  const viagens = await store.filter('Viagem', {}, '-data_saida', 5000).catch(() => []);
  const abastecimentos = await store.filter('Abastecimento', {}, '-data', 5000).catch(() => []);
  const existentes = await store.filter('AlertaViagemIA', {}, '-created_date', 5000).catch(() => []);

  // Dedupe: não recria alerta ainda aberto (não resolvido) para a mesma (viagem, tipo).
  const abertos = new Set(
    existentes.filter((a) => a.status !== 'resolvido').map((a) => `${a.viagem_id}|${a.tipo_alerta}`),
  );
  const novos = [];
  const push = (a) => {
    const key = `${a.viagem_id}|${a.tipo_alerta}`;
    if (abertos.has(key)) return;
    abertos.add(key);
    novos.push({ status: 'novo', ...a });
  };

  const finalizadas = viagens.filter((v) => FINALIZADAS.has(String(v.status)));

  // Média de km por viagem (para detectar uso excessivo).
  const kms = finalizadas.map((v) => kmDeclarado(v) || kmCalc(v) || 0).filter((k) => k > 0);
  const mediaKm = kms.length ? kms.reduce((s, k) => s + k, 0) / kms.length : 0;

  for (const v of finalizadas) {
    const declarado = kmDeclarado(v);
    const calc = kmCalc(v);
    const ref = v.numero || v.id;

    // 1) KM inconsistente
    if (calc != null && calc < 0) {
      push({ viagem_id: v.id, tipo_alerta: 'km_inconsistente', severidade: 'critico',
        descricao: `KM final (${num(v.km_final)}) menor que o inicial (${num(v.km_inicial)}) na viagem ${ref}.`,
        valor_esperado: 0, valor_observado: calc });
    } else if (calc != null && calc > 0 && declarado > 0) {
      const dif = Math.abs(declarado - calc);
      const perc = (dif / calc) * 100;
      if (dif > 5 && perc > 5) {
        push({ viagem_id: v.id, tipo_alerta: 'km_inconsistente', severidade: perc > 20 ? 'critico' : 'aviso',
          descricao: `KM declarado (${r1(declarado)}) diverge do calculado pelo hodômetro (${r1(calc)}) na viagem ${ref}.`,
          valor_esperado: r1(calc), valor_observado: r1(declarado), percentual_desvio: r1(perc) });
      }
    }

    // 2) Ausência de foto
    if (!temFoto(v)) {
      push({ viagem_id: v.id, tipo_alerta: 'ausencia_foto', severidade: 'aviso',
        descricao: `Viagem ${ref} finalizada sem foto do painel/veículo registrada.` });
    }

    // 3) Uso excessivo (km muito acima da média)
    const kmV = declarado || calc || 0;
    if (mediaKm > 0 && kmV > mediaKm * 2 && kmV > 300) {
      push({ viagem_id: v.id, tipo_alerta: 'uso_excessivo', severidade: 'aviso',
        descricao: `Viagem ${ref} com ${r1(kmV)} km — muito acima da média (${r1(mediaKm)} km).`,
        valor_esperado: r1(mediaKm), valor_observado: r1(kmV), percentual_desvio: r1(((kmV - mediaKm) / mediaKm) * 100) });
    }
  }

  // 4) Consumo anormal por veículo (litros abastecidos vs km rodado) → atrela à
  //    última viagem finalizada do veículo.
  const litrosPorVeic = {};
  for (const ab of abastecimentos) {
    if (!ab.veiculo_id) continue;
    litrosPorVeic[ab.veiculo_id] = (litrosPorVeic[ab.veiculo_id] || 0) + num(ab.litros);
  }
  const kmPorVeic = {};
  const ultimaViagemVeic = {};
  for (const v of finalizadas) {
    if (!v.veiculo_id) continue;
    kmPorVeic[v.veiculo_id] = (kmPorVeic[v.veiculo_id] || 0) + Math.max(0, kmDeclarado(v) || kmCalc(v) || 0);
    if (!ultimaViagemVeic[v.veiculo_id]) ultimaViagemVeic[v.veiculo_id] = v; // viagens já vêm ordenadas -data_saida
  }
  for (const veicId of Object.keys(litrosPorVeic)) {
    const litros = litrosPorVeic[veicId];
    const km = kmPorVeic[veicId] || 0;
    const v = ultimaViagemVeic[veicId];
    if (litros > 0 && km > 50 && v) {
      const lkm = litros / km;
      if (lkm > BASELINE_LKM * 1.25) {
        const perc = ((lkm - BASELINE_LKM) / BASELINE_LKM) * 100;
        push({ viagem_id: v.id, tipo_alerta: 'consumo_anormal', severidade: lkm > BASELINE_LKM * 1.5 ? 'critico' : 'aviso',
          descricao: `Consumo elevado do veículo: ${(lkm * 100).toFixed(1)} L/100km (${r1(perc)}% acima do esperado).`,
          valor_esperado: r1(BASELINE_LKM * 100), valor_observado: r1(lkm * 100), percentual_desvio: r1(perc) });
      }
    }
  }

  // Persiste os novos alertas.
  let criados = 0;
  for (const a of novos) {
    try {
      await store.create('AlertaViagemIA', { ...a, gerado_em: new Date().toISOString() }, user?.email || null);
      criados++;
    } catch { /* ignora falha pontual de gravação */ }
  }

  const porTipo = {};
  for (const a of novos) porTipo[a.tipo_alerta] = (porTipo[a.tipo_alerta] || 0) + 1;

  return { ok: true, criados, analisadas: finalizadas.length, porTipo };
}
