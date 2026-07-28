import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RelatorioComparativoMedicao({ orcamento, medicoes = [], cff = {} }) {
  const dados = useMemo(() => {
    if (!orcamento?.itens) return [];

    const etapasMap = {};

    // Agrupar por etapa
    orcamento.itens.forEach(item => {
      const etapa = item.etapa || 'Sem Etapa';
      if (!etapasMap[etapa]) {
        etapasMap[etapa] = {
          etapa,
          orcado: 0,
          medido: 0,
          planejado: 0,
          itens: []
        };
      }

      etapasMap[etapa].orcado += item.valor_total || 0;
      etapasMap[etapa].planejado += cff?.[item.id]?.percentual_planejado || 0;

      const medidoItem = medicoes.reduce((acc, m) => {
        const mi = m.itens?.find(x => x.item_orcamento_id === item.id);
        return acc + (mi?.valor_medido || 0);
      }, 0);

      etapasMap[etapa].medido += medidoItem;
      etapasMap[etapa].itens.push({ id: item.id, desc: item.descricao, medido: medidoItem });
    });

    return Object.values(etapasMap).map(e => ({
      etapa: e.etapa,
      orcado: e.orcado,
      medido: e.medido,
      percentualMedido: (e.medido / e.orcado) * 100,
      percentualPlanejado: e.planejado > 0 ? e.planejado / e.itens.length : 0,
      desvio: ((e.medido / e.orcado) * 100) - (e.planejado > 0 ? e.planejado / e.itens.length : 0)
    }));
  }, [orcamento, medicoes, cff]);

  const getCorDesvio = (desvio) => {
    if (desvio > 10) return '#ef4444';
    if (desvio > 0) return '#f59e0b';
    return '#10b981';
  };

  const exportarPDF = () => {
    const elemento = document.getElementById('relatorio-comparativo');
    // Implementar exportação com html2canvas se necessário
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Medição vs Planejado</h3>
        <Button onClick={exportarPDF} size="sm" variant="outline">
          <Download className="w-4 h-4 mr-1" /> Exportar
        </Button>
      </div>

      {/* Gráfico Comparativo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo por Etapa (%)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etapa" angle={-45} textAnchor="end" height={80} interval={0} />
              <YAxis label={{ value: 'Percentual (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="percentualMedido" fill="#3b82f6" name="Medido" />
              <Bar dataKey="percentualPlanejado" fill="#10b981" name="Planejado" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Desvio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desvio Medido vs Planejado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etapa" angle={-45} textAnchor="end" height={80} interval={0} />
              <YAxis label={{ value: 'Desvio (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
              <Legend />
              <Line type="monotone" dataKey="desvio" stroke="#ef4444" strokeWidth={2} name="Desvio" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" id="relatorio-comparativo">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="text-left p-3 font-semibold">Etapa</th>
                  <th className="text-right p-3 font-semibold">Orçado</th>
                  <th className="text-right p-3 font-semibold">Medido</th>
                  <th className="text-right p-3 font-semibold">% Medido</th>
                  <th className="text-right p-3 font-semibold">% Planejado</th>
                  <th className="text-right p-3 font-semibold">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{row.etapa}</td>
                    <td className="text-right p-3">R$ {row.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right p-3">R$ {row.medido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right p-3">
                      <Badge className={row.percentualMedido > 75 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {row.percentualMedido.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="text-right p-3">{row.percentualPlanejado.toFixed(1)}%</td>
                    <td className="text-right p-3">
                      <Badge style={{ backgroundColor: getCorDesvio(row.desvio), color: 'white' }}>
                        {row.desvio > 0 ? '+' : ''}{row.desvio.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span>Total Orçado:</span>
            <span className="font-semibold">R$ {dados.reduce((acc, d) => acc + d.orcado, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Medido:</span>
            <span className="font-semibold">R$ {dados.reduce((acc, d) => acc + d.medido, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span>% Médio de Conclusão:</span>
            <span className="font-semibold">{(dados.reduce((acc, d) => acc + d.percentualMedido, 0) / dados.length).toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}