import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { ArrowLeft, FileText, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormSkeleton } from '@/components/shared/Skeletons';

export default function CompraDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const ordemId = urlParams.get('id');

  const { data: ordemData, isLoading } = useQuery({
    queryKey: ['ordem-compra', ordemId],
    queryFn: () => base44.entities.OrdemCompra.filter({ id: ordemId }),
    enabled: !!ordemId
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <FormSkeleton fields={6} />
      </div>
    );
  }

  const ordem = ordemData?.[0];

  if (!ordem) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Ordem de compra não encontrada</p>
        <Link to={createPageUrl('Compras')}>
          <Button>Ver Compras</Button>
        </Link>
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
            <FileText className="w-6 h-6 text-purple-600" />
            Ordem de Compra #{ordem.numero}
          </h1>
          <p className="text-gray-600 text-sm">{ordem.descricao}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Ordem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Fornecedor</p>
              <p className="font-semibold text-gray-900">{ordem.fornecedor_nome}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge>{ordem.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data Emissão</p>
              <p className="font-semibold text-gray-900">
                {new Date(ordem.data_emissao).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Previsão Entrega</p>
              <p className="font-semibold text-gray-900">
                {new Date(ordem.data_prevista_entrega).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="font-semibold text-blue-600 text-lg">
                {ordem.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            {ordem.aprovado_por && (
              <div>
                <p className="text-sm text-gray-600">Aprovado por</p>
                <p className="font-semibold text-gray-900">{ordem.aprovado_por}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      {ordem.itens && ordem.itens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Itens da Ordem ({ordem.itens.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ordem.itens.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.descricao}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.quantidade} {item.unidade} × {item.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {item.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      {ordem.status === 'confirmada' && (
        <div className="flex justify-end">
          <Link to={createPageUrl(`RecebimentoForm?ordem_id=${ordem.id}`)}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Package className="w-4 h-4" />
              Registrar Recebimento
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}