/**
 * Response Handler - Padroniza todas as respostas de functions
 * 
 * Formato padrão:
 * Sucesso: { ok: true, data }
 * Erro esperado: { ok: false, code, message }
 * Erro interno: { ok: false, code: "INTERNAL_ERROR", message: "Erro interno" }
 */

export function successResponse(data: any, message?: string): Response {
  return Response.json({
    ok: true,
    data,
    ...(message && { message })
  });
}

export function errorResponse(code: string, message: string, statusCode: number = 400): Response {
  return Response.json(
    {
      ok: false,
      code,
      message
    },
    { status: statusCode }
  );
}

export function internalErrorResponse(error?: any): Response {
  console.error('[Internal Error]', error);
  return Response.json(
    {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    },
    { status: 500 }
  );
}

/**
 * Wrap uma função com tratamento de erro padrão
 */
export async function withErrorHandler(
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    console.error('[Unhandled Error]', error);
    return internalErrorResponse(error);
  }
}