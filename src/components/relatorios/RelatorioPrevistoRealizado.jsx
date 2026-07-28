import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function RelatorioPrevistoRealizado({ obra_id }) {
  const [tipoGrafico, setTipoGrafico] = useState('items'); // 'items' ou 'insumos'

  // Buscar itens com medições
  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-com-medicao', obra_id],
    queryFn: async () => {
      const itens = await base44.entities.OrcamentoItem.filter({ obra_id, is_grupo: false });
      
      // Enriquecer com dados de medição
      const enriquecidos = await Promise.all(itens.map(async (item) => {
        const medicoes = await base44.entities.MedicaoItem.filter({
          orcamento_item_id: item.id
        });
        
        const totalMedido = medicoes.reduce((sum, m) => sum + (m.quantidade_medida || 0), 0);
        const variacao = item.quantidade_orcada ? ((totalMedido - item.quantidade_orcada) / item.quantidade_orcada) * 100 : 0;
        
        return {
          ...item,
          quantidade_realizada: totalMedido,
          variacao: parseFloat(variacao.toFixed(2)),
          status: variacao > 10 ? 'excesso' : variacao < -10 ? 'falta' : 'ok'
        };
      }));
      
      return enriquecidos;
    }
  });

  // Buscar insumos com consumo
  const { data: consumoInsumos = [] } = useQuery({
    queryKey: ['consumo-insumos', obra_id],
    queryFn: async () => {
      const demandas = await base44.entities.DemandaEstoqueObra.filter({ obra_id });
      
      return demandas.map(d => ({
        ...d,
        variacao: d.quantidade_prevista ? ((d.quantidade_consumida - d.quantidade_prevista) / d.quantidade_prevista) * 100 : 0
      }));
    }
  });

  const dadosItems = itensOrcamento.map(item => ({
    item_num: item.item_num,
    orcado: item.quantidade_orcada || 0,
    realizado: item.quantidade_realizada || 0,
    variacao: item.variacao || 0
  }));

  const dadosInsumos = consumoInsumos.slice(0, 10).map(d => ({
    insumo: d.insumo_descricao?.substring(0, 20),
    previsto: d.quantidade_prevista || 0,
    consumido: d.quantidade_consumida || 0,
    variacao: d.variacao || 0
  }));

  const itensComExcesso = itensOrcamento.filter(i => i.status === 'excesso').length;
  const itensComFalta = itensOrcamento.filter(i => i.status === 'falta').length;
  const itensOk = itensOrcamento.filter(i => i.status === 'ok').length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Itens OK</p>
              <p className="text-3xl font-bold text-green-600">{itensOk}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Excesso</p>
              <p className="text-3xl font-bold text-red-600 flex items-center justify-center gap-1">
                {itensComExcesso} <TrendingUp className="w-5 h-5" />
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Falta</p>
              <p className="text-3xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                {itensComFalta} <TrendingDown className="w-5 h-5" />
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Previsto x Realizado</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setTipoGrafico('items')}
                className={`px-3 py-1 rounded text-sm ${tipoGrafico === 'items' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Por Item
              </button>
              <button
                onClick={() => setTipoGrafico('insumos')}
                className={`px-3 py-1 rounded text-sm ${tipoGrafico === 'insumos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Por Insumo
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tipoGrafico === 'items' ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosItems}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="item_num" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="orcado" fill="#3b82f6" />
                <Bar dataKey="realizado" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosInsumos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="insumo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="previsto" stroke="#3b82f6" />
                <Line type="monotone" dataKey="consumido" stroke="#ef4444" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela de variações */}
      <Card>
        <CardHeader>
          <CardTitle>Variações por Item</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-2">Item</th>
                <th className="text-right py-2 px-2">Orçado</th>
                <th className="text-right py-2 px-2">Realizado</th>
                <th className="text-right py-2 px-2">Variação %</th>
                <th className="text-center py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {itensOrcamento.map(item => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 font-semibold">{item.item_num}</td>
                  <td className="text-right py-3 px-2">{item.quantidade_orcada?.toFixed(2)}</td>
                  <td className="text-right py-3 px-2 text-red-600 font-semibold">{item.quantidade_realizada?.toFixed(2)}</td>
                  <td className={`text-right py-3 px-2 font-semibold ${item.variacao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.variacao > 0 ? '+' : ''}{item.variacao?.toFixed(1)}%
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.status === 'ok' ? 'bg-green-100 text-green-800' :
                      item.status === 'excesso' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status === 'ok' ? '✓ OK' : item.status === 'excesso' ? '↑ Excesso' : '↓ Falta'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}