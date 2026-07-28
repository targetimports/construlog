import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle } from 'lucide-react';

export default function MaterialesSolicitados({ obraId }) {
  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ['materiais-solicitados', obraId],
    queryFn: () => base44.entities.MaterialSolicitado.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  if (isLoading) return <div>Carregando...</div>;
  
  if (materiais.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="py-6 text-center text-gray-500">
          <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>Nenhum material solicitado</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    solicitado: { label: 'Solicitado', cls: 'bg-orange-100 text-orange-700' },
    em_cotacao: { label: 'Em Cotação', cls: 'bg-blue-100 text-blue-700' },
    adquirido: { label: 'Adquirido', cls: 'bg-green-100 text-green-700' },
    cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' }
  };

  return (
    <div className="space-y-3">
      {materiais.map(material => (
        <Card key={material.id} className="border-orange-200 bg-orange-50/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <p className="font-medium text-gray-900">{material.descricao}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Quantidade</p>
                    <p className="font-semibold text-gray-900">{material.quantidade} {material.unidade}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Valor Unit.</p>
                    <p className="font-semibold text-gray-900">
                      R$ {(material.valor_unitario || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Subtotal</p>
                    <p className="font-semibold text-gray-900">
                      R$ {(material.quantidade * (material.valor_unitario || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
              <Badge className={statusConfig[material.status]?.cls}>
                {statusConfig[material.status]?.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}