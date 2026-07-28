/**
 * Controle de edição concorrente
 * Detecta conflitos quando múltiplos usuários editam o mesmo registro
 */

/**
 * Validar se o registro foi alterado desde a última leitura
 * @param {Object} base44 - Cliente Base44
 * @param {string} entityName - Nome da entidade
 * @param {string} recordId - ID do registro
 * @param {string} lastUpdatedAt - Timestamp da última leitura (ISO string)
 * @returns {Promise<Object>} { hasConflict: boolean, currentRecord?: object }
 */
export async function checkConcurrencyConflict(base44, entityName, recordId, lastUpdatedAt) {
  try {
    const currentRecord = await base44.asServiceRole.entities[entityName].read(recordId);
    
    if (!currentRecord) {
      return {
        hasConflict: true,
        code: 'NOT_FOUND',
        message: 'Registro foi deletado por outro usuário'
      };
    }

    // Comparar timestamps
    if (currentRecord.updated_date) {
      const currentTime = new Date(currentRecord.updated_date).getTime();
      const lastTime = new Date(lastUpdatedAt).getTime();

      if (currentTime > lastTime) {
        return {
          hasConflict: true,
          code: 'CONFLICT',
          message: 'Registro foi alterado por outro usuário',
          currentRecord,
          conflictInfo: {
            lastUpdate: currentRecord.updated_date,
            lastUpdateBy: currentRecord.updated_by || 'desconhecido'
          }
        };
      }
    }

    return { hasConflict: false, currentRecord };
  } catch (error) {
    throw new Error(`Erro ao verificar conflito: ${error.message}`);
  }
}

/**
 * Atualizar registro com controle de concorrência
 * @param {Object} base44 - Cliente Base44
 * @param {string} entityName - Nome da entidade
 * @param {string} recordId - ID do registro
 * @param {Object} updates - Dados a atualizar
 * @param {string} lastUpdatedAt - Timestamp da última leitura
 * @returns {Promise<Object>} { ok: boolean, data?: object, conflict?: object }
 */
export async function updateWithConcurrencyCheck(
  base44,
  entityName,
  recordId,
  updates,
  lastUpdatedAt
) {
  try {
    // Verificar conflito
    const conflict = await checkConcurrencyConflict(base44, entityName, recordId, lastUpdatedAt);

    if (conflict.hasConflict) {
      return {
        ok: false,
        code: conflict.code,
        message: conflict.message,
        conflictInfo: conflict.conflictInfo
      };
    }

    // Atualizar se não houver conflito
    const updated = await base44.asServiceRole.entities[entityName].update(recordId, updates);

    return {
      ok: true,
      data: updated
    };
  } catch (error) {
    return {
      ok: false,
      code: 'ERROR',
      message: error.message
    };
  }
}

/**
 * Helper para extrair lastUpdatedAt do payload de forma segura
 */
export function extractLastUpdatedAt(payload) {
  return payload?.last_updated_at || payload?.updated_at || new Date().toISOString();
}