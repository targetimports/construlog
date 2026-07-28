/**
 * MIDDLEWARE GLOBAL: captura erros não tratados
 * 
 * Envolver o handler principal:
 *   export default comErroGlobal(async (req) => { ... })
 */

import { obterCorrelationId, logarErro } from './correlationId.ts';
import { erroSeguro } from './erroSeguradoResponse.ts';

function comErroGlobal(handler) {
  return async (req) => {
    const correlationId = obterCorrelationId(req);
    
    try {
      // Adicionar correlationId ao contexto se possível
      const response = await handler(req, correlationId);
      
      // Se resposta é um objeto com .body e .status, usar o padrão
      if (response && response.body && response.status) {
        return Response.json(response.body, { status: response.status });
      }
      
      // Caso contrário, retornar como está
      return response;
    } catch (error) {
      logarErro(
        correlationId,
        error.code || 'ERRO_INTERNO',
        error.message,
        error.stack
      );
      
      // Se é um erro nosso (com .body), retornar direto
      if (error.body && error.status) {
        return Response.json(error.body, { status: error.status });
      }
      
      // Senão, retornar erro genérico seguro
      const erroGenerico = erroSeguro(
        'ERRO_INTERNO',
        'Algo deu errado. Tente novamente.',
        500
      );
      erroGenerico.body.correlationId = correlationId;
      
      return Response.json(erroGenerico.body, { status: 500 });
    }
  };
}

export { comErroGlobal };