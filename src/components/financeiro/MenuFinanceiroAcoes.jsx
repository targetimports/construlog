import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

const menuItems = [
  { label: 'Resumo', page: 'Resumo', novoDisabled: true },
  { label: 'Notas Fiscais', page: 'NotaFiscalForm' },
  { label: 'Mão de Obra', page: 'MaoDeObraForm' },
  { label: 'Material', page: 'MaterialForm' },
  { label: 'Alimentação', page: 'AlimentacaoForm' },
  { label: 'Aluguel/Combustível', page: 'AluguelForm' },
  { label: 'Fretes', page: 'FreteForm' },
  { label: 'Estadias', page: 'EstadiasForm' },
  { label: 'Impostos', page: 'ImpostosForm' },
  { label: 'Retiradas', page: 'RetiradaForm' },
  { label: 'Pessoas', page: 'Pessoas' },
  { label: 'BI Compras', page: 'BICompras' }
];

export default function MenuFinanceiroAcoes() {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-bold text-gray-100 uppercase tracking-widest">RESUMO</h3>
      </div>

      {/* Menu Items */}
      <div className="divide-y divide-gray-700">
        {menuItems.map((item) => (
          <div
            key={item.page}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-700 transition-colors group"
          >
            <Link
              to={createPageUrl(item.page)}
              className="text-gray-200 text-sm font-medium flex-1 hover:text-gray-100 transition-colors"
            >
              {item.label}
            </Link>
            {!item.novoDisabled && (
              <Link to={createPageUrl(item.page)}>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold text-xs px-3 h-6"
                >
                  Novo
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}