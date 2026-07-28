import { z } from "npm:zod@3.24.2";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";
import {
  validateInput,
  authenticateUser,
  authorizeByTenant,
  checkRateLimit,
  createLogger,
  sanitizeString,
  successResponse,
  errorResponse,
} from "./_lib/middleware.ts";

const ItemSchema = z.object({
  etapa: z.string().min(1).max(100),
  descricao: z.string().min(1).max(500),
  unidade: z.string().max(20).optional().default("un"),
  quantidade: z.number().positive(),
  valor_unitario: z.number().positive(),
  observacoes: z.string().max(1000).optional().default(""),
});

const RequestSchema = z.object({
  contratoId: z.string().uuid(),
  obraId: z.string().uuid(),
  dados: z.array(ItemSchema).min(1).max(1000),
});

type RequestData = z.infer<typeof RequestSchema>;

type ProcessedItem = {
  etapa: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacoes: string;
};

type ResponseData = {
  preview: {
    etapas: number;
    items_totais: number;
    valor_total: number;
    items_por_etapa: Array<{
      etapa: string;
      quantidade: number;
      valor: number;
    }>;
  };
  dados_processados: ProcessedItem[];
  validacoes: Array<{
    linha: number;
    tipo: string;
    mensagem: string;
  }>;
  pronto_para_importar: boolean;
};

async function handleRequest(
  data: RequestData,
  context: {
    base44: ReturnType<typeof createClientFromRequest>;
    user: { email: string; role: string };
  }
): Promise<ResponseData> {
  const logger = createLogger("importarExcelContrato");
  const { base44 } = context;

  logger.info("Iniciando validação de importação", {
    contratoId: data.contratoId,
    totalItens: data.dados.length,
  });

  // ✅ Validar que contrato pertence à obra
  const contratos = await base44.entities.Contrato.filter({
    id: data.contratoId,
    obra_id: data.obraId, // Filtro por obra
  });

  if (!contratos.length) {
    throw new Error("Contrato não encontrado ou acesso negado");
  }

  const validacoes: Array<{
    linha: number;
    tipo: string;
    mensagem: string;
  }> = [];
  const itensProcessados: ProcessedItem[] = [];

  // Validar e sanitizar cada item
  data.dados.forEach((row, idx) => {
    // ✅ Sanitizar strings
    const descricao = sanitizeString(row.descricao);
    const observacoes = sanitizeString(row.observacoes);
    const etapa = sanitizeString(row.etapa);

    if (!descricao || !etapa) {
      validacoes.push({
        linha: idx + 2,
        tipo: "erro",
        mensagem: "Descrição ou etapa vazia após sanitização",
      });
      return;
    }

    const valorTotal = row.quantidade * row.valor_unitario;

    itensProcessados.push({
      etapa,
      descricao,
      unidade: row.unidade,
      quantidade: row.quantidade,
      valor_unitario: row.valor_unitario,
      valor_total: valorTotal,
      observacoes,
    });
  });

  if (itensProcessados.length === 0) {
    throw new Error("Nenhum item válido encontrado");
  }

  // Agrupar por etapa
  const itemsAgrupados: Record<string, ProcessedItem[]> = {};
  itensProcessados.forEach((item) => {
    if (!itemsAgrupados[item.etapa]) {
      itemsAgrupados[item.etapa] = [];
    }
    itemsAgrupados[item.etapa].push(item);
  });

  const totalValor = itensProcessados.reduce(
    (acc, i) => acc + i.valor_total,
    0
  );

  logger.info("Validação concluída", {
    contratoId: data.contratoId,
    itensValidos: itensProcessados.length,
    etapas: Object.keys(itemsAgrupados).length,
    valorTotal,
  });

  return {
    preview: {
      etapas: Object.keys(itemsAgrupados).length,
      items_totais: itensProcessados.length,
      valor_total: totalValor,
      items_por_etapa: Object.entries(itemsAgrupados).map(([etapa, items]) => ({
        etapa,
        quantidade: items.length,
        valor: items.reduce((a, i) => a + i.valor_total, 0),
      })),
    },
    dados_processados: itensProcessados,
    validacoes,
    pronto_para_importar: validacoes.filter((v) => v.tipo === "erro").length === 0,
  };
}

Deno.serve(async (req: Request) => {
  const logger = createLogger("importarExcelContrato");
  const startTime = Date.now();

  try {
    const validation = await validateInput(req, RequestSchema);
    if (!validation.success) {
      logger.warn("Validação de schema falhou");
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
      logger.warn("Autorização negada");
      return Response.json(errorResponse(authz.error!, "FORBIDDEN"), {
        status: 403,
      });
    }

    const result = await handleRequest(payload, { base44, user });

    const duration = Date.now() - startTime;
    logger.info("Sucesso", {
      duration,
      itensProcessados: result.dados_processados.length,
    });

    return Response.json(successResponse(result));
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error("Erro não tratado", error);

    return Response.json(
      errorResponse("Erro ao importar dados", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
});