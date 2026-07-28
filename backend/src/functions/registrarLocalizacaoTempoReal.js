import { store } from '../entityStore.js';

// Registra a posição GPS atual na rota (RotaMotorista) durante o rastreamento
// em tempo real. Usada pelo hook useRastreamentoTempoReal em /MinhasViagens.
// Best-effort no update: se a rota sumiu, não quebra o ping de localização.

export default async function registrarLocalizacaoTempoReal({ body }) {
  const { latitude, longitude, rota_id } = body || {};
  if (!latitude || !longitude || !rota_id) {
    throw Object.assign(new Error('Campos obrigatórios faltando'), { status: 400 });
  }

  try {
    await store.update('RotaMotorista', rota_id, {
      ultima_latitude: latitude,
      ultima_longitude: longitude,
      ultima_atualizacao_gps: new Date().toISOString()
    });
  } catch { /* best-effort */ }

  return { success: true, rota_id, timestamp: new Date().toISOString() };
}
