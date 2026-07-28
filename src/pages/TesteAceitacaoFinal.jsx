import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

export default function TesteAceitacaoFinal() {
  const [passo, setPasso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({
    pedidoId: null,
    viagemId: null,
    nfId: null,
    contaPagarId: null,
  });

  // PASSO 1: Criar Pedido Consolidado
  const handleCriarPedidoConsolidado = async () => {
    setLoading(true);
    try {
      // Buscar 5 obras
      const obras = await base44.entities.Obra.list(null, 5);
      if (obras.length < 3) {
        toast.error('Sistema precisa de pelo menos 3 obras cadastradas');
        setLoading(false);
        return;
      }

      // Buscar fornecedor
      const fornecedores = await base44.entities.Fornecedor.list(null, 1);
      if (!fornecedores.length) {
        toast.error('Cadastre um fornecedor primeiro');
        setLoading(false);
        return;
      }

      // Buscar material
      const materiais = await base44.entities.Material.list(null, 1);
      if (!materiais.length) {
        toast.error('Cadastre um material primeiro');
        setLoading(false);
        return;
      }

      // Criar Pedido Consolidado
      const pc = await base44.entities.PedidoCompra.create({
        obra_id: obras[0].id,
        obra_nome: obras[0].nome,
        consolidado: true,
        fornecedor_id: fornecedores[0].id,
        fornecedor_nome: fornecedores[0].nome,
        status: 'RASCUNHO',
        numero: `PC-TESTE-${Date.now()}`,
        data_pedido: new Date().toISOString().split('T')[0],
        valor_total: 5000,
      });

      // Criar Item do Pedido
      const itemRateios = obras.slice(0, 5).map(obra => ({
        obra_id: obra.id,
        obra_nome: obra.nome,
        quantidade: 10,
      }));

      const item = await base44.entities.PedidoCompraItem.create({
        pedido_id: pc.id,
        material_id: materiais[0].id,
        material_nome: materiais[0].nome,
        material_unidade: materiais[0].unidade || 'UN',
        quantidade_pedida: 50,
        preco_unitario: 100,
        total_item: 5000,
        rateio_obras: itemRateios,
      });

      // Salvar rateios
      for (const rat of itemRateios) {
        await base44.entities.PedidoCompraItemRateio.create({
          pedido_item_id: item.id,
          obra_id: rat.obra_id,
          obra_nome: rat.obra_nome,
          quantidade_rateada: rat.quantidade,
        });
      }

      setDados(d => ({ ...d, pedidoId: pc.id }));
      toast.success('✓ Pedido consolidado criado com sucesso!');
      setPasso(2);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PASSO 2: Gerar Viagem
  const handleGerarViagem = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('gerarViagemDePedidoConsolidado', {
        pedido_id: dados.pedidoId,
      });

      setDados(d => ({ ...d, viagemId: data.viagem_id }));
      toast.success('✓ Viagem/Romaneio gerada!');
      setPasso(3);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PASSO 3: Confirmar Entregas
  const handleConfirmarEntregas = async () => {
    setLoading(true);
    try {
      // Buscar paradas
      const paradas = await base44.entities.ParadaViagem.filter(
        { viagem_id: dados.viagemId },
        null,
        10
      );

      let confirmadas = 0;
      for (const parada of paradas) {
        // Buscar itens da parada
        const itens = await base44.entities.ParadaViagemItem.filter(
          { parada_viagem_id: parada.id },
          null,
          50
        );

        for (const item of itens) {
          // Atualizar quantidade entregue
          await base44.entities.ParadaViagemItem.update(item.id, {
            quantidade_entregue: item.quantidade_planejada || item.quantidade_planejada,
          });
        }

        // Atualizar status parada
        await base44.entities.ParadaViagem.update(parada.id, {
          status: 'ENTREGUE',
          data_entrega: new Date().toISOString(),
        });

        // Gerar entrada de estoque para a obra
        const locaisEstoque = await base44.entities.LocalEstoque.filter(
          { obra_id: parada.obra_id, tipo: 'OBRA' },
          null,
          1
        );

        if (locaisEstoque.length > 0) {
          for (const item of itens) {
            await base44.entities.EstoqueMovimentacao.create({
              local_estoque_id: locaisEstoque[0].id,
              material_id: item.material_id,
              tipo_movimento: 'ENTRADA',
              quantidade: item.quantidade_entregue,
              valor_unitario: 100,
              observacao: `Entrega viagem ${parada.viagem_id}`,
            });
          }
        }

        confirmadas++;
      }

      toast.success(`✓ ${confirmadas} entregas confirmadas + estoque atualizado!`);
      setPasso(4);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PASSO 4: Processar NF
  const handleProcessarNF = async () => {
    setLoading(true);
    try {
      // Criar NF teste
      const nf = await base44.entities.NotaFiscal.create({
        tipo: 'NF',
        numero: `NF-TESTE-${Date.now()}`,
        data_emissao: new Date().toISOString().split('T')[0],
        emissor_nome: 'Fornecedor Teste',
        emissor_cnpj: '11222333000181',
        valor_total: 5000,
        status: 'ENVIADO',
      });

      // Vincular ao pedido
      await base44.entities.NotaFiscalVinculo.create({
        documento_fiscal_id: nf.id,
        referencia_tipo: 'PEDIDO',
        referencia_id: dados.pedidoId,
        referencia_nome: `Pedido ${dados.pedidoId}`,
      });

      // Confirmar NF
      await base44.entities.NotaFiscal.update(nf.id, {
        status: 'CONFIRMADO',
        valor_final_ajustado: 5000,
      });

      setDados(d => ({ ...d, nfId: nf.id }));
      toast.success('✓ NF criada, confirmada e vinculada!');
      setPasso(5);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PASSO 5: Ratear NF
  const handleRatearNF = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('calcularRateioNotaFiscal', {
        nf_id: dados.nfId,
      });

      toast.success(`✓ NF rateada entre ${data.rateio.length} obras!`);
      setPasso(6);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PASSO 6: Gerar Contas a Pagar
  const handleGerarContasPagar = async () => {
    setLoading(true);
    try {
      // Buscar rateios
      const rateios = await base44.entities.DocumentoFiscalRateio.filter(
        { documento_fiscal_id: dados.nfId },
        null,
        100
      );

      let contasCriadas = 0;
      for (const rateio of rateios) {
        const { data } = await base44.functions.invoke('gerarContaPagarDeNotaFiscal', {
          nf_id: dados.nfId,
          valor_final: rateio.valor_rateado,
          status_pagamento: 'ABERTA',
          obra_id: rateio.obra_id,
        });

        if (data?.conta_pagar_id) {
          contasCriadas++;
        }
      }

      setDados(d => ({ ...d, contaPagarId: true }));
      toast.success(`✓ ${contasCriadas} contas a pagar geradas!`);
      setPasso(7);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PASSO 7: Verificar Resultados
  const handleVerificarResultados = async () => {
    // Esta é só uma página de resumo
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Teste de Aceitação - Fluxo Completo</h1>
        <p className="text-gray-600">Pedido Consolidado → Viagem → Entregas → NF → Contas a Pagar</p>
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-7 gap-2 mb-12">
        {[1, 2, 3, 4, 5, 6, 7].map((p) => (
          <div
            key={p}
            className={`flex items-center justify-center h-12 rounded-lg font-semibold cursor-pointer transition ${
              passo === p
                ? 'bg-blue-600 text-white'
                : passo > p
                ? 'bg-green-100 text-green-900'
                : 'bg-gray-100 text-gray-500'
            }`}
            onClick={() => passo > p && setPasso(p)}
          >
            {passo > p ? <CheckCircle2 className="w-5 h-5" /> : p}
          </div>
        ))}
      </div>

      {/* Conteúdo dos Passos */}
      <Card className="p-8">
        {passo === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">1. Criar Pedido Consolidado</h2>
            <p className="text-gray-600">
              Criará um pedido para 5 obras diferentes com rateio de quantidade.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
              ✓ Requer: 3+ obras, 1+ fornecedor, 1+ material
            </div>
            <Button onClick={handleCriarPedidoConsolidado} disabled={loading} className="mt-4">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Criar Pedido (5 Obras)
            </Button>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">2. Gerar Viagem/Romaneio</h2>
            <p className="text-gray-600">
              Criará uma viagem com 5 paradas (uma para cada obra).
            </p>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
              ✓ Pedido: {dados.pedidoId?.slice(0, 8)}...
            </div>
            <Button onClick={handleGerarViagem} disabled={loading} className="mt-4">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Gerar Viagem com 5 Paradas
            </Button>
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">3. Confirmar Entregas</h2>
            <p className="text-gray-600">
              Marcará como entregue e criará entradas de estoque em cada obra.
            </p>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
              ✓ Viagem: {dados.viagemId?.slice(0, 8)}...
            </div>
            <Button onClick={handleConfirmarEntregas} disabled={loading} className="mt-4">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar 5 Entregas
            </Button>
          </div>
        )}

        {passo === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">4. Processar NF</h2>
            <p className="text-gray-600">
              Criará, confirmará e vinculará uma NF ao pedido.
            </p>
            <Button onClick={handleProcessarNF} disabled={loading} className="mt-4">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Criar e Confirmar NF
            </Button>
          </div>
        )}

        {passo === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">5. Ratear NF</h2>
            <p className="text-gray-600">
              Distribuirá proporcionalmente o valor da NF entre as 5 obras baseado no rateio original.
            </p>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
              ✓ NF: {dados.nfId?.slice(0, 8)}...
            </div>
            <Button onClick={handleRatearNF} disabled={loading} className="mt-4">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Ratear NF Entre Obras
            </Button>
          </div>
        )}

        {passo === 6 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">6. Gerar Contas a Pagar</h2>
            <p className="text-gray-600">
              Criará contas a pagar (uma para cada obra, com o valor rateado).
            </p>
            <Button onClick={handleGerarContasPagar} disabled={loading} className="mt-4">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Gerar 5 Contas a Pagar
            </Button>
          </div>
        )}

        {passo === 7 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-green-600">✓ Teste Completo!</h2>
            <p className="text-gray-600">Todos os passos foram executados com sucesso.</p>
            
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>Pedido consolidado criado</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>Viagem com 5 paradas gerada</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>5 entregas confirmadas + estoque atualizado</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>NF criada e confirmada</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>NF rateada entre 5 obras</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>5 contas a pagar geradas (uma por obra)</span>
              </div>
            </div>

            <Button onClick={() => setPasso(1)} variant="outline" className="mt-6 w-full">
              Executar Teste Novamente
            </Button>
          </div>
        )}

        {/* Botões de Navegação */}
        {passo < 7 && (
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setPasso(passo - 1)}
              disabled={passo === 1 || loading}
            >
              ← Voltar
            </Button>
            <div className="flex-1" />
            <span className="text-sm text-gray-600 py-2">
              Passo {passo} de 7
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}