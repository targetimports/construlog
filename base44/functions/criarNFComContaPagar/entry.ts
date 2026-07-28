import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarGerContaPagar, validarDivergenciaNFOC } from './_lib/validadorFinanceiro.js';

/**
 * CRIAR NF + GERAR CONTA A PAGAR AUTOMÁTICA
 * 
 * 1. Cria NotaFiscal
 * 2. Valida estrutura e obra
 * 3. Busca OC vinculada (se houver) e verifica divergência
 * 4. Cria ContaFinanceira automaticamente
 * 5. Vincula NF → ContaPagar
 * 6. Registra auditoria
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} criando NF`);
    
    // 1. Parse payload
    const payload = await req.json();
    const {
      numero_nf,
      data,
      obra_id,
      fornecedor_id,
      fornecedor_nome,
      valor_bruto,
      valor_liquido,
      categoria,
      referencia_vinculo,
      dias_vencimento = 30
    } = payload;
    
    if (!numero_nf || !obra_id || !fornecedor_id || !valor_bruto) {
      const { body, status } = erroSeguro('VALIDACAO', 'Campos obrigatórios faltando');
      return Response.json(body, { status });
    }
    
    // 2. Criar NF
    const nfData = {
      numero_nf,
      data: data || new Date().toISOString().split('T')[0],
      obra_id,
      fornecedor_id,
      valor_bruto,
      valor_liquido: valor_liquido || valor_bruto,
      categoria,
      descricao: payload.descricao || `NF ${numero_nf}`,
      status: 'registrada',
      vinculado_a: referencia_vinculo ? 'ordem_compra' : 'generico',
      referencia_vinculo: referencia_vinculo || null
    };
    
    const nfCriada = await base44.entities.NotaFiscal.create(nfData);
    logar(correlationId, 'info', `NF criada: ${nfCriada.id}`, { numero: numero_nf });
    
    // 3. Validar NF e autorizar conta a pagar
    try {
      await validarGerContaPagar(base44, nfCriada);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // 4. Verificar divergência com OC (se vinculada)
    let divergencias = null;
    if (referencia_vinculo) {
      divergencias = await validarDivergenciaNFOC(base44, nfCriada, referencia_vinculo);
      if (divergencias) {
        logar(correlationId, 'warn', 'Divergências encontradas', divergencias);
      }
    }
    
    // 5. Calcular data de vencimento
    const dataNF = new Date(nfCriada.data);
    const dataVencimento = new Date(dataNF);
    dataVencimento.setDate(dataVencimento.getDate() + dias_vencimento);
    
    // 6. Criar ContaPagar
    const contaData = {
      tipo: 'pagar',
      descricao: `Conta referente à NF ${numero_nf}`,
      valor: nfCriada.valor_liquido,
      valor_pago: 0,
      data_vencimento: dataVencimento.toISOString().split('T')[0],
      status: 'pendente',
      obra_id,
      categoria: categoria || 'outros',
      fornecedor_cliente: fornecedor_nome || `Fornecedor ${fornecedor_id}`,
      fornecedor_id,
      forma_pagamento: payload.forma_pagamento || 'transferencia',
      nota_fiscal: numero_nf,
      referencia_tipo: 'nota_fiscal',
      referencia_id: nfCriada.id,
      centro_custo_id: payload.centro_custo_id || null,
      observacao: `Gerada automaticamente a partir de NF ${numero_nf}`
    };
    
    const contaCriada = await base44.entities.ContaFinanceira.create(contaData);
    logar(correlationId, 'info', `Conta a pagar criada: ${contaCriada.id}`);
    
    // 7. Vincular NF → ContaPagar
    await base44.asServiceRole.entities.NotaFiscal.update(nfCriada.id, {
      conta_pagar_id: contaCriada.id
    });
    
    logar(correlationId, 'info', 'NF vinculada a conta a pagar ✓');
    
    // 8. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'NotaFiscal',
      entidadeId: nfCriada.id,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'criarNFComContaPagar',
      beforeData: null,
      afterData: nfCriada,
      detalhes: {
        nf_numero: numero_nf,
        conta_pagar_id: contaCriada.id,
        valor: nfCriada.valor_liquido,
        vencimento: contaCriada.data_vencimento,
        divergencias
      }
    });
    
    logar(correlationId, 'info', 'Auditoria registrada ✓');
    
    return Response.json(
      sucesso(
        {
          nf: nfCriada,
          conta_pagar: contaCriada,
          divergencias,
          status: 'nf_registrada_conta_criada'
        },
        'NF criada e conta a pagar gerada automaticamente'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;