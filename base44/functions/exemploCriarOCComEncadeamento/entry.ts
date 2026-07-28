import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import {
  validarFluxoOrdemCompra,
  atualizarStatusEmCascata,
  validarIntegridadeFluxo
} from './_lib/validadorFluxoCompras.js';

/**
 * EXEMPLO: Criar OC a partir de cotação (com validação de encadeamento)
 * 
 * Fluxo:
 * 1. Requisição → Cotação (múltiplos fornecedores)
 * 2. Selecionar cotação → Criar OC
 * 3. OC valida que cotação vem de requisição válida
 * 4. Status atualiza em cascata
 * 5. Auditoria registra encadeamento
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} criando OC`);
    
    // 1. Parse do payload
    const payload = await req.json();
    const { requisicao_id, cotacao_id, obra_id, fornecedor_id, itens, valor_total } = payload;
    
    // 2. Validar encadeamento (requisição → cotação)
    logar(correlationId, 'info', 'Validando fluxo de compras', { requisicao_id, cotacao_id });
    
    let validacao;
    try {
      validacao = await validarFluxoOrdemCompra(base44, requisicao_id, cotacao_id, obra_id);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    const { requisicao, cotacao } = validacao;
    logar(correlationId, 'info', 'Encadeamento validado ✓', {
      requisicaoId: requisicao.id,
      cotacaoId: cotacao.id,
      fornecedorId: cotacao.fornecedor_id
    });
    
    // 3. Criar OC
    const novaOC = {
      numero: `OC-${Date.now()}`,
      requisicao_id,
      cotacao_id,
      obra_id,
      empresa_id: payload.empresa_id || 'padrao',
      fornecedor_id: cotacao.fornecedor_id,
      fornecedor_nome: cotacao.fornecedor,
      valor_total: cotacao.valor_total,
      itens: itens || [],
      status: 'criada',
      status_pagamento: 'nao_pago',
      status_entrega: 'nao_recebido',
      condicoes_pagamento: cotacao.condicoes_pagamento,
      data_emissao: new Date().toISOString().split('T')[0],
      data_prevista_entrega: cotacao.prazo_entrega_dias 
        ? new Date(Date.now() + cotacao.prazo_entrega_dias * 86400000).toISOString().split('T')[0]
        : null
    };
    
    const ocCriada = await base44.entities.OrdemCompra.create(novaOC);
    logar(correlationId, 'info', `OC criada: ${ocCriada.id}`);
    
    // 4. Atualizar status em cascata
    logar(correlationId, 'info', 'Atualizando status em cascata');
    const cascataOk = await atualizarStatusEmCascata(base44, requisicao_id, cotacao_id, ocCriada);
    if (!cascataOk) {
      logar(correlationId, 'warn', 'Cascata de status não completou (não critica)');
    }
    
    // 5. Validar integridade do fluxo
    logar(correlationId, 'info', 'Validando integridade do fluxo');
    const integridade = await validarIntegridadeFluxo(base44, ocCriada.id);
    if (!integridade.ok) {
      logarErro(correlationId, 'INTEGRIDADE_VIOLADA', integridade.erro);
      // Log mas não falha (já foi salvo)
    } else {
      logar(correlationId, 'info', 'Integridade validada ✓');
    }
    
    // 6. Registrar auditoria com encadeamento
    await registrarAuditoria(base44, {
      entidade: 'OrdemCompra',
      entidadeId: ocCriada.id,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'exemploCriarOCComEncadeamento',
      beforeData: null,
      afterData: ocCriada,
      detalhes: {
        encadeamento: {
          requisicao_id,
          cotacao_id,
          encadeamento_validado: true
        }
      },
      ipOrigem: req.headers.get('x-forwarded-for')
    });
    
    logar(correlationId, 'info', 'Operação concluída com sucesso ✓');
    
    // 7. Retornar sucesso com contexto de encadeamento
    return Response.json(
      sucesso(
        {
          oc: ocCriada,
          requisicao: { id: requisicao.id, status: requisicao.status },
          cotacao: { id: cotacao.id, status: cotacao.status },
          encadeamento: true
        },
        'Ordem de Compra criada com sucesso (encadeada)'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;