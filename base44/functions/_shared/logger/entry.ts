/**
 * Logger centralizado para auditoria técnica de functions
 * Registra: nome da function, usuário, payload, erro, timestamp
 */

export class FunctionLogger {
  constructor(functionName, base44) {
    this.functionName = functionName;
    this.base44 = base44;
    this.startTime = Date.now();
  }

  /**
   * Sanitizar payload para remover dados sensíveis
   */
  static sanitizePayload(payload) {
    if (!payload) return null;
    
    const sanitized = JSON.parse(JSON.stringify(payload));
    const sensitiveFIelds = ['password', 'token', 'secret', 'api_key', 'card_number'];
    
    const recursiveSanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;
      for (const key in obj) {
        if (sensitiveFIelds.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          recursiveSanitize(obj[key]);
        }
      }
    };
    
    recursiveSanitize(sanitized);
    return sanitized;
  }

  /**
   * Extrair informações da requisição
   */
  static extractRequestInfo(req) {
    const headers = req.headers || {};
    return {
      ip_address: headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      user_agent: headers.get('user-agent') || 'unknown'
    };
  }

  /**
   * Log de execução com sucesso
   */
  async success(user, payload, result = {}, metadata = {}) {
    const executionTime = Date.now() - this.startTime;
    
    try {
      await this.base44.asServiceRole.entities.SystemLogs.create({
        function_name: this.functionName,
        user_email: user?.email || 'anonymous',
        user_role: user?.role || 'unknown',
        payload: JSON.stringify(FunctionLogger.sanitizePayload(payload)),
        result: 'success',
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined
      }).catch(err => {
        console.warn(`[${this.functionName}] Falha ao registrar log de sucesso:`, err.message);
      });
    } catch (err) {
      console.warn(`[${this.functionName}] Erro ao criar SystemLogs:`, err.message);
    }

    console.log(`[${this.functionName}] ✓ Sucesso em ${executionTime}ms (${user?.email})`);
  }

  /**
   * Log de erro
   */
  async error(user, payload, error, errorCode = 'ERROR', metadata = {}) {
    const executionTime = Date.now() - this.startTime;
    
    try {
      await this.base44.asServiceRole.entities.SystemLogs.create({
        function_name: this.functionName,
        user_email: user?.email || 'anonymous',
        user_role: user?.role || 'unknown',
        payload: JSON.stringify(FunctionLogger.sanitizePayload(payload)),
        result: 'error',
        error_code: errorCode,
        error_message: error?.message || String(error),
        error_stack: error?.stack ? error.stack.substring(0, 500) : undefined,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined
      }).catch(err => {
        console.warn(`[${this.functionName}] Falha ao registrar log de erro:`, err.message);
      });
    } catch (err) {
      console.warn(`[${this.functionName}] Erro ao criar SystemLogs:`, err.message);
    }

    console.error(`[${this.functionName}] ✗ Erro em ${executionTime}ms: ${error?.message}`);
  }

  /**
   * Log de autorização negada
   */
  async unauthorized(user, payload, metadata = {}) {
    const executionTime = Date.now() - this.startTime;
    
    try {
      await this.base44.asServiceRole.entities.SystemLogs.create({
        function_name: this.functionName,
        user_email: user?.email || 'anonymous',
        user_role: user?.role || 'unknown',
        payload: JSON.stringify(FunctionLogger.sanitizePayload(payload)),
        result: 'unauthorized',
        error_code: 'UNAUTHORIZED',
        error_message: 'Usuário não autenticado',
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined
      }).catch(err => {
        console.warn(`[${this.functionName}] Falha ao registrar log de unauthorized:`, err.message);
      });
    } catch (err) {
      console.warn(`[${this.functionName}] Erro ao criar SystemLogs:`, err.message);
    }

    console.warn(`[${this.functionName}] ⚠ Unauthorized em ${executionTime}ms`);
  }

  /**
   * Log de acesso proibido
   */
  async forbidden(user, payload, reason = 'Permissão insuficiente', metadata = {}) {
    const executionTime = Date.now() - this.startTime;
    
    try {
      await this.base44.asServiceRole.entities.SystemLogs.create({
        function_name: this.functionName,
        user_email: user?.email || 'anonymous',
        user_role: user?.role || 'unknown',
        payload: JSON.stringify(FunctionLogger.sanitizePayload(payload)),
        result: 'forbidden',
        error_code: 'FORBIDDEN',
        error_message: reason,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined
      }).catch(err => {
        console.warn(`[${this.functionName}] Falha ao registrar log de forbidden:`, err.message);
      });
    } catch (err) {
      console.warn(`[${this.functionName}] Erro ao criar SystemLogs:`, err.message);
    }

    console.warn(`[${this.functionName}] 🔒 Forbidden em ${executionTime}ms (${user?.email}): ${reason}`);
  }

  /**
   * Log de erro de validação
   */
  async validationError(user, payload, validationErrors, metadata = {}) {
    const executionTime = Date.now() - this.startTime;
    
    try {
      await this.base44.asServiceRole.entities.SystemLogs.create({
        function_name: this.functionName,
        user_email: user?.email || 'anonymous',
        user_role: user?.role || 'unknown',
        payload: JSON.stringify(FunctionLogger.sanitizePayload(payload)),
        result: 'validation_error',
        error_code: 'VALIDATION_ERROR',
        error_message: Array.isArray(validationErrors) ? validationErrors.join(', ') : String(validationErrors),
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined
      }).catch(err => {
        console.warn(`[${this.functionName}] Falha ao registrar log de validationError:`, err.message);
      });
    } catch (err) {
      console.warn(`[${this.functionName}] Erro ao criar SystemLogs:`, err.message);
    }

    console.warn(`[${this.functionName}] ⚠ Validation Error em ${executionTime}ms`);
  }
}

/**
 * Factory para criar logger com req + base44
 */
export function createLogger(functionName, req, base44) {
  const logger = new FunctionLogger(functionName, base44);
  logger.requestInfo = FunctionLogger.extractRequestInfo(req);
  return logger;
}