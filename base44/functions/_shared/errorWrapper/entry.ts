/**
 * Error Wrapper - Converte funções antigas para novo formato de resposta
 * Garante que TODAS as functions retornem JSON válido
 */

import { internalErrorResponse } from './responseHandler.ts';
import { FunctionLogger } from './logger.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export function withJsonErrorHandler(
  functionName = 'unknown',
  handler = null
) {
  // Se handler é a função, ajustar args
  const actualHandler = typeof functionName === 'function' ? functionName : handler;
  const actualFunctionName = typeof functionName === 'string' ? functionName : 'unknown';

  return async (req) => {
    const base44 = createClientFromRequest(req);
    const logger = new FunctionLogger(actualFunctionName, base44);
    let payload = {};

    try {
      payload = await req.clone().json().catch(() => ({}));
    } catch (e) {
      // Ignorar erro de parse
    }

    try {
      const response = await actualHandler(req);
      
      // Se já é JSON válido, retornar
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const user = await base44.auth.me().catch(() => null);
        await logger.success(user, payload);
        return response;
      }

      // Se é HTML ou outro tipo, converter para erro
      console.error('[errorWrapper] Response não é JSON:', {
        status: response.status,
        contentType
      });
      
      const user = await base44.auth.me().catch(() => null);
      await logger.error(user, payload, new Error('Backend retornou HTML/non-JSON'), 'RESPONSE_FORMAT_ERROR');
      
      return internalErrorResponse(new Error('Backend retornou HTML/non-JSON'));
    } catch (error) {
      console.error('[errorWrapper] Erro não tratado:', error);
      const user = await base44.auth.me().catch(() => null);
      await logger.error(user, payload, error, 'UNHANDLED_ERROR');
      return internalErrorResponse(error);
    }
  };
}