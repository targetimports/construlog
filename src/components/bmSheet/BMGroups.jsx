import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BMGroups({ groups }) {
  const list = groups || [];
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evolução por Grupo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-3">Grupo</th>
                <th className="py-2 pr-3 text-right">Anterior</th>
                <th className="py-2 pr-3 text-right">Período</th>
                <th className="py-2 pr-3 text-right">Acumulado</th>
                <th className="py-2 pr-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((g, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium text-gray-800">{g.grupo}</td>
                  <td className="py-2 pr-3 text-right">{currency.format(g.vl_anterior || 0)}</td>
                  <td className="py-2 pr-3 text-right">{currency.format(g.vl_periodo || 0)}</td>
                  <td className="py-2 pr-3 text-right">{currency.format(g.vl_acumulado || 0)}</td>
                  <td className="py-2 pr-3 text-right">{currency.format(g.vl_saldo || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}