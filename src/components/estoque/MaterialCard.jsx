import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, MapPin, DollarSign, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MaterialCard({ material, obras }) {
  const estoqueAtual = material.estoque_atual || 0;
  const estoqueMinimo = material.estoque_minimo || 0;
  const percentualEstoque = estoqueMinimo > 0 ? (estoqueAtual / estoqueMinimo) * 100 : 100;
  const abaixoMinimo = estoqueAtual < estoqueMinimo;
  const obra = obras.find(o => o.id === material.obra_id);

  return (
    <Card className={cn(
      "bg-gray-900 border-gray-800 hover:border-amber-500/30 transition-all",
      abaixoMinimo && "border-red-500/30"
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-semibold">{material.nome}</h3>
              {abaixoMinimo && (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
            </div>
            {material.codigo && (
              <p className="text-gray-500 text-sm">Cód: {material.codigo}</p>
            )}
            <Badge variant="outline" className="border-gray-700 text-gray-400 mt-2">
              {material.categoria}
            </Badge>
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            abaixoMinimo ? "bg-red-500/10" : "bg-emerald-500/10"
          )}>
            <Package className={cn(
              "w-6 h-6",
              abaixoMinimo ? "text-red-400" : "text-emerald-400"
            )} />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Estoque</span>
              <span className={cn(
                "font-bold",
                abaixoMinimo ? "text-red-400" : "text-white"
              )}>
                {estoqueAtual} {material.unidade}
              </span>
            </div>
            <Progress 
              value={Math.min(percentualEstoque, 100)} 
              className={cn(
                "h-2",
                abaixoMinimo && "[&>div]:bg-red-500"
              )}
            />
            <p className="text-gray-500 text-xs mt-1">
              Mínimo: {estoqueMinimo} {material.unidade}
            </p>
          </div>

          {material.preco_medio && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">Preço médio:</span>
              <span className="text-white font-semibold">
                {material.preco_medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">
              {obra ? obra.nome : 'Estoque Central'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}