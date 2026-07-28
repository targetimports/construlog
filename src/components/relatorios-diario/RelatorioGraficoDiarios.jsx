import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export default function RelatorioGraficoDiarios({ obraId }) {
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [resultado, setResultado] = useState(null);

  const gerarMutation = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('gerarRelatorioGraficoDiarios', {
        obraId,
        dataInicio,
        dataFim,
        status: 'finalizado'
      });
    },
    onSuccess: (data) => {
      setResultado(data.data);
      toast.success('Relatório gerado com sucesso');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full p-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full p-2 border rounded text-sm"
              />
            </div>
          </div>
          <Button
            onClick={() => gerarMutation.mutate()}
            disabled={gerarMutation.isPending}
            className="w-full gap-2"
          >
            {gerarMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Gerar Relatório</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-blue-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Total de RDOs</p>
                <p className="text-2xl font-bold">{resultado.estatisticas.total_diarios}</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Atividades</p>
                <p className="text-2xl font-bold">{resultado.estatisticas.total_atividades}</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Ocorrências</p>
                <p className="text-2xl font-bold">{resultado.estatisticas.total_ocorrencias}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Arquivos</p>
                <p className="text-2xl font-bold">{resultado.estatisticas.total_arquivos}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Clima */}
          {resultado.graficos.clima.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Distribuição de Clima</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={resultado.graficos.clima}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ nome, valor }) => `${nome}: ${valor}`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="valor"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Gráfico Mão de Obra */}
          {resultado.graficos.mao_obra.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top 10 - Mão de Obra (dias)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={resultado.graficos.mao_obra}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="dias" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Gráfico Equipamentos */}
          {resultado.graficos.equipamentos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top 10 - Equipamentos (horas)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={resultado.graficos.equipamentos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="horas" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela Ocorrências */}
          {resultado.graficos.ocorrencias.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ocorrências Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {resultado.graficos.ocorrencias.map((oc, idx) => (
                    <div key={idx} className="flex justify-between p-2 border-b text-sm">
                      <span className="font-medium">{oc.tipo}</span>
                      <span className="font-bold">{oc.quantidade}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}