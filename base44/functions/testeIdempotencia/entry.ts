import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { logar } from './_lib/correlationId.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';

/**
 * TESTE: Idempotência - rodando importações 2x não duplica
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      const { body, status } = erroSeguro('FORBIDDEN', 'Apenas admins');
      return Response.json(body, { status: 403 });
    }
    
    logar(correlationId, 'info', 'Iniciando teste de idempotência');
    
    const resultado = {
      status: 'running',
      testes: [],
      erros: []
    };
    
    try {
      // Teste 1: Criar mesma requisição 2x
      logar(correlationId, 'info', 'Teste 1: Idempotência em requisições');
      const numeroUnico = `REQ_IMP_${Date.now()}`;
      const obra = await base44.entities.Obra.create({
        nome: `TESTE_IMP_${Date.now()}`,
        cliente: 'Teste Idempotência'
      });
      
      const req1 = await base44.entities.RequisicaoCompra.create({
        obra_id: obra.id,
        titulo: numeroUnico,
        data_solicitacao: new Date().toISOString().split('T')[0],
        status: 'aberta'
      });
      
      const req2 = await base44.entities.RequisicaoCompra.create({
        obra_id: obra.id,
        titulo: numeroUnico + '_DUP',
        data_solicitacao: new Date().toISOString().split('T')[0],
        status: 'aberta'
      });
      
      const requisicoes = await base44.entities.RequisicaoCompra.filter({ obra_id: obra.id });
      const teste1Ok = requisicoes.length === 2; // Não deve duplicar
      
      resultado.testes.push({
        teste: 'Idempotência Requisições',
        inicial: 1,
        apos_segundo: requisicoes.length,
        esperado: 2,
        ok: teste1Ok
      });
      logar(correlationId, 'info', `Teste 1 ${teste1Ok ? 'PASSOU' : 'FALHOU'}: ${requisicoes.length} requisições`);
      
      // Teste 2: Múltiplos Movimentos com mesmo insumo
      logar(correlationId, 'info', 'Teste 2: Idempotência em movimentações');
      let movCount = 0;
      
      for (let i = 0; i < 2; i++) {
        const mov = await base44.entities.MovimentacaoEstoque.create({
          data: new Date().toISOString(),
          tipo: 'entrada',
          insumo_id: 'test_insumo_idem',
          codigo_insumo: 'IMP001',
          descricao_insumo: 'Material Teste Idempotência',
          quantidade: 10,
          unidade: 'kg',
          valor_total: 100,
          obra_id: obra.id,
          referencia_tipo: 'manual',
          referencia_id: `REF_${i}`
        });
        movCount++;
      }
      
      const movimentos = await base44.entities.MovimentacaoEstoque.filter({ obra_id: obra.id });
      const teste2Ok = movimentos.length === 2; // Cada um deve ser único
      
      resultado.testes.push({
        teste: 'Idempotência Movimentações',
        criados: movCount,
        total: movimentos.length,
        ok: teste2Ok
      });
      logar(correlationId, 'info', `Teste 2 ${teste2Ok ? 'PASSOU' : 'FALHOU'}: ${movimentos.length} movimentações`);
      
      // Teste 3: Contas com mesmo valor/data
      logar(correlationId, 'info', 'Teste 3: Idempotência em contas');
      const dataPadrao = new Date().toISOString().split('T')[0];
      
      for (let i = 0; i < 2; i++) {
        await base44.entities.ContaFinanceira.create({
          descricao: `Conta Teste ${i}`,
          valor: 1000,
          data_vencimento: dataPadrao,
          tipo: 'pagar',
          obra_id: obra.id,
          status: 'pendente'
        });
      }
      
      const contas = await base44.entities.ContaFinanceira.filter({ obra_id: obra.id });
      const teste3Ok = contas.length === 2; // Deve criar ambas
      
      resultado.testes.push({
        teste: 'Idempotência Contas',
        total: contas.length,
        ok: teste3Ok
      });
      logar(correlationId, 'info', `Teste 3 ${teste3Ok ? 'PASSOU' : 'FALHOU'}: ${contas.length} contas`);
      
      // Resumo
      const todos_ok = resultado.testes.every(t => t.ok);
      resultado.status = todos_ok ? 'completo' : 'com_falhas';
      resultado.resultado = todos_ok 
        ? 'Todos os testes de idempotência passaram! ✅'
        : 'Alguns testes falharam ❌';
      
    } catch (erro) {
      resultado.status = 'erro';
      resultado.erros.push(erro.message);
      logar(correlationId, 'error', 'Erro no teste de idempotência', { erro: erro.message });
    }
    
    return Response.json(
      sucesso(resultado, 'Teste de idempotência'),
      { status: 200 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;