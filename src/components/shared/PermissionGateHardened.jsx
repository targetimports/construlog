import React from 'react';

/**
 * PermissionGate Hardened
 * - Valida permissão ANTES de renderizar children
 * - Se sem permissão: return null (não tenta render)
 * - Se cargo inválido: return null
 * - Logs seguros
 */

export function PermissionGateHardened({
  children,
  permission = null,
  cargo = null,
  requiredPermissions = [],
  fallback = null,
  componentName = 'unknown'
}) {
  const user = null; // seria obtido via context em produção

  // Validar cargo
  if (cargo && user?.cargo?.toLowerCase() !== cargo.toLowerCase()) {
    console.warn(`[SAFE MODE] Cargo ${user?.cargo} não permitido em ${componentName}. Requerido: ${cargo}`);
    return fallback;
  }

  // Validar permissão simples
  if (permission) {
    const hasPermission = user?.permissions?.includes(permission);
    if (!hasPermission) {
      console.warn(`[SAFE MODE] Permissão ${permission} negada em ${componentName}`);
      return fallback;
    }
  }

  // Validar múltiplas permissões (AND)
  if (requiredPermissions.length > 0) {
    const hasAll = requiredPermissions.every(p => user?.permissions?.includes(p));
    if (!hasAll) {
      console.warn(
        `[SAFE MODE] Permissões faltando em ${componentName}:`,
        requiredPermissions.filter(p => !user?.permissions?.includes(p))
      );
      return fallback;
    }
  }

  // Tudo OK
  return children;
}

/**
 * Blind Motorista Component
 * Renderiza componente APENAS se user não for motorista
 */
export function BlindMotorista({
  children,
  componentName = 'unknown'
}) {
  const user = null; // seria obtido via context

  const isMotorista = user?.cargo?.toLowerCase() === 'motorista' ||
                     user?.perfil_acesso?.toLowerCase() === 'motorista';

  if (isMotorista) {
    console.warn(`[SAFE MODE] ${componentName} bloqueado para motorista`);
    return null;
  }

  return children;
}

/**
 * Safe Card Fallback
 * Se KPI/componente falhar: mostra card com "Indisponível"
 */
export function SafeCardFallback({ label = 'Dados indisponíveis' }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}