import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Download, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DashboardExecutivo() {
  const [periodo, setPeriodo] = useState('mes');
  const [customizar, setCustomizar] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const totalOrcado = obras.reduce((sum, o) => sum + (o.total_final_orcamento || 0), 0);
  const totalRealizado = medicoes.reduce((sum, m) => sum + (m.valor_total_realizado || 0), 0);
  const margemLucrativa = ((totalOrcado - totalRealizado) / totalOrcado * 100) || 0;
  const totalFolha = colaboradores.filter(c => c.status === 'ativo').reduce((sum, c) => sum + (c.salario || 0), 0);
  const obrasConcluidas = obras.filter(o => o.status === 'concluida').length;
  const obrasAtraso = obras.filter(o => new Date(o.data_prevista_fim) < new Date()).length;

  const chartData = [
    { mes: 'Jan', orcado: totalOrcado * 0.2, realizado: totalRealizado * 0.15 },
    { mes: 'Fev', orcado: totalOrcado * 0.25, realizado: totalRealizado * 0.2 },
    { mes: 'Mar', orcado: totalOrcado * 0.3, realizado: totalRealizado * 0.28 }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Executivo</h1>
          <p className="text-gray-600 mt-1">Visão estratégica da empresa</p>
        </div>
        <div className="flex gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Este Ano</option>
          </select>
          <Button variant="outline" onClick={() => setCustomizar(!customizar)}>
            <Filter className="w-4 h-4 mr-2" />
            Customizar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">Orçado</p>
            <p className="text-xl font-bold">R$ {(totalOrcado / 1000000).toFixed(1)}M</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">Realizado</p>
            <p className="text-xl font-bold">R$ {(totalRealizado / 1000000).toFixed(1)}M</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">Margem</p>
            <p className={`text-xl font-bold ${margemLucrativa > 0 ? 'text-green-600' : 'text-red-600'}`}>{margemLucrativa.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">Folha Mensal</p>
            <p className="text-xl font-bold">R$ {(totalFolha / 1000).toFixed(0)}K</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">Concluídas</p>
            <p className="text-xl font-bold text-green-600">{obrasConcluidas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">Em Atraso</p>
            <p className="text-xl font-bold text-red-600">{obrasAtraso}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financeiro">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="rh">RH</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle>Evolução Orçado vs Realizado</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(v) => `R$ ${(v / 1000).toFixed(0)}K`} />
                  <Legend />
                  <Bar dataKey="orcado" fill="#3b82f6" name="Orçado" />
                  <Bar dataKey="realizado" fill="#10b981" name="Realizado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operacional">
          <Card>
            <CardHeader>
              <CardTitle>Status das Obras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-gray-600">Em Andamento</p>
                  <p className="text-2xl font-bold text-blue-600">{obras.filter(o => o.status === 'em_andamento').length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Concluídas</p>
                  <p className="text-2xl font-bold text-green-600">{obrasConcluidas}</p>
                </div>
                <div>
                  <p className="text-gray-600">Atrasadas</p>
                  <p className="text-2xl font-bold text-red-600">{obrasAtraso}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rh">
          <Card>
            <CardHeader>
              <CardTitle>Quadro de Pessoal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{colaboradores.length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{colaboradores.filter(c => c.status === 'ativo').length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Folha Mensal</p>
                  <p className="text-lg font-bold">R$ {(totalFolha / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}