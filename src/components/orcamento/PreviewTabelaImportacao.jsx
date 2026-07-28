import React, { useState } from 'react';
import { ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PreviewTabelaImportacao({ dados, mapaColunas }) {
  const [page, setPage] = useState(1);
  const itemsPorPagina = 10;
  
  if (!dados || dados.length === 0) {
    return <div className="text-center py-4 text-gray-600">Nenhum dado para visualizar</div>;
  }
  
  const totalPages = Math.ceil(dados.length / itemsPorPagina);
  const paginaAtual = dados.slice(
    (page - 1) * itemsPorPagina,
    page * itemsPorPagina
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 w-12">#</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Descrição</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Qtd</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Valor Unit.</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">BDI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginaAtual.map((item, idx) => (
              <tr 
                key={idx}
                className={item.valida ? 'hover:bg-gray-50' : 'bg-red-50/30 hover:bg-red-50'}
              >
                <td className="px-4 py-2 text-gray-600 font-medium">
                  {(page - 1) * itemsPorPagina + idx + 1}
                </td>
                <td className="px-4 py-2">
                  {item.valida ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="group relative cursor-help">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <div className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {item.erros?.[0] || 'Erro na linha'}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-900 font-medium truncate max-w-xs">
                  {item.descricao}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {(item.quantidade || 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {(item.valor_unitario || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </td>
                <td className="px-4 py-2 text-right font-medium text-gray-900">
                  {(item.valor_total || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {item.bdi > 0 && `${item.bdi.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Próximo →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}