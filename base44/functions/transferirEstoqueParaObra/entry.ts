import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarTransferencia, atualizarSaldoEstoqueObra } from './_lib/validadorEstoque.js';

/**
 * TRANSFERIR PARA OBRA: Depósito Central → Depósito Obra
 * 
 * Cria:
 *   - MovimentacaoEstoque(TRANSF_SAIDA) no depósito origem
 *   - MovimentacaoEstoque(TRANSF_ENTRADA) na obra destino
 *   - Atualiza saldos em ambos os lados
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} transferindo material para obra`);
    
    // 1. Parse payload
    const payload = await req.json();
    const { deposito_origem_id, obra_id, deposito_obra_id, itens } = payload;
    
    if (!deposito_origem_id || !obra_id) {
      const { body, status } = erroSeguro('VALIDACAO', 'Depósito origem e obra obrigatórios');
      return Response.json(body, { status });
    }
    
    // 2. Validar depósitos
    const [dep_origem, dep_obra] = await Promise.all([
      base44.entities.Deposito.filter({ id: deposito_origem_id }),
      deposito_obra_id 
        ? base44.entities.Deposito.filter({ id: deposito_obra_id })
        : Promise.resolve(null)
    ]);
    
    if (!dep_origem || dep_origem.length === 0) {
      const { body, status } = erroSeguro('RECURSO_NAO_ENCONTRADO', 'Depósito origem não encontrado');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', 'Depósitos validados', {
      origem: dep_origem[0].nome,
      obra: obra_id
    });
    
    // 3. Validar transferência
    try {
      await validarTransferencia(base44, dep_origem[0], itens);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // 4. Criar movimentos de saída + entrada
    let movimentosSaida = [];
    let movimentosEntrada = [];
    
    for (const item of itens) {
      // SAÍDA do depósito central
      const movSaida = {
        data: new Date().toISOString(),
        tipo: 'transf_saida',
        insumo_id: item.insumo_id,
        descricao_insumo: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.quantidade * (item.valor_unitario || 0),
        deposito_origem_id,
        deposito_destino_id: deposito_obra_id || 'obra',
        obra_id,
        referencia_tipo: 'transferencia',
        usuario_id: user.email,
        observacao: `Transferência para obra ${obra_id}`
      };
      
      const movSaidaCriada = await base44.entities.MovimentacaoEstoque.create(movSaida);
      movimentosSaida.push(movSaidaCriada);
      
      // ENTRADA na obra
      const movEntrada = {
        data: new Date().toISOString(),
        tipo: 'transf_entrada',
        insumo_id: item.insumo_id,
        descricao_insumo: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.quantidade * (item.valor_unitario || 0),
        deposito_origem_id,
        deposito_destino_id: deposito_obra_id || obra_id,
        obra_id,
        referencia_tipo: 'transferencia',
        referencia_id: movSaidaCriada.id,
        usuario_id: user.email,
        observacao: `Recebimento de transferência de ${dep_origem[0].nome}`
      };
      
      const movEntradaCriada = await base44.entities.MovimentacaoEstoque.create(movEntrada);
      movimentosEntrada.push(movEntradaCriada);
      
      // Atualizar saldo da obra
      await atualizarSaldoEstoqueObra(
        base44,
        obra_id,
        item.insumo_id,
        item.quantidade,
        item.valor_unitario || 0
      );
      
      logar(correlationId, 'info', `Transferência SAIDA+ENTRADA criada para ${item.insumo_id}`);
    }
    
    // 5. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'TransferenciaEstoque',
      entidadeId: `transf_${Date.now()}`,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'transferirEstoqueParaObra',
      detalhes: {
        deposito_origem: dep_origem[0].id,
        itens_transferidos: itens.length,
        movimentos_saida: movimentosSaida.length,
        movimentos_entrada: movimentosEntrada.length
      }
    });
    
    logar(correlationId, 'info', 'Auditoria registrada ✓');
    
    return Response.json(
      sucesso(
        {
          movimentos_saida: movimentosSaida,
          movimentos_entrada: movimentosEntrada,
          itens_transferidos: itens.length
        },
        'Material transferido para obra com sucesso'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;