import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { updateWithConcurrencyCheck } from './_shared/concurrencyControl.js';
import { FunctionLogger } from './_shared/logger.js';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('atualizarOrdemCompraComControle', base44);

  try {
    const user = await base44.auth.me();
    if (!user) {
      await logger.unauthorized(user, {});
      return Response.json({ ok: false, code: 'UNAUTHORIZED', message: 'Não autenticado' }, { status: 401 });
    }

    const { oc_id, updates, last_updated_at } = await req.json();

    if (!oc_id || !updates || !last_updated_at) {
      await logger.validationError(user, { oc_id, updates, last_updated_at }, 'Campos obrigatórios: oc_id, updates, last_updated_at');
      return Response.json({ 
        ok: false, 
        code: 'INVALID_INPUT', 
        message: 'oc_id, updates e last_updated_at são obrigatórios' 
      }, { status: 400 });
    }

    // Usar concurrency control
    const result = await updateWithConcurrencyCheck(base44, 'OrdemCompra', oc_id, updates, last_updated_at);

    if (!result.ok) {
      if (result.code === 'CONFLICT') {
        await logger.validationError(user, { oc_id, updates }, result.message);
        return Response.json(result, { status: 409 });
      }
      await logger.error(user, { oc_id, updates }, new Error(result.message), result.code);
      return Response.json(result, { status: 500 });
    }

    await logger.success(user, { oc_id, updates }, result.data);
    return Response.json(result);
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, {}, error, 'UNHANDLED_ERROR');
    return Response.json({ ok: false, code: 'ERROR', message: error.message }, { status: 500 });
  }
});