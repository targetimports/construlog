import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, TrendingDown, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ComparativoCotacoes({ requisicao, cotacoes, onAprovar }) {
  const [selecionada, setSelecionada] = useState(null);

  const cotacoesOrdenadas = [...cotacoes].sort((a, b) => a.valor_total - b.valor_total);
  const menorPreco = cotacoesOrdenadas[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-xl">
        <div>
          <p className="text-gray-400 text-sm">Item</p>
          <p className="text-white font-medium">{requisicao.descricao}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Quantidade</p>
          <p className="text-white font-medium">{requisicao.quantidade} {requisicao.unidade}</p>
        </div>
      </div>

      <div className="space-y-3">
        {cotacoesOrdenadas.map((cotacao, idx) => {
          const isMelhor = cotacao.id === menorPreco.id;
          const economia = menorPreco.valor_total < cotacao.valor_total 
            ? ((cotacao.valor_total - menorPreco.valor_total) / cotacao.valor_total * 100).toFixed(1)
            : 0;

          return (
            <div
              key={cotacao.id}
              onClick={() => setSelecionada(cotacao.id)}
              className={cn(
                "p-4 rounded-xl border-2 cursor-pointer transition-all",
                selecionada === cotacao.id
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold">{cotacao.fornecedor}</p>
                    {isMelhor && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Melhor Preço
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{cotacao.contato_fornecedor}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-2xl font-bold">
                    {cotacao.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {cotacao.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{requisicao.unidade}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Prazo Entrega</p>
                  <div className="flex items-center gap-1 text-white">
                    <Calendar className="w-3 h-3" />
                    <span>{cotacao.prazo_entrega_dias} dias</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Pagamento</p>
                  <p className="text-white">{cotacao.condicoes_pagamento || 'A combinar'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Diferença</p>
                  {isMelhor ? (
                    <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <TrendingDown className="w-3 h-3" />
                      <span>Melhor</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-400">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{economia}%</span>
                    </div>
                  )}
                </div>
              </div>

              {cotacao.observacoes && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-gray-400 text-sm">{cotacao.observacoes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
        <Button
          onClick={onAprovar}
          disabled={!selecionada}
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Aprovar Cotação Selecionada
        </Button>
      </div>
    </div>
  );
}