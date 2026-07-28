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
} from "./_lib/middleware.ts";

const RequestSchema = z.object({
  contratoId: z.string().uuid(),
  obraId: z.string().uuid(),
  acao: z.enum(["visualizar", "editar", "deletar", "aprovar", "criar_medicao"]),
});

type RequestData = z.infer<typeof RequestSchema>;

type ResponseData = {
  permitido: boolean;
  permissoes?: Record<string, boolean>;
  motivo?: string;
};

async function handleRequest(
  data: RequestData,
  context: {
    base44: ReturnType<typeof createClientFromRequest>;
    user: { email: string; role: string };
  }
): Promise<ResponseData> {
  const logger = createLogger("validadorPermissoesContrato");
  const { base44, user } = context;

  logger.info("Validando permissões", {
    contratoId: data.contratoId,
    acao: data.acao,
    email: user.email,
  });

  // ✅ Buscar contrato COM filtro por obra
  const contratos = await base44.entities.Contrato.filter({
    id: data.contratoId,
    obra_id: data.obraId, // IMPORTANTE: Filtro obrigatório
  });

  if (!contratos.length) {
    throw new Error("Contrato não encontrado ou acesso negado");
  }

  const contrato = contratos[0];
  const isAdmin = user.role === "admin";
  const isOwner = user.email === contrato.created_by;

  // Verificar perfil de acesso (com filtro por obra)
  const perfis = await base44.entities.PerfilAcesso?.filter?.({
    usuario_email: user.email,
    obra_id: data.obraId, // ✅ Filtro por obra
  }) || [];
  const temPerfilContrato = perfis.some((p) =>
    p.modulo_contrato?.includes?.(data.acao)
  );

  // Verificar alçada por obra (se necessário)
  let temAlcada = false;
  if (["editar", "aprovar"].includes(data.acao)) {
    const alcadas = await base44.entities.Alcada?.filter?.({
      usuario_email: user.email,
      obra_id: data.obraId, // ✅ Filtro por obra
    }) || [];
    temAlcada = alcadas.some((a) => a.modulo_contrato);
  }

  // Matriz de permissões
  const permissoes: Record<string, boolean> = {
    visualizar: isAdmin || temPerfilContrato || isOwner,
    editar: isAdmin || temAlcada,
    deletar: isAdmin,
    aprovar: isAdmin || temAlcada,
    criar_medicao: isAdmin || temPerfilContrato || temAlcada,
  };

  const permitido = permissoes[data.acao] ?? false;

  logger.info("Validação concluída", {
    contratoId: data.contratoId,
    acao: data.acao,
    permitido,
    isAdmin,
  });

  return {
    permitido,
    ...(permitido && { permissoes }),
    ...(!permitido && {
      motivo: temPerfilContrato ? "Sem alçada para esta ação" : "Sem permissão",
    }),
  };
}

Deno.serve(async (req: Request) => {
  const logger = createLogger("validadorPermissoesContrato");
  const startTime = Date.now();

  try {
    const validation = await validateInput(req, RequestSchema);
    if (!validation.success) {
      logger.warn("Validação falhou");
      return Response.json(errorResponse(validation.error!, "INVALID_INPUT"), {
        status: 400,
      });
    }

    const payload = validation.data as RequestData;
    const base44 = createClientFromRequest(req);

    const auth = await authenticateUser(base44);
    if (!auth.success) {
      logger.warn("Autenticação falhou");
      return Response.json(errorResponse(auth.error!, "UNAUTHORIZED"), {
        status: 401,
      });
    }

    const user = auth.user!;

    const rateLimitCheck = checkRateLimit(user.email);
    if (!rateLimitCheck.allowed) {
      logger.warn("Rate limit atingido");
      return Response.json(
        errorResponse(rateLimitCheck.error!, "RATE_LIMITED"),
        { status: 429 }
      );
    }

    const authz = await authorizeByTenant(
      base44,
      user,
      payload.obraId,
      "obra"
    );
    if (!authz.authorized) {
      logger.warn("Autorização negada", { email: user.email });
      return Response.json(errorResponse(authz.error!, "FORBIDDEN"), {
        status: 403,
      });
    }

    const result = await handleRequest(payload, { base44, user });

    const duration = Date.now() - startTime;
    logger.info("Sucesso", { duration });

    return Response.json(
      successResponse(result, result.permitido ? "PERMITTED" : "DENIED")
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error("Erro não tratado", error);

    return Response.json(
      errorResponse("Erro ao validar permissões", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
});