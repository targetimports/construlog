import React, { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { cn } from '@/lib/utils';

const quickCreateOptions = [
  {
    category: 'Financeiro',
    items: [
      { label: 'Lançamento', page: 'Financeiro' },
      { label: 'Faturamento', page: 'Medicoes' },
      { label: 'Transferência', page: 'Financeiro' },
    ]
  },
  {
    category: 'Compras',
    items: [
      { label: 'Solicitação', page: 'SolicitacaoForm' },
      { label: 'Ordem de Compra', page: 'ComprasForm' },
    ]
  },
  {
    category: 'Gestão',
    items: [
      { label: 'Diário de Obra', page: 'DiarioObra' },
      { label: 'Nova Obra', page: 'ObraForm' },
      { label: 'Orçamento', page: 'OrcamentoForm' },
    ]
  }
];

export default function QuickCreateMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-md"
      >
        <Plus className="w-5 h-5" />
        Novo
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-20 min-w-72 overflow-hidden">
            {quickCreateOptions.map((group, idx) => (
              <div key={idx}>
                {idx > 0 && <div className="border-t border-gray-200" />}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">{group.category}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        to={createPageUrl(item.page)}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-gray-900 transition-colors text-sm"
                      >
                        <span className="text-blue-600">+</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}