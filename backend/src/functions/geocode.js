// Proxy de geocodificação (Nominatim/OpenStreetMap) feito no servidor.
// Evita CORS/rate-limit do navegador e envia o User-Agent que o Nominatim exige.
//   body { q }            → busca (search)
//   body { lat, lon }     → reverse
// Retorna { results: [...] } (sempre array; reverse vira array de 1).

const UA = 'GermanosERP/1.0 (contato@targetimports.com)';

export default async function geocode({ body }) {
  const { q, lat, lon, limit = 8 } = body || {};

  let url;
  if (lat != null && lon != null) {
    url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;
  } else if (q && String(q).trim().length >= 2) {
    const lim = Math.min(Number(limit) || 8, 20);
    url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${lim}&addressdetails=1&countrycodes=br`;
  } else {
    return { results: [] };
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return { results: [], error: `nominatim_${res.status}` };
    const data = await res.json();
    return { results: Array.isArray(data) ? data : (data ? [data] : []) };
  } catch (e) {
    return { results: [], error: e?.message || 'geocode_failed' };
  }
}
