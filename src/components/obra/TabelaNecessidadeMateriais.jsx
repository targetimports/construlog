import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function TabelaNecessidadeMateriais({ obraId }) {
  const { data: necessidades, isLoading } = useQuery({
    queryKey: ['necessidades-materiais', obraId],
    queryFn: () => base44.entities.NecessidadeMaterialObra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  if (isLoading) return <div className="text-center py-8">Carregando materiais...</div>;
  if (!necessidades?.length) return <div className="text-center py-8 text-gray-500">Nenhum material planejado</div>;

  const totalPrevisto = necessidades.reduce((sum, n) => sum + (n.valor_total_previsto || 0), 0);
  const totalComprado = necessidades.reduce((sum, n) => sum + (n.quantidade_comprada || 0) * (n.valor_unitario_previsto || 0), 0);
  const totalSaldo = necessidades.reduce((sum, n) => sum + (n.saldo_necessario || 0) * (n.valor_unitario_previsto || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Necessidade de Materiais
          {necessidades.every(n => n.quantidade_comprada >= n.quantidade_prevista) && (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-2 font-semibold">Material</th>
                <th className="text-right px-4 py-2 font-semibold">Previsto</th>
                <th className="text-right px-4 py-2 font-semibold">Comprado</th>
                <th className="text-right px-4 py-2 font-semibold">Utilizado</th>
                <th className="text-right px-4 py-2 font-semibold">Saldo</th>
                <th className="text-center px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {necessidades.map(n => {
                const percentualCompra = n.quantidade_prevista > 0 ? (n.quantidade_comprada / n.quantidade_prevista * 100) : 0;
                const statusColor = percentualCompra === 0 ? 'bg-yellow-50' : percentualCompra === 100 ? 'bg-green-50' : 'bg-blue-50';

                return (
                  <tr key={n.id} className={`border-b ${statusColor}`}>
                    <td className="px-4 py-3">{n.insumo_id}</td>
                    <td className="text-right px-4 py-3">{n.quantidade_prevista} {n.unidade}</td>
                    <td className="text-right px-4 py-3 font-semibold text-blue-600">{n.quantidade_comprada} {n.unidade}</td>
                    <td className="text-right px-4 py-3">{n.quantidade_utilizada} {n.unidade}</td>
                    <td className="text-right px-4 py-3 font-semibold text-red-600">{n.saldo_necessario} {n.unidade}</td>
                    <td className="text-center px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        n.status === 'comprado' ? 'bg-green-100 text-green-800' :
                        n.status === 'parcialmente_comprado' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {n.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50 font-semibold">
                <td className="px-4 py-3">TOTAL</td>
                <td className="text-right px-4 py-3">R$ {totalPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right px-4 py-3 text-blue-600">R$ {totalComprado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right px-4 py-3">-</td>
                <td className="text-right px-4 py-3 text-red-600">R$ {totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="text-center px-4 py-3">-</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {necessidades.some(n => n.saldo_necessario > 0) && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900">Faltam {necessidades.filter(n => n.saldo_necessario > 0).length} materiais para comprar</p>
              <p className="text-sm text-yellow-800 mt-1">Configure compras no módulo de Suprimentos para cumprir o planejamento</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}