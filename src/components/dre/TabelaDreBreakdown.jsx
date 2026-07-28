import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TabelaDreBreakdown({ breakdown = [] }) {
  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Breakdown por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  const totalGeral = breakdown.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakdown por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-500">
                <th className="p-3 text-left">Categoria</th>
                <th className="p-3 text-left">Grupo</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">% do Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdown.map((cat, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3">{cat.categoria_nome}</td>
                  <td className="p-3 capitalize">{cat.grupo}</td>
                  <td className="p-3 text-right font-medium">
                    R$ {cat.total.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="p-3 text-right">
                    {totalGeral > 0 ? ((cat.total / totalGeral) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan="2" className="p-3">TOTAL</td>
                <td className="p-3 text-right">
                  R$ {totalGeral.toFixed(2).replace('.', ',')}
                </td>
                <td className="p-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden flex flex-col gap-y-2 p-2">
          {breakdown.map((cat, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 break-words">{cat.categoria_nome}</p>
                  <p className="text-xs text-gray-500 capitalize">{cat.grupo}</p>
                </div>
                <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                  {totalGeral > 0 ? ((cat.total / totalGeral) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold text-gray-900 break-words tabular-nums">
                R$ {cat.total.toFixed(2).replace('.', ',')}
              </p>
            </div>
          ))}
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-100 font-bold">
            <div className="flex items-center justify-between gap-3">
              <span>TOTAL</span>
              <span className="text-xs font-semibold text-gray-500">100%</span>
            </div>
            <p className="mt-1 text-lg break-words tabular-nums">
              R$ {totalGeral.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}