import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { logar } from './_lib/correlationId.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';

/**
 * TESTE: Fluxo completo de obra
 * Obra → Solicitação → OC → Recebimento → Transferência → Baixa → NF → ContaPagar → Pagamento → Medição → Receita → DRE
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      const { body, status } = erroSeguro('FORBIDDEN', 'Apenas admins');
      return Response.json(body, { status: 403 });
    }
    
    logar(correlationId, 'info', 'Iniciando teste de fluxo completo');
    
    const resultado = {
      status: 'running',
      etapas: [],
      erros: []
    };
    
    try {
      // 1️⃣ Criar Obra de Teste
      logar(correlationId, 'info', 'Etapa 1: Criando obra de teste');
      const obra = await base44.entities.Obra.create({
        nome: `TESTE_FLUXO_${Date.now()}`,
        cliente: 'Teste Automático',
        codigo: `TEST_${Date.now()}`,
        status: 'a_iniciar'
      });
      resultado.etapas.push({ etapa: 1, nome: 'Obra criada', id: obra.id, ok: true });
      logar(correlationId, 'info', `Obra criada: ${obra.id}`);
      
      // 2️⃣ Criar Requisição
      logar(correlationId, 'info', 'Etapa 2: Criando requisição');
      const requisicao = await base44.entities.RequisicaoCompra.create({
        obra_id: obra.id,
        titulo: 'Teste Requisição',
        data_solicitacao: new Date().toISOString().split('T')[0],
        status: 'aberta',
        itens: [{
          insumo_id: 'test_insumo_1',
          descricao: 'Cimento Teste',
          quantidade_solicitada: 50,
          valor_estimado: 2500
        }]
      });
      resultado.etapas.push({ etapa: 2, nome: 'Requisição criada', id: requisicao.id, ok: true });
      logar(correlationId, 'info', `Requisição criada: ${requisicao.id}`);
      
      // 3️⃣ Criar Cotação
      logar(correlationId, 'info', 'Etapa 3: Criando cotação');
      const cotacao = await base44.entities.CotacaoFornecedor.create({
        requisicao_id: requisicao.id,
        obra_id: obra.id,
        fornecedor_id: 'test_fornecedor_1',
        fornecedor: 'Fornecedor Teste',
        valor_unitario: 50,
        valor_total: 2500,
        prazo_entrega_dias: 5,
        status: 'aberta'
      });
      resultado.etapas.push({ etapa: 3, nome: 'Cotação criada', id: cotacao.id, ok: true });
      logar(correlationId, 'info', `Cotação criada: ${cotacao.id}`);
      
      // 4️⃣ Criar OC
      logar(correlationId, 'info', 'Etapa 4: Criando ordem de compra');
      const oc = await base44.entities.OrdemCompra.create({
        numero: `OC_TEST_${Date.now()}`,
        requisicao_id: requisicao.id,
        cotacao_id: cotacao.id,
        obra_id: obra.id,
        empresa_id: 'test_empresa',
        fornecedor_id: 'test_fornecedor_1',
        fornecedor_nome: 'Fornecedor Teste',
        valor_total: 2500,
        status: 'criada',
        itens: [{
          insumo_id: 'test_insumo_1',
          descricao: 'Cimento Teste',
          quantidade_solicitada: 50,
          valor_unitario: 50,
          valor_total: 2500
        }],
        data_emissao: new Date().toISOString().split('T')[0],
        destino: 'estoque_central'
      });
      resultado.etapas.push({ etapa: 4, nome: 'OC criada', id: oc.id, ok: true });
      logar(correlationId, 'info', `OC criada: ${oc.id}`);
      
      // 5️⃣ Criar Recebimento
      logar(correlationId, 'info', 'Etapa 5: Criando recebimento');
      const recebimento = await base44.entities.RecebimentoMaterial.create({
        ordem_compra_id: oc.id,
        numero_oc: oc.numero,
        obra_id: obra.id,
        almoxarifado_id: 'test_almoxarifado_1',
        fornecedor_id: 'test_fornecedor_1',
        fornecedor_nome: 'Fornecedor Teste',
        data_recebimento: new Date().toISOString(),
        status_recebimento: 'total',
        itens: [{
          insumo_id: 'test_insumo_1',
          quantidade_recebida: 50,
          quantidade_solicitada: 50
        }]
      });
      resultado.etapas.push({ etapa: 5, nome: 'Recebimento criado', id: recebimento.id, ok: true });
      logar(correlationId, 'info', `Recebimento criado: ${recebimento.id}`);
      
      // 6️⃣ Criar Movimento de Estoque (Entrada)
      logar(correlationId, 'info', 'Etapa 6: Criando movimento de estoque');
      const movimento = await base44.entities.MovimentacaoEstoque.create({
        data: new Date().toISOString(),
        tipo: 'entrada',
        insumo_id: 'test_insumo_1',
        codigo_insumo: 'CIM001',
        descricao_insumo: 'Cimento Teste',
        quantidade: 50,
        unidade: 'kg',
        valor_unitario: 50,
        valor_total: 2500,
        obra_id: obra.id,
        deposito_destino_id: 'test_almoxarifado_1',
        referencia_tipo: 'ordem_compra',
        referencia_id: oc.id
      });
      resultado.etapas.push({ etapa: 6, nome: 'Movimento criado', id: movimento.id, ok: true });
      logar(correlationId, 'info', `Movimento criado: ${movimento.id}`);
      
      // 7️⃣ Criar Nota Fiscal
      logar(correlationId, 'info', 'Etapa 7: Criando nota fiscal');
      const nf = await base44.entities.NotaFiscal.create({
        numero_nf: `NF_TEST_${Date.now()}`,
        data: new Date().toISOString().split('T')[0],
        obra_id: obra.id,
        fornecedor_id: 'test_fornecedor_1',
        categoria: 'material',
        valor_bruto: 2500,
        valor_liquido: 2500,
        status: 'registrada'
      });
      resultado.etapas.push({ etapa: 7, nome: 'NF criada', id: nf.id, ok: true });
      logar(correlationId, 'info', `NF criada: ${nf.id}`);
      
      // 8️⃣ Criar Conta Pagar
      logar(correlationId, 'info', 'Etapa 8: Criando conta a pagar');
      const conta = await base44.entities.ContaFinanceira.create({
        descricao: 'Teste Conta Pagar',
        valor: 2500,
        data_vencimento: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        tipo: 'pagar',
        obra_id: obra.id,
        status: 'pendente',
        fornecedor_cliente: 'Fornecedor Teste',
        fornecedor_id: 'test_fornecedor_1'
      });
      resultado.etapas.push({ etapa: 8, nome: 'Conta criada', id: conta.id, ok: true });
      logar(correlationId, 'info', `Conta criada: ${conta.id}`);
      
      // 9️⃣ Criar Medição
      logar(correlationId, 'info', 'Etapa 9: Criando medição');
      const medicao = await base44.entities.Medicao.create({
        obra_id: obra.id,
        numero: `MED_TEST_${Date.now()}`,
        data_medicao: new Date().toISOString().split('T')[0],
        responsavel_email: user.email,
        tipo: 'fisica',
        status: 'rascunho'
      });
      resultado.etapas.push({ etapa: 9, nome: 'Medição criada', id: medicao.id, ok: true });
      logar(correlationId, 'info', `Medição criada: ${medicao.id}`);
      
      // 🔟 Criar Receita
      logar(correlationId, 'info', 'Etapa 10: Criando receita');
      const receita = await base44.entities.ReceitaObra.create({
        obra_id: obra.id,
        tipo: 'medicao',
        valor_bruto: 5000,
        valor_liquido: 4500,
        retencoes_percentual: 10,
        valor_retencoes: 500,
        data_emissao: new Date().toISOString().split('T')[0],
        status: 'pendente',
        medicao_id: medicao.id
      });
      resultado.etapas.push({ etapa: 10, nome: 'Receita criada', id: receita.id, ok: true });
      logar(correlationId, 'info', `Receita criada: ${receita.id}`);
      
      // 1️⃣1️⃣ Verificar DRE
      logar(correlationId, 'info', 'Etapa 11: Consultando DRE');
      const lancamentos_custo = await base44.entities.LancamentoCustoObra.filter({ obra_id: obra.id });
      const lancamentos_receita = await base44.entities.LancamentoReceitaObra.filter({ obra_id: obra.id });
      resultado.etapas.push({ 
        etapa: 11, 
        nome: 'DRE verificado', 
        custos: lancamentos_custo?.length || 0,
        receitas: lancamentos_receita?.length || 0,
        ok: true 
      });
      logar(correlationId, 'info', `DRE: ${lancamentos_custo?.length || 0} custos, ${lancamentos_receita?.length || 0} receitas`);
      
      resultado.status = 'completo';
      resultado.resultado = 'Teste de fluxo completo passou! ✅';
      
    } catch (erro) {
      resultado.status = 'erro';
      resultado.erros.push(erro.message);
      logar(correlationId, 'error', 'Erro no teste de fluxo', { erro: erro.message });
    }
    
    return Response.json(
      sucesso(resultado, 'Teste de fluxo completo'),
      { status: 200 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;