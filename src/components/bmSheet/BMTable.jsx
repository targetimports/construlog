import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import BMItemRow from "./BMItemRow";

export default function BMTable({ itemsCalc, contratoItemsMap, onQtyChange, onQtyBlur, locked = false }) {
  const items = itemsCalc || [];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Descrição</th>
                <th className="py-2 pr-3">Un.</th>
                <th className="py-2 pr-3 text-right">Qtd Contrato</th>
                <th className="py-2 pr-3 text-right">PU c/ BDI</th>
                <th className="py-2 pr-3 text-right">Total Contrato</th>
                <th className="py-2 pr-3 text-right">Qtd Anterior</th>
                <th className="py-2 pr-3 text-right">Vl Anterior</th>
                <th className="py-2 pr-3 text-right">Qtd Período</th>
                <th className="py-2 pr-3 text-right">Vl Período</th>
                <th className="py-2 pr-3 text-right">Qtd Acum.</th>
                <th className="py-2 pr-3 text-right">Vl Acum.</th>
                <th className="py-2 pr-3 text-right">Qtd Saldo</th>
                <th className="py-2 pr-3 text-right">Vl Saldo</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-6 text-center text-gray-500">Nenhum item para este BM.</td>
                </tr>
              ) : (
                items.map((it) => (
                  <BMItemRow
                    key={it.contrato_item_id}
                    item={it}
                    contratoItem={contratoItemsMap[it.contrato_item_id]}
                    onQtyChange={onQtyChange}
                    onQtyBlur={onQtyBlur}
                    locked={locked}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}