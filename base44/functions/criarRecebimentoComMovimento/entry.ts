import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarRecebimento, atualizarSaldoEstoqueObra } from './_lib/validadorEstoque.js';

/**
 * RECEBER MATERIAL: OC → RecebimentoMaterial + MovimentacaoEstoque(ENTRADA)
 * 
 * 1. Valida OC status e itens
 * 2. Cria RecebimentoMaterial
 * 3. Para cada item: cria MovimentacaoEstoque(ENTRADA) no depósito
 * 4. Atualiza saldo do EstoqueObra
 * 5. Registra auditoria
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} recebendo material`);
    
    // 1. Parse payload
    const payload = await req.json();
    const { ordem_compra_id, almoxarifado_id, obra_id, itens_recebidos } = payload;
    
    if (!ordem_compra_id || !almoxarifado_id) {
      const { body, status } = erroSeguro('VALIDACAO', 'OC e almoxarifado obrigatórios');
      return Response.json(body, { status });
    }
    
    // 2. Buscar OC
    const ocs = await base44.entities.OrdemCompra.filter({ id: ordem_compra_id });
    if (!ocs || ocs.length === 0) {
      const { body, status } = erroSeguro('RECURSO_NAO_ENCONTRADO', 'OC não encontrada');
      return Response.json(body, { status });
    }
    
    const oc = ocs[0];
    logar(correlationId, 'info', 'OC encontrada', { numero: oc.numero, status: oc.status });
    
    // 3. Validar OC
    try {
      validarRecebimento(oc);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // 4. Buscar almoxarifado
    const almoxs = await base44.entities.Deposito.filter({ id: almoxarifado_id });
    if (!almoxs || almoxs.length === 0) {
      const { body, status } = erroSeguro('RECURSO_NAO_ENCONTRADO', 'Almoxarifado não encontrado');
      return Response.json(body, { status });
    }
    
    const almoxarifado = almoxs[0];
    logar(correlationId, 'info', 'Almoxarifado validado', { nome: almoxarifado.nome });
    
    // 5. Criar RecebimentoMaterial
    const recebimento = {
      ordem_compra_id,
      numero_oc: oc.numero,
      obra_id: oc.obra_id,
      almoxarifado_id,
      fornecedor_id: oc.fornecedor_id,
      fornecedor_nome: oc.fornecedor_nome,
      itens: itens_recebidos || oc.itens,
      data_recebimento: new Date().toISOString(),
      responsavel_almoxarife: user.email,
      status_recebimento: 'total'
    };
    
    const recebimentoCriado = await base44.entities.RecebimentoMaterial.create(recebimento);
    logar(correlationId, 'info', `Recebimento criado: ${recebimentoCriado.id}`);
    
    // 6. Para cada item: criar MovimentacaoEstoque(ENTRADA) + atualizar saldo
    let movimentos = [];
    for (const item of (itens_recebidos || oc.itens)) {
      const movimento = {
        data: new Date().toISOString(),
        tipo: 'entrada',
        insumo_id: item.insumo_id,
        codigo_insumo: item.codigo || '',
        descricao_insumo: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade_recebida || item.quantidade_solicitada,
        valor_unitario: item.valor_unitario,
        valor_total: (item.quantidade_recebida || item.quantidade_solicitada) * item.valor_unitario,
        deposito_origem_id: null,
        deposito_destino_id: almoxarifado_id,
        obra_id: oc.obra_id,
        referencia_tipo: 'recebimento',
        referencia_id: recebimentoCriado.id,
        usuario_id: user.email,
        observacao: `Recebimento de OC ${oc.numero}`
      };
      
      const movimentoCriada = await base44.entities.MovimentacaoEstoque.create(movimento);
      movimentos.push(movimentoCriada);
      
      logar(correlationId, 'info', `Movimento ENTRADA criado para insumo ${item.insumo_id}`);
      
      // Atualizar saldo EstoqueObra (se for desviar p/ obra)
      // Por enquanto, só registra movimento no depósito central
    }
    
    // 7. Atualizar status da OC
    await base44.asServiceRole.entities.OrdemCompra.update(ordem_compra_id, {
      status_entrega: 'recebido_total',
      status: 'recebida'
    });
    
    logar(correlationId, 'info', 'OC atualizada para status recebida');
    
    // 8. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'RecebimentoMaterial',
      entidadeId: recebimentoCriado.id,
      operacao: 'criar',
      obraId: oc.obra_id,
      usuarioId: user.email,
      funcao: 'criarRecebimentoComMovimento',
      beforeData: null,
      afterData: recebimentoCriado,
      detalhes: {
        oc_id: oc.id,
        movimentos_criados: movimentos.length
      }
    });
    
    logar(correlationId, 'info', 'Auditoria registrada ✓');
    
    return Response.json(
      sucesso(
        {
          recebimento: recebimentoCriado,
          movimentos,
          oc_atualizada: { id: oc.id, status: 'recebida' }
        },
        'Material recebido com sucesso'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;