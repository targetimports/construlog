// Rastreia, no localStorage, as pendências que o usuário já "viu" (clicou),
// para não contarem mais no sino. Compartilhado entre o sino e a página.
const KEY = 'construlog_pendencias_vistas';
const EVENT = 'pendencias-vistas-changed';

export const getVistas = () => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
};

export const marcarVista = (chave) => {
  if (!chave) return;
  const s = getVistas();
  if (s.has(chave)) return;
  s.add(chave);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* noop */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* noop */ }
};

export const desmarcarVista = (chave) => {
  const s = getVistas();
  if (!s.has(chave)) return;
  s.delete(chave);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* noop */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* noop */ }
};

export const PENDENCIAS_VISTAS_EVENT = EVENT;
