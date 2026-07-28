import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormSkeleton } from '@/components/shared/Skeletons';

export default function CotacaoDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const cotacaoId = urlParams.get('id');

  const { data: cotacaoData, isLoading } = useQuery({
    queryKey: ['cotacao', cotacaoId],
    queryFn: () => base44.entities.CotacaoFornecedor.filter({ id: cotacaoId }),
    enabled: !!cotacaoId
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto"><FormSkeleton fields={6} /></div>;
  }

  const cotacao = cotacaoData?.[0];

  if (!cotacao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Cotação não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Cotação - {cotacao.fornecedor}
          </h1>
          <p className="text-gray-600 text-sm">Detalhes da cotação</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Fornecedor</p>
              <p className="font-semibold text-gray-900">{cotacao.fornecedor}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge>{cotacao.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor Unitário</p>
              <p className="font-semibold text-gray-900">
                {cotacao.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="font-semibold text-gray-900">
                {cotacao.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            {cotacao.prazo_entrega_dias && (
              <div>
                <p className="text-sm text-gray-600">Prazo Entrega</p>
                <p className="font-semibold text-gray-900">{cotacao.prazo_entrega_dias} dias</p>
              </div>
            )}
            {cotacao.condicoes_pagamento && (
              <div>
                <p className="text-sm text-gray-600">Condições Pagamento</p>
                <p className="font-semibold text-gray-900">{cotacao.condicoes_pagamento}</p>
              </div>
            )}
          </div>
          {cotacao.observacoes && (
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-1">Observações</p>
              <p className="text-gray-900">{cotacao.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}