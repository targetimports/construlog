import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const operacoes = [
  { id: 'resumo', label: 'Resumo', badge: 'Novo' },
  { id: 'nf', label: 'Notas Fiscais', badge: 'Novo' },
  { id: 'mao_obra', label: 'Mão de Obra', badge: 'Novo' },
  { id: 'material', label: 'Material', badge: 'Novo' },
  { id: 'alimentacao', label: 'Alimentação', badge: 'Novo' },
  { id: 'aluguel', label: 'Aluguel/Combustível', badge: 'Novo' },
  { id: 'frete', label: 'Fretes', badge: 'Novo' },
  { id: 'estadia', label: 'Estadias', badge: 'Novo' },
  { id: 'imposto', label: 'Impostos', badge: 'Novo' },
  { id: 'retirada', label: 'Retiradas', badge: 'Novo' },
  { id: 'pessoas', label: 'Pessoas', badge: 'Novo' },
  { id: 'bi_compras', label: 'BI Compras', badge: 'Novo' }
];

export default function MenuOperacoes({ selected, onSelect }) {
  return (
    <div className="w-64 bg-gray-900 rounded-lg p-4 h-fit space-y-2 border border-gray-800 hidden lg:block">
      <h3 className="text-sm font-semibold text-white px-3 py-2">OPERAÇÕES</h3>
      {operacoes.map(op => (
        <button
          key={op.id}
          onClick={() => onSelect(op.id)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm font-medium",
            selected === op.id
              ? "bg-amber-500 text-gray-900"
              : "text-gray-400 hover:bg-gray-800"
          )}
        >
          <span>{op.label}</span>
          {op.badge && (
            <Badge className="bg-amber-500 text-gray-900 text-xs">{op.badge}</Badge>
          )}
        </button>
      ))}
    </div>
  );
}