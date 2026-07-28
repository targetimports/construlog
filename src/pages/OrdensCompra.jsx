import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye, Truck, DollarSign, CheckCircle2 } from 'lucide-react';
import { CardGridSkeleton } from '@/components/shared/Skeletons';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const statusLabels = {
  criada: 'Criada',
  aprovada: 'Aprovada',
  paga: 'Paga',
  recebida: 'Recebida',
  parcial: 'Parcial',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada'
};

const statusColors = {
  criada: 'bg-gray-100 text-gray-800',
  aprovada: 'bg-blue-100 text-blue-800',
  paga: 'bg-amber-100 text-amber-800',
  recebida: 'bg-green-100 text-green-800',
  parcial: 'bg-orange-100 text-orange-800',
  finalizada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800'
};

export default function OrdensCompra() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="COMPRAS_VIEW">
      <OrdensCompraContent />
    </RouteGuardFinalV2>
  );
}

function OrdensCompraContent() {
  const [filtroStatus, setFiltroStatus] = useState('');
  const queryClient = useQueryClient();

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ['ordens-compra'],
    queryFn: () => base44.entities.OrdemCompra.list('-created_date', 100)
  });

  const { mutate: aprovarOC } = useMutation({
    mutationFn: (oc_id) => base44.functions.invoke('aprovarOrdemCompra', { oc_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      toast.success('Ordem de compra aprovada');
    }
  });

  const { mutate: pagarOC } = useMutation({
    mutationFn: (oc_id) => base44.functions.invoke('registrarPagamentoOC', { oc_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      toast.success('Pagamento registrado (Material ainda não entra em estoque)');
    }
  });

  const filtradas = filtroStatus 
    ? ordens.filter(o => o.status === filtroStatus)
    : ordens;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <CardGridSkeleton count={5} cols="" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ordens de Compra</h1>
            <p className="text-gray-600 mt-1">Gerencie pedidos de materiais</p>
          </div>
          <Button 
            className="bg-blue-600 hover:bg-blue-700" 
            onClick={() => window.location.href = createPageUrl('OCForm')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova OC
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={filtroStatus === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('')}
          >
            Todas ({ordens.length})
          </Button>
          {Object.entries(statusLabels).map(([status, label]) => {
            const count = ordens.filter(o => o.status === status).length;
            return (
              <Button
                key={status}
                variant={filtroStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroStatus(status)}
              >
                {label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Lista de OCs */}
        <div className="space-y-4">
          {filtradas.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                Nenhuma ordem de compra encontrada
              </CardContent>
            </Card>
          ) : (
            filtradas.map(oc => (
              <Card key={oc.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">OC #{oc.numero}</p>
                      <p className="text-sm text-gray-600">{oc.fornecedor_nome}</p>
                    </div>
                    <Badge className={statusColors[oc.status]}>
                      {statusLabels[oc.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Valor Total</p>
                      <p className="font-semibold">R$ {oc.valor_total?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Itens</p>
                      <p className="font-semibold">{oc.itens?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Entrega Prevista</p>
                      <p className="font-semibold text-sm">
                        {oc.data_prevista_entrega ? new Date(oc.data_prevista_entrega).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Pagamento</p>
                      <p className="font-semibold text-sm">
                        {oc.status_pagamento === 'pago' ? '✓ Pago' : 'Aguardando'}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-4 border-t flex-wrap">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Detalhes
                    </Button>

                    {oc.status === 'criada' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => aprovarOC(oc.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Aprovar
                      </Button>
                    )}

                    {oc.status === 'aprovada' && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => pagarOC(oc.id)}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Pagar
                      </Button>
                    )}

                    {(oc.status === 'paga' || oc.status === 'aprovada') && (
                      <Button variant="outline" size="sm">
                        <Truck className="w-4 h-4 mr-2" />
                        Recebimento
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}