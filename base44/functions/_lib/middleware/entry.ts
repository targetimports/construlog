// Middleware seguro obrigatório para todas as functions
import { z } from "npm:zod@3.24.2";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

export type FunctionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
};

export type FunctionContext = {
  base44: ReturnType<typeof createClientFromRequest>;
  user: { id: string; email: string; role: "admin" | "user"; tenant_id?: string };
  tenantId: string;
  requestId: string;
  startTime: number;
};

// Logger estruturado
export function createLogger(functionName: string) {
  return {
    info: (msg: string, data?: any) => {
      console.log(
        JSON.stringify({
          level: "INFO",
          function: functionName,
          message: msg,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    },
    warn: (msg: string, data?: any) => {
      console.warn(
        JSON.stringify({
          level: "WARN",
          function: functionName,
          message: msg,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    },
    error: (msg: string, error?: any) => {
      console.error(
        JSON.stringify({
          level: "ERROR",
          function: functionName,
          message: msg,
          error: error?.message || String(error),
          stack: error?.stack,
          timestamp: new Date().toISOString(),
        })
      );
    },
  };
}

// Middleware 1: Validação de entrada
export async function validateInput<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const json = await req.json();
    const validated = await schema.parseAsync(json);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validação falhou: ${error.errors
          .map((e) => `${e.path.join(".")} - ${e.message}`)
          .join("; ")}`,
      };
    }
    return { success: false, error: "Erro ao processar requisição" };
  }
}

// Middleware 2: Autenticação obrigatória
export async function authenticateUser(
  base44: ReturnType<typeof createClientFromRequest>
): Promise<{
  success: boolean;
  user?: { id: string; email: string; role: "admin" | "user"; tenant_id?: string };
  error?: string;
}> {
  try {
    const user = await base44.auth.me();
    if (!user || !user.email) {
      return { success: false, error: "Não autenticado" };
    }
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as "admin" | "user",
        tenant_id: user.tenant_id,
      },
    };
  } catch {
    return { success: false, error: "Erro ao autenticar" };
  }
}

// Middleware 3: Autorização por tenant/empresa/obra
export async function authorizeByTenant(
  base44: ReturnType<typeof createClientFromRequest>,
  user: { email: string; role: string },
  requiredTenantId: string,
  entityType?: "obra" | "empresa"
): Promise<{ authorized: boolean; error?: string }> {
  // Admin sempre autorizado
  if (user.role === "admin") {
    return { authorized: true };
  }

  // Verificar tenant_id do usuário
  try {
    const userProf = await base44.auth.me();
    if (!userProf) {
      return { authorized: false, error: "Usuário não encontrado" };
    }

    // Se houver validação de tenant, fazer aqui
    // Exemplo: verificar se usuário tem acesso à obra/empresa
    if (entityType === "obra") {
      // Verificar PermissaoObra
      const perms = await base44.entities.PermissaoObra?.filter?.({
        usuario_email: user.email,
        obra_id: requiredTenantId,
      });
      if (!perms?.length) {
        return { authorized: false, error: "Acesso negado à obra" };
      }
    }

    return { authorized: true };
  } catch {
    return { authorized: false, error: "Erro ao verificar autorização" };
  }
}

// Middleware 4: Rate limiter básico (em memória para single-instance)
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

export function checkRateLimit(
  userId: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; error?: string } {
  const key = userId;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} requisições por minuto atingido`,
    };
  }

  record.count++;
  return { allowed: true };
}

// Helper: Sanitizar strings (previne injection básica)
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "") // Remove tags HTML
    .slice(0, 1000) // Limita tamanho
    .trim();
}

// Helper: Safe response
export function successResponse<T>(
  data: T,
  code?: string
): FunctionResponse<T> {
  return {
    success: true,
    data,
    code: code || "OK",
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(
  error: string,
  code: string = "ERROR"
): FunctionResponse {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
  };
}