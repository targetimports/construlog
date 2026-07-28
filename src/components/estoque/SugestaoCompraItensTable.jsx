import React from 'react';
import { Badge } from '@/components/ui/badge';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function SugestaoCompraItensTable({ itens = [] }) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Nenhum item</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr className="border-b">
            <th className="px-2 py-2 text-left font-semibold text-gray-600">Material</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Saldo</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Dispon.</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Reserv.</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Cons./dia</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Lead T.</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Cobert.</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600 text-green-700">Sugerido</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Custo Méd.</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600">Valor Est.</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-600">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, i) => {
            const isRuptura = (item.motivo || '').includes('RUPTURA');
            return (
              <tr key={i} className={`border-b hover:bg-gray-50 ${isRuptura ? 'bg-red-50' : ''}`}>
                <td className="px-2 py-2">
                  <p className="font-medium text-gray-900">{item.material_nome}</p>
                  <p className="text-gray-400">{item.unidade}</p>
                </td>
                <td className="px-2 py-2 text-right">{fmtN(item.saldo_atual)}</td>
                <td className="px-2 py-2 text-right text-emerald-700 font-medium">{fmtN(item.disponivel)}</td>
                <td className="px-2 py-2 text-right text-orange-600">{fmtN(item.reservado)}</td>
                <td className="px-2 py-2 text-right">{fmtN(item.consumo_medio_diario)}</td>
                <td className="px-2 py-2 text-right">{item.lead_time_dias || '—'}d</td>
                <td className="px-2 py-2 text-right">
                  {item.dias_cobertura > 0 ? (
                    <span className={item.dias_cobertura <= 7 ? 'text-red-600 font-semibold' : ''}>
                      {item.dias_cobertura}d
                    </span>
                  ) : '—'}
                </td>
                <td className="px-2 py-2 text-right font-bold text-green-700">
                  {fmtN(item.sugerido)} {item.unidade}
                </td>
                <td className="px-2 py-2 text-right">{fmt(item.custo_unitario_medio)}</td>
                <td className="px-2 py-2 text-right font-semibold">{fmt(item.valor_estimado)}</td>
                <td className="px-2 py-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${isRuptura ? 'bg-red-100 text-red-700 border-red-200' : ''}`}
                  >
                    {item.motivo}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 font-semibold">
          <tr className="border-t">
            <td className="px-2 py-2" colSpan={9}>Total Estimado</td>
            <td className="px-2 py-2 text-right text-green-700">
              {fmt(itens.reduce((s, i) => s + (i.valor_estimado || 0), 0))}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}