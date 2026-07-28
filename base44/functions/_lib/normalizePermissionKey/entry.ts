/**
 * Normaliza permission_key para comparação consistente
 * - Trim whitespace
 * - Mantém case original (case-sensitive)
 */
export function normalizePermissionKey(key) {
  if (!key) return '';
  return String(key).trim();
}

/**
 * Valida se chave segue padrão
 */
export function isValidPermissionKey(key) {
  const normalized = normalizePermissionKey(key);
  return normalized.length > 0 && /^[A-Za-z0-9_-]+$/.test(normalized);
}