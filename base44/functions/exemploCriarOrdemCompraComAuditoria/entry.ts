import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';

/**
 * EXEMPLO: Criar Ordem de Compra com Auditoria
 * 
 * Demonstra o padrão de erro + correlation ID + auditoria
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    // 1. Autenticação
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `Usuário ${user.email} iniciando criação de OC`);
    
    // 2. Validar entrada
    const payload = await req.json();
    
    if (!payload.obra_id) {
      logarErro(correlationId, 'OBRA_REQUIRED', 'obra_id não fornecido');
      const { body, status } = erroSeguro('OBRA_REQUIRED', 'Informe a obra destino');
      return Response.json(body, { status });
    }
    
    if (!payload.fornecedor_id) {
      const { body, status } = erroSeguro('CAMPO_OBRIGATORIO', 'Fornecedor não informado');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', 'Validação de entrada OK', {
      obraId: payload.obra_id,
      fornecedorId: payload.fornecedor_id
    });
    
    // 3. Validar obra
    const obra = await base44.entities.Obra.filter({ id: payload.obra_id });
    if (!obra || obra.length === 0) {
      logarErro(correlationId, 'OBRA_INVALIDA', `Obra ${payload.obra_id} não encontrada`);
      const { body, status } = erroSeguro('OBRA_INVALIDA');
      return Response.json(body, { status });
    }
    
    // 4. Criar OC
    logar(correlationId, 'info', 'Criando OC no banco de dados');
    
    const novaOC = {
      numero: `OC-${Date.now()}`,
      obra_id: payload.obra_id,
      empresa_id: payload.empresa_id || 'padrao',
      fornecedor_id: payload.fornecedor_id,
      fornecedor_nome: payload.fornecedor_nome,
      valor_total: payload.valor_total || 0,
      status: 'criada',
      itens: payload.itens || [],
      data_emissao: new Date().toISOString().split('T')[0]
    };
    
    const ocCriada = await base44.entities.OrdemCompra.create(novaOC);
    
    logar(correlationId, 'info', `OC criada: ${ocCriada.id}`);
    
    // 5. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'OrdemCompra',
      entidadeId: ocCriada.id,
      operacao: 'criar',
      obraId: payload.obra_id,
      usuarioId: user.email,
      funcao: 'exemploCriarOrdemCompraComAuditoria',
      beforeData: null,
      afterData: ocCriada,
      ipOrigem: req.headers.get('x-forwarded-for') || 'desconhecido'
    });
    
    logar(correlationId, 'info', 'Auditoria registrada', { ocId: ocCriada.id });
    
    // 6. Retornar sucesso
    return Response.json(
      sucesso(ocCriada, 'Ordem de Compra criada com sucesso'),
      { status: 201 }
    );
    
  } catch (error) {
    // Erro não esperado já será capturado pelo comErroGlobal
    throw error;
  }
});

export default handler;