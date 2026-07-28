import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function RelatoriosMedicao({ obra_id }) {
  const [tipoAtivo, setTipoAtivo] = useState('medicao');

  const { data: relatorio, isLoading, refetch } = useQuery({
    queryKey: ['relatorio-medicao', obra_id, tipoAtivo],
    queryFn: async () => {
      const response = await base44.functions.invoke('gerarRelatorioMedicao', {
        obra_id,
        tipo_relatorio: tipoAtivo
      });
      return response.dados;
    },
    enabled: !!obra_id
  });

  const exportarCSV = () => {
    if (!relatorio || relatorio.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = Object.keys(relatorio[0]);
    const csv = [
      headers.join(','),
      ...relatorio.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_${tipoAtivo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Relatório exportado');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Relatórios de Medição
        </CardTitle>
        <Button onClick={exportarCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tipoAtivo} onValueChange={setTipoAtivo}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="medicao">Medições</TabsTrigger>
            <TabsTrigger value="consumo">Consumo</TabsTrigger>
            <TabsTrigger value="equipamento">Equipamentos</TabsTrigger>
            <TabsTrigger value="desvio">Desvio</TabsTrigger>
          </TabsList>

          <TabsContent value="medicao" className="space-y-3 mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qtd</th>
                    <th className="px-4 py-2 text-right">Material</th>
                    <th className="px-4 py-2 text-right">Mão Obra</th>
                    <th className="px-4 py-2 text-right">Equipamento</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-left">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio?.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{row.data}</td>
                      <td className="px-4 py-2 text-sm">{row.item}</td>
                      <td className="px-4 py-2 text-right">{row.quantidade} {row.unidade}</td>
                      <td className="px-4 py-2 text-right">R$ {row.custo_material.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">R$ {row.custo_mao_obra.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">R$ {row.custo_equipamento.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">R$ {row.custo_total.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm">{row.responsavel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="consumo" className="space-y-3 mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Insumo</th>
                    <th className="px-4 py-2 text-right">Quantidade</th>
                    <th className="px-4 py-2 text-right">Custo Total</th>
                    <th className="px-4 py-2 text-right">Custo Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio?.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{row.insumo_id}</td>
                      <td className="px-4 py-2 text-right">{row.quantidade_consumida.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">R$ {row.valor_total.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">R$ {row.custo_medio.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="equipamento" className="space-y-3 mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Equipamento</th>
                    <th className="px-4 py-2 text-left">Data Início</th>
                    <th className="px-4 py-2 text-right">Horas</th>
                    <th className="px-4 py-2 text-right">Custo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio?.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{row.equipamento_id}</td>
                      <td className="px-4 py-2 text-sm">{row.data_inicio}</td>
                      <td className="px-4 py-2 text-right">{row.horas_utilizadas.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">R$ {row.custo_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="desvio" className="space-y-3 mt-4">
            <div className="space-y-2">
              {relatorio?.map((row, i) => (
                <div key={i} className="border rounded p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{row.item}</h4>
                    <span className={`text-sm font-bold ${row.desvio_percentual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {row.desvio_percentual > 0 ? '+' : ''}{row.desvio_percentual}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>Previsto: R$ {row.custo_previsto.toFixed(2)}</p>
                    <p>Realizado: R$ {row.custo_realizado.toFixed(2)}</p>
                    <p>Qtd Prevista: {row.quantidade_prevista}</p>
                    <p>Qtd Executada: {row.quantidade_executada}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}