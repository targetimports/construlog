import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { createPageUrl } from '../../utils';

export default function CardCustos() {
  const custos = [
    { label: 'Materiais', percentual: 45, color: 'bg-blue-500' },
    { label: 'Mão de Obra', percentual: 32, color: 'bg-emerald-500' },
    { label: 'Equipamentos', percentual: 18, color: 'bg-amber-500' },
    { label: 'Logística', percentual: 5, color: 'bg-purple-500' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Custos por Categoria</h3>

      <div className="space-y-5">
        {custos.map((custo) => (
          <div key={custo.label}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium text-sm">{custo.label}</span>
              <span className="text-gray-900 font-bold text-sm">{custo.percentual}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${custo.color} rounded-full transition-all`}
                style={{ width: `${custo.percentual}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
         onClick={() => window.location.href = createPageUrl('Relatorios')}
         className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium py-2 flex items-center justify-center gap-2 cursor-pointer"
       >
         <FileText className="w-4 h-4" />
         Gerar Relatório Completo
       </Button>
    </div>
  );
}