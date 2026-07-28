import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_DIVERGENCIA = {
  FORNECEDOR_DIFERENTE: { label: 'Fornecedor diferente', icon: AlertTriangle, color: 'bg-orange-50' },
  ITEM_NAO_ENCONTRADO: { label: 'Item não encontrado', icon: AlertCircle, color: 'bg-yellow-50' },
  QUANTIDADE_DIVERGENTE: { label: 'Quantidade divergente', icon: AlertTriangle, color: 'bg-orange-50' },
  VALOR_DIVERGENTE: { label: 'Valor divergente', icon: AlertTriangle, color: 'bg-orange-50' },
  UNIDADE_DIVERGENTE: { label: 'Unidade divergente', icon: AlertCircle, color: 'bg-yellow-50' },
};

export default function PCNotaFiscalConferencia({
  pedidoId,
  pedidoData,
  dadosNF,
  onConfirmar = null,
  onCancelar = null,
  disabled = false,
}) {
  const qc = useQueryClient();
  const [expandidos, setExpandidos] = useState({});
  const [confirmandoFornecedor, setConfirmandoFornecedor] = useState(false);

  // Analisar divergências
  const analise = useMemo(() => {
    const divergencias = [];
    const sugestoes = {};

    // 1. Fornecedor
    if (dadosNF?.cabecalho?.fornecedor_cnpj && pedidoData?.fornecedor_cnpj) {
      const cnpjNF = dadosNF.cabecalho.fornecedor_cnpj.replace(/\D/g, '');
      const cnpjPedido = pedidoData.fornecedor_cnpj.replace(/\D/g, '');
      if (cnpjNF !== cnpjPedido) {
        divergencias.push({
          tipo: 'FORNECEDOR_DIFERENTE',
          pedido: pedidoData.fornecedor_nome,
          nf: dadosNF.cabecalho.fornecedor_nome,
          detalhe: `CNPJ: ${cnpjPedido} vs ${cnpjNF}`,
        });
        sugestoes.fornecedor = dadosNF.cabecalho;
      }
    }

    // 2. Itens
    if (dadosNF?.itens && Array.isArray(dadosNF.itens)) {
      const itensNF = dadosNF.itens;
      const itensPedido = pedidoData?.itens || [];

      itensNF.forEach((itemNF, idxNF) => {
        // Procurar item similar no pedido por descrição (fuzzy match simples)
        const itemPedido = itensPedido.find(
          (ip) => ip.descricao?.toLowerCase().includes(itemNF.descricao?.toLowerCase().substring(0, 10))
        );

        if (!itemPedido) {
          divergencias.push({
            tipo: 'ITEM_NAO_ENCONTRADO',
            item: itemNF.descricao,
            detalhe: `${itemNF.quantidade} ${itemNF.unidade} @ R$ ${itemNF.valor_unitario}`,
          });
        } else {
          // Comparar quantidade
          if (Math.abs(itemPedido.quantidade - itemNF.quantidade) > 0.01) {
            divergencias.push({
              tipo: 'QUANTIDADE_DIVERGENTE',
              item: itemNF.descricao,
              pedido: itemPedido.quantidade,
              nf: itemNF.quantidade,
            });
          }

          // Comparar valor unitário
          if (itemPedido.valor_unitario && itemNF.valor_unitario) {
            if (Math.abs(itemPedido.valor_unitario - itemNF.valor_unitario) > 0.01) {
              divergencias.push({
                tipo: 'VALOR_DIVERGENTE',
                item: itemNF.descricao,
                pedido: itemPedido.valor_unitario,
                nf: itemNF.valor_unitario,
              });
            }
          }

          // Comparar unidade
          if (itemPedido.unidade !== itemNF.unidade) {
            divergencias.push({
              tipo: 'UNIDADE_DIVERGENTE',
              item: itemNF.descricao,
              pedido: itemPedido.unidade,
              nf: itemNF.unidade,
            });
          }
        }
      });

      sugestoes.itens = itensNF;
    }

    // 3. Valor total
    const valorTotalPedido = (pedidoData?.itens || []).reduce(
      (sum, it) => sum + (it.valor_total || 0),
      0
    );
    const valorTotalNF = dadosNF?.cabecalho?.valor_total || 0;
    if (Math.abs(valorTotalPedido - valorTotalNF) > 0.01) {
      divergencias.push({
        tipo: 'VALOR_DIVERGENTE',
        item: 'TOTAL DO PEDIDO',
        pedido: valorTotalPedido,
        nf: valorTotalNF,
      });
    }

    return { divergencias, sugestoes, temDivergencias: divergencias.length > 0 };
  }, [pedidoData, dadosNF]);

  const aplicarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('aplicarNotaFiscalAoPedido', {
        pedidoId,
        dadosNF,
        sugestoes: analise.sugestoes,
        pedidoDataAtual: pedidoData,
      });
      return response.data;
    },
    onSuccess: (resultado) => {
      toast.success('Dados da NF aplicados ao pedido');
      if (onConfirmar) onConfirmar(resultado);
      qc.invalidateQueries({ queryKey: ['pedido_compra', pedidoId] });
    },
    onError: (err) => {
      toast.error(`Erro ao aplicar NF: ${err.message}`);
    },
  });

  const handleConfirmar = async () => {
    if (analise.temDivergencias && !confirmandoFornecedor) {
      setConfirmandoFornecedor(true);
      return;
    }
    await aplicarMutation.mutateAsync();
  };

  return (
    <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-blue-900">Conferência - Dados da NF vs Pedido</p>
          <p className="text-xs text-blue-700 mt-1">
            Revise as informações abaixo antes de aplicar ao pedido
          </p>
        </div>
      </div>

      {/* Resumo de Divergências */}
      {analise.temDivergencias && (
        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs space-y-1">
          <p className="font-semibold text-amber-800">{analise.divergencias.length} divergência(s) encontrada(s):</p>
          <ul className="space-y-0.5 text-amber-700">
            {analise.divergencias.slice(0, 3).map((div, idx) => (
              <li key={idx} className="flex gap-1">
                <span>•</span>
                <span>{TIPOS_DIVERGENCIA[div.tipo]?.label} — {div.detalhe || div.item}</span>
              </li>
            ))}
            {analise.divergencias.length > 3 && (
              <li className="text-amber-600 italic">... e mais {analise.divergencias.length - 3}</li>
            )}
          </ul>
        </div>
      )}

      {/* Comparação Fornecedor */}
      <Card className="p-2 space-y-2">
        <p className="text-xs font-semibold text-gray-700">Fornecedor</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-100 p-2 rounded">
            <p className="text-xs text-gray-600">Pedido</p>
            <p className="text-xs font-medium text-gray-900 truncate">{pedidoData?.fornecedor_nome || '—'}</p>
          </div>
          <div className={`p-2 rounded ${analise.sugestoes.fornecedor ? 'bg-amber-100' : 'bg-green-100'}`}>
            <p className="text-xs text-gray-600">Nota Fiscal</p>
            <p className="text-xs font-medium text-gray-900 truncate">
              {dadosNF?.cabecalho?.fornecedor_nome || '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Comparação Itens */}
      {analise.divergencias.some(d => d.tipo.includes('ITEM')) && (
        <Card className="p-2">
          <p className="text-xs font-semibold text-gray-700 mb-2">Itens (divergências)</p>
          <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
            {analise.divergencias
              .filter(d => d.tipo.includes('ITEM'))
              .map((div, idx) => (
                <div key={idx} className="bg-amber-50 border border-amber-200 p-1.5 rounded">
                  <p className="font-medium text-amber-900">{div.item}</p>
                  <p className="text-amber-700">
                    {TIPOS_DIVERGENCIA[div.tipo]?.label} — Pedido: {div.pedido} | NF: {div.nf}
                  </p>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Confirmação de Divergências */}
      {analise.temDivergencias && confirmandoFornecedor && (
        <Card className="p-2 bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-2">
            Deseja continuar mesmo com as divergências acima?
          </p>
          <p className="text-xs text-amber-700 mb-2">
            Os dados serão aplicados conforme a Nota Fiscal. Você poderá revisar e corrigir manualmente se necessário.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmandoFornecedor(false)}
            >
              Revisar novamente
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleConfirmar}
              disabled={aplicarMutation.isPending}
            >
              {aplicarMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Aplicando...
                </>
              ) : (
                'Confirmar e aplicar'
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Actions */}
      {!confirmandoFornecedor && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancelar}
            disabled={disabled || aplicarMutation.isPending}
          >
            <X className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={handleConfirmar}
            disabled={disabled || aplicarMutation.isPending}
          >
            {aplicarMutation.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Processando...
              </>
            ) : analise.temDivergencias ? (
              'Continuar com divergências'
            ) : (
              'Aplicar ao pedido'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}