/**
 * CORRELATION ID: rastreia requests end-to-end
 * 
 * Uso:
 *   const correlationId = obterCorrelationId(req);
 *   logar(`[${correlationId}] operação realizada`);
 */

// Uses built-in Web Crypto API (no external import needed in Deno)

/**
 * Obtém ou gera correlationId de um request
 */
function obterCorrelationId(req) {
  // Tentar buscar do header
  const headerValue = req.headers.get('x-correlation-id') || 
                      req.headers.get('x-request-id') ||
                      req.headers.get('correlation-id');
  
  if (headerValue) {
    return headerValue;
  }
  
  // Gerar novo
  const array = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `req_${Date.now()}_${hex}`;
}

/**
 * Log estruturado com correlationId
 */
function logar(correlationId, nivel, mensagem, dados = null) {
  const log = {
    timestamp: new Date().toISOString(),
    correlationId,
    nivel, // 'info', 'warn', 'error', 'debug'
    mensagem,
    ...(dados && { dados })
  };
  
  const output = `[${log.timestamp}] [${correlationId}] [${nivel.toUpperCase()}] ${mensagem}`;
  
  if (nivel === 'error') {
    console.error(output, dados || '');
  } else if (nivel === 'warn') {
    console.warn(output, dados || '');
  } else if (nivel === 'debug') {
    console.debug(output, dados || '');
  } else {
    console.log(output, dados || '');
  }
  
  return log;
}

/**
 * Log de erro estruturado
 */
function logarErro(correlationId, codigo, mensagem, stack = null) {
  const log = {
    timestamp: new Date().toISOString(),
    correlationId,
    type: 'ERROR',
    codigo,
    mensagem,
    stack: stack ? stack.substring(0, 500) : null // Limitar tamanho do stack
  };
  
  console.error(
    `[${log.timestamp}] [${correlationId}] [ERROR] ${codigo}: ${mensagem}`
  );
  
  if (stack) {
    console.error(`Stack: ${stack.substring(0, 300)}...`);
  }
  
  return log;
}

export { obterCorrelationId, logar, logarErro };