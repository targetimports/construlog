// TEMPLATE OBRIGATÓRIO - Copiar para cada nova function
// Estrutura: validate → auth → permission → execute → log → return

import { z } from "npm:zod@3.24.2";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";
import {
  validateInput,
  authenticateUser,
  authorizeByTenant,
  checkRateLimit,
  createLogger,
  successResponse,
  errorResponse,
} from "./middleware.ts";


// ============ 1. DEFINIR SCHEMA DE ENTRADA ============
const RequestSchema = z.object({
  // Adicione os campos reais aqui
  exemplo: z.string().min(1).max(100),
  numero: z.number().int().positive(),
  // Exemplo:
  // obraId: z.string().uuid(),
  // valor: z.number().positive(),
});

type RequestData = z.infer<typeof RequestSchema>;

// ============ 2. DEFINIR RESPOSTA ============
type ResponseData = {
  id: string;
  sucesso: boolean;
};

// ============ 3. LÓGICA PRINCIPAL ============
async function handleRequest(
  data: RequestData,
  context: {
    base44: ReturnType<typeof createClientFromRequest>;
    user: { email: string; role: string };
  }
): Promise<ResponseData> {
  const logger = createLogger("minha-function");

  // Aqui vai a lógica: queries, mutations, cálculos
  logger.info("Processando request", { exemplo: data.exemplo });

  return {
    id: "123",
    sucesso: true,
  };
}

// ============ 4. FUNÇÃO PRINCIPAL ============
Deno.serve(async (req: Request) => {
  const logger = createLogger("minha-function");
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // ✅ 1. Validar entrada
    const validation = await validateInput(req, RequestSchema);
    if (!validation.success) {
      logger.warn("Validação falhou", { requestId });
      return Response.json(errorResponse(validation.error!, "INVALID_INPUT"), {
        status: 400,
      });
    }

    const payload = validation.data as RequestData;

    // ✅ 2. Autenticar
    const base44 = createClientFromRequest(req);
    const auth = await authenticateUser(base44);
    if (!auth.success) {
      logger.warn("Autenticação falhou", { requestId });
      return Response.json(errorResponse(auth.error!, "UNAUTHORIZED"), {
        status: 401,
      });
    }

    const user = auth.user!;

    // ✅ 3. Rate limit
    const rateLimitCheck = checkRateLimit(user.email);
    if (!rateLimitCheck.allowed) {
      logger.warn("Rate limit atingido", { requestId, email: user.email });
      return Response.json(
        errorResponse(rateLimitCheck.error!, "RATE_LIMITED"),
        { status: 429 }
      );
    }

    // ✅ 4. Autorização por tenant (se necessário)
    // const authz = await authorizeByTenant(base44, user, payload.obraId, 'obra');
    // if (!authz.authorized) {
    //   logger.warn('Autorização negada', { requestId, email: user.email });
    //   return Response.json(errorResponse(authz.error!, 'FORBIDDEN'), { status: 403 });
    // }

    // ✅ 5. Executar lógica
    logger.info("Iniciando processamento", { requestId, email: user.email });
    const result = await handleRequest(payload, { base44, user });

    // ✅ 6. Log de sucesso
    const duration = Date.now() - startTime;
    logger.info("Sucesso", { requestId, duration, email: user.email });

    // ✅ 7. Retornar resposta
    return Response.json(successResponse(result, "OK"));
  } catch (error: any) {
    // ❌ Error handling
    const duration = Date.now() - startTime;
    logger.error("Erro não tratado", error);

    // Nunca expor stack trace em produção
    return Response.json(
      errorResponse(
        "Erro ao processar requisição",
        "INTERNAL_ERROR"
      ),
      { status: 500 }
    );
  }
});