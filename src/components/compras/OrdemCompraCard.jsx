import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, DollarSign, FileText, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  emitida: { label: 'Emitida', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  confirmada: { label: 'Confirmada', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  em_transito: { label: 'Em Trânsito', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  recebida: { label: 'Recebida', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
};

export default function OrdemCompraCard({ ordem, obras }) {
  const status = statusConfig[ordem.status] || statusConfig.emitida;
  const obra = obras.find(o => o.id === ordem.obra_id);

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 hover:bg-gray-800 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-white font-semibold text-lg">OC #{ordem.numero}</h3>
            <Badge className={cn("border", status.color)}>{status.label}</Badge>
          </div>
          <p className="text-gray-400 mb-3">{ordem.descricao}</p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span>{ordem.fornecedor_nome}</span>
            </div>
            {obra && (
              <div className="flex items-center gap-1">
                <Truck className="w-4 h-4" />
                <span>{obra.nome}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Entrega: {new Date(ordem.data_prevista_entrega).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-gray-500 text-sm">Valor Total</p>
          <p className="text-white text-2xl font-bold">
            {ordem.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {ordem.quantidade} {ordem.unidade} × {ordem.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          {ordem.status === 'confirmada' && (
            <Link to={createPageUrl(`RecebimentoForm?ordem_id=${ordem.id}`)}>
              <Button size="sm" className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white">
                Registrar Recebimento
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}