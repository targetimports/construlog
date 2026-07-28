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
  valorTotal: z.number().positive(),
  numeroParcelas: z.number().int().min(1).max(12),
  datas: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

type RequestData = z.infer<typeof RequestSchema>;

type ResponseData = {
  provisao_criada: boolean;
  valor_total: number;
  numero_parcelas: number;
  valor_parcela: number;
  contas_criadas: number;
};

async function handleRequest(
  data: RequestData,
  context: {
    base44: ReturnType<typeof createClientFromRequest>;
    user: { email: string; role: string };
  }
): Promise<ResponseData> {
  const logger = createLogger("criarProvisionamentoContrato");
  const { base44, user } = context;

  logger.info("Iniciando provisionamento", {
    contratoId: data.contratoId,
    obraId: data.obraId,
    email: user.email,
  });

  // ✅ Buscar contrato COM filtro por obra (segurança)
  const contratos = await base44.entities.Contrato.filter({
    id: data.contratoId,
    obra_id: data.obraId, // IMPORTANTE: Filtro por obra
  });

  if (!contratos.length) {
    throw new Error("Contrato não encontrado ou acesso negado");
  }

  const contrato = contratos[0];

  // Validação de datas
  if (data.datas.length !== data.numeroParcelas) {
    throw new Error("Número de datas não corresponde às parcelas");
  }

  // Criar parcelas
  const valorParcela = data.valorTotal / data.numeroParcelas;
  const parcelas = Array.from({ length: data.numeroParcelas }, (_, i) => ({
    numero_parcela: i + 1,
    valor: valorParcela,
    data_prevista: data.datas[i],
    status: "pendente",
    descricao: `Provisionamento - Parcela ${i + 1}/${data.numeroParcelas}`,
  }));

  // Atualizar contrato
  await base44.entities.Contrato.update(data.contratoId, {
    provisionado: true,
    valor_provisionado: data.valorTotal,
    data_provisionamento: new Date().toISOString(),
    parcelas_provisionamento: parcelas,
    saldo_provisionamento: data.valorTotal,
  });

  // Criar contas a pagar (com error handling melhorado)
  const contas = parcelas.map((parcela) => ({
    tipo: "pagar" as const,
    descricao: `Provisionamento ${contrato.numero} - ${parcela.descricao}`,
    valor: parcela.valor,
    data_vencimento: parcela.data_prevista,
    status: "pendente" as const,
    contrato_id: data.contratoId,
    categoria: "contrato" as const,
    observacao: "Não pagar - é provisão",
    nota_fiscal: "NÃO PAGAR",
  }));

  let contasCount = 0;
  for (const conta of contas) {
    try {
      await base44.entities.ContaFinanceira.create(conta);
      contasCount++;
    } catch (error) {
      logger.warn("Falha ao criar conta", { erro: String(error), parcela: conta.numero_parcela });
    }
  }

  logger.info("Provisionamento criado com sucesso", {
    contratoId: data.contratoId,
    numeroParcelas: data.numeroParcelas,
    contasCount,
  });

  return {
    provisao_criada: true,
    valor_total: data.valorTotal,
    numero_parcelas: data.numeroParcelas,
    valor_parcela: valorParcela,
    contas_criadas: contasCount,
  };
}

Deno.serve(async (req: Request) => {
  const logger = createLogger("criarProvisionamentoContrato");
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
      logger.warn("Rate limit atingido", { email: user.email });
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
    logger.info("Sucesso", { duration, email: user.email });

    return Response.json(successResponse(result));
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error("Erro não tratado", error);

    return Response.json(
      errorResponse("Erro ao processar requisição", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
});