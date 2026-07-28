/**
 * Middleware para garantir que TODAS as responses são JSON
 * Previne erros "Unexpected token '<'" quando backend retorna HTML
 */

import { internalErrorResponse } from '../_shared/responseHandler.ts';

export function ensureJsonResponse(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      const response = await handler(req);
      
      // Validar que é JSON
      const contentType = response.headers.get('content-type');
      if (response.status >= 400 && !contentType?.includes('application/json')) {
        console.error('[ensureJsonResponse] Non-JSON error response:', {
          status: response.status,
          contentType,
          url: req.url
        });
        
        return internalErrorResponse(
          new Error(`Backend retornou ${response.status} sem JSON`)
        );
      }
      
      return response;
    } catch (error) {
      console.error('[ensureJsonResponse] Unhandled error:', error);
      return internalErrorResponse(error);
    }
  };
}