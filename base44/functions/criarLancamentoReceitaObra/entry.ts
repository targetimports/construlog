import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarLancamentoReceita, calcularMesReferencia } from './_lib/validadorDRE.js';

/**
 * LANÇAR RECEITA: registra movimentação de receita na DRE da obra
 * 
 * Chamado automaticamente por:
 * - ReceitaObra (medição/faturamento)
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `Criando lançamento de receita`);
    
    const payload = await req.json();
    const {
      obra_id,
      origem_tipo,
      origem_id,
      descricao,
      valor_bruto,
      retencoes_percentual = 0,
      medicao_id,
      cliente_id
    } = payload;
    
    // Calcular retenção
    const valor_retencoes = valor_bruto * (retencoes_percentual / 100);
    const valor_liquido = valor_bruto - valor_retencoes;
    
    const lancamento = {
      obra_id,
      origem_tipo,
      origem_id,
      descricao: descricao || `Receita ${origem_tipo}`,
      valor_bruto,
      retencoes_percentual,
      valor_retencoes,
      valor_liquido,
      medicao_id,
      cliente_id,
      data_lancamento: new Date().toISOString(),
      mes_referencia: calcularMesReferencia(new Date()),
      status: 'previsto'
    };
    
    // Validar
    try {
      validarLancamentoReceita(lancamento);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // Criar lançamento
    const lancamentoCriado = await base44.entities.LancamentoReceitaObra.create(lancamento);
    logar(correlationId, 'info', `Lançamento receita criado: ${lancamentoCriado.id}`, {
      valor_bruto,
      valor_liquido
    });
    
    // Auditoria
    await registrarAuditoria(base44, {
      entidade: 'LancamentoReceitaObra',
      entidadeId: lancamentoCriado.id,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'criarLancamentoReceitaObra',
      detalhes: {
        origem: origem_tipo,
        origem_id,
        valor_bruto,
        retencoes: valor_retencoes,
        valor_liquido,
        mes: lancamento.mes_referencia
      }
    });
    
    return Response.json(
      sucesso(
        { lancamento: lancamentoCriado },
        'Lançamento de receita registrado'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;