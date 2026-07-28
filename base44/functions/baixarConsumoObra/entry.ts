import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarBaixaObra, atualizarSaldoEstoqueObra } from './_lib/validadorEstoque.js';

/**
 * BAIXAR CONSUMO: Estoque Obra → Reduz saldo + Registra custo
 * 
 * Cria MovimentacaoEstoque(BAIXA_OBRA) e atualiza saldo
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} baixando consumo de obra`);
    
    // 1. Parse payload
    const payload = await req.json();
    const { obra_id, centro_custo_id, itens, referencia_tipo, referencia_id } = payload;
    
    // 2. Validar
    try {
      await validarBaixaObra(base44, obra_id, itens, centro_custo_id);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    logar(correlationId, 'info', 'Validação OK', { itens: itens.length });
    
    // 3. Criar movimentos BAIXA_OBRA
    let movimentos = [];
    let totalValor = 0;
    
    for (const item of itens) {
      const movimento = {
        data: new Date().toISOString(),
        tipo: 'baixa_obra',
        insumo_id: item.insumo_id,
        descricao_insumo: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.quantidade * (item.valor_unitario || 0),
        obra_id,
        centro_custo_id,
        referencia_tipo: referencia_tipo || 'manual',
        referencia_id: referencia_id || `baixa_${Date.now()}`,
        usuario_id: user.email,
        observacao: item.observacao || 'Consumo de obra'
      };
      
      const movimentoCriada = await base44.entities.MovimentacaoEstoque.create(movimento);
      movimentos.push(movimentoCriada);
      totalValor += movimento.valor_total;
      
      // Reduzir saldo EstoqueObra
      await atualizarSaldoEstoqueObra(base44, obra_id, item.insumo_id, -item.quantidade, 0);
      
      logar(correlationId, 'info', `Baixa criada para ${item.insumo_id}`, {
        quantidade: item.quantidade,
        valor: movimento.valor_total
      });
    }
    
    // 4. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'MovimentacaoEstoque',
      entidadeId: `baixa_${Date.now()}`,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'baixarConsumoObra',
      detalhes: {
        centro_custo_id,
        itens_baixados: itens.length,
        valor_total: totalValor,
        referencia: {
          tipo: referencia_tipo || 'manual',
          id: referencia_id || null
        }
      }
    });
    
    logar(correlationId, 'info', 'Auditoria registrada ✓');
    
    return Response.json(
      sucesso(
        {
          movimentos,
          itens_baixados: itens.length,
          valor_total: totalValor
        },
        'Consumo baixado com sucesso'
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;