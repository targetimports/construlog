import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarFaturamento, calcularRetencao } from './_lib/validadorMedicao.js';

/**
 * GERAR FATURAMENTO: medição aprovada → receita
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} gerando faturamento de medição`);
    
    const payload = await req.json();
    const { medicao_id, percentual_retencao = 0, referencia_contrato } = payload;
    
    if (!medicao_id) {
      const { body, status } = erroSeguro('VALIDACAO', 'Medição obrigatória');
      return Response.json(body, { status });
    }
    
    // Buscar medição
    const medicoes = await base44.entities.Medicao.filter({ id: medicao_id });
    if (!medicoes || medicoes.length === 0) {
      const { body, status } = erroSeguro('RECURSO_NAO_ENCONTRADO', 'Medição não encontrada');
      return Response.json(body, { status });
    }
    
    const medicao = medicoes[0];
    
    try {
      validarFaturamento(medicao);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // Calcular retenção
    const { retencao, liquido } = calcularRetencao(medicao.valor_total_realizado, percentual_retencao);
    
    // Criar receita
    const receita = {
      obra_id: medicao.obra_id,
      tipo: 'medicao',
      descricao: `Faturamento Medição ${medicao.numero}`,
      valor_bruto: medicao.valor_total_realizado,
      retencoes_percentual: percentual_retencao,
      valor_retencoes: retencao,
      valor_liquido: liquido,
      data_emissao: new Date().toISOString().split('T')[0],
      status: 'faturada',
      medicao_id,
      referencia_contrato: referencia_contrato || null
    };
    
    const receitaCriada = await base44.entities.ReceitaObra.create(receita);
    logar(correlationId, 'info', `Receita criada: ${receitaCriada.id}`);
    
    // Atualizar medição com receita
    await base44.asServiceRole.entities.Medicao.update(medicao_id, {
      ...medicao,
      status: 'faturada',
      receita_id: receitaCriada.id,
      valor_liquido: liquido,
      retencoes_percentual: percentual_retencao
    });
    
    logar(correlationId, 'info', 'Medição vinculada a receita ✓');
    
    // Criar conta a receber (se necessário)
    const contaReceber = {
      tipo: 'receber',
      descricao: `Conta a Receber - ${medicao.numero}`,
      valor: liquido,
      valor_recebido: 0,
      data_vencimento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'pendente',
      obra_id: medicao.obra_id,
      categoria: 'medicao',
      forma_pagamento: 'transferencia',
      referencia_tipo: 'medicao',
      referencia_id: medicao_id,
      observacao: `Conta gerada automaticamente da medição ${medicao.numero}`
    };
    
    const contaCriada = await base44.entities.ContaFinanceira.create(contaReceber);
    logar(correlationId, 'info', `Conta a receber criada: ${contaCriada.id}`);
    
    // Atualizar receita com conta
    await base44.asServiceRole.entities.ReceitaObra.update(receitaCriada.id, {
      conta_receber_id: contaCriada.id
    });
    
    // Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'ReceitaObra',
      entidadeId: receitaCriada.id,
      operacao: 'criar',
      obraId: medicao.obra_id,
      usuarioId: user.email,
      funcao: 'gerarFaturamentoMedicao',
      beforeData: null,
      afterData: receitaCriada,
      detalhes: {
        medicao_id,
        valor_bruto: medicao.valor_total_realizado,
        retencoes_percentual,
        valor_retencoes: retencao,
        valor_liquido: liquido,
        conta_receber_id: contaCriada.id
      }
    });
    
    return Response.json(
      sucesso(
        {
          medicao: {
            id: medicao_id,
            status: 'faturada',
            receita_id: receitaCriada.id
          },
          receita: receitaCriada,
          conta_receber: contaCriada,
          valores: {
            bruto: medicao.valor_total_realizado,
            retencoes: retencao,
            liquido
          }
        },
        'Faturamento gerado com sucesso'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;