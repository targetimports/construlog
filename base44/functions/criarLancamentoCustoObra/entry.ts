import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarLancamentoCusto, calcularMesReferencia } from './_lib/validadorDRE.js';

/**
 * LANÇAR CUSTO: registra movimentação de custo na DRE da obra
 * 
 * Chamado automaticamente por:
 * - MovimentacaoEstoque (BAIXA_OBRA)
 * - NotaFiscal/ContaPagar (recebimento)
 * - Apontamentos (mão de obra)
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `Criando lançamento de custo`);
    
    const payload = await req.json();
    const {
      obra_id,
      origem_tipo,
      origem_id,
      centro_custo_id,
      categoria,
      descricao,
      valor,
      insumo_id,
      fornecedor_id,
      referencia_numero
    } = payload;
    
    const lancamento = {
      obra_id,
      origem_tipo,
      origem_id,
      centro_custo_id,
      categoria,
      descricao: descricao || `Lançamento ${origem_tipo}`,
      valor,
      insumo_id,
      fornecedor_id,
      referencia_numero,
      data_lancamento: new Date().toISOString(),
      mes_referencia: calcularMesReferencia(new Date()),
      status: 'lançado'
    };
    
    // Validar
    try {
      validarLancamentoCusto(lancamento);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // Criar lançamento
    const lancamentoCriado = await base44.entities.LancamentoCustoObra.create(lancamento);
    logar(correlationId, 'info', `Lançamento custo criado: ${lancamentoCriado.id}`, { valor });
    
    // Auditoria
    await registrarAuditoria(base44, {
      entidade: 'LancamentoCustoObra',
      entidadeId: lancamentoCriado.id,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'criarLancamentoCustoObra',
      detalhes: {
        origem: origem_tipo,
        origem_id,
        valor,
        centro_custo: centro_custo_id,
        mes: lancamento.mes_referencia
      }
    });
    
    return Response.json(
      sucesso(
        { lancamento: lancamentoCriado },
        'Lançamento de custo registrado'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;