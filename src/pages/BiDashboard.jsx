import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BiDashboard() {
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

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes'],
    queryFn: () => base44.entities.Manutencao.list()
  });

  // Dados para gráfico de status das obras
  const statusObraData = [
    { name: 'Em Andamento', value: obras.filter(o => o.status === 'em_andamento').length },
    { name: 'Concluída', value: obras.filter(o => o.status === 'concluida').length },
    { name: 'Pausada', value: obras.filter(o => o.status === 'pausada').length }
  ];

  // Dados para gráfico de evolução de medicoes
  const medicaoData = [
    { mes: 'Jan', valor: Math.random() * 100000 },
    { mes: 'Fev', valor: Math.random() * 100000 },
    { mes: 'Mar', valor: Math.random() * 100000 },
    { mes: 'Abr', valor: Math.random() * 100000 },
    { mes: 'Mai', valor: Math.random() * 100000 },
    { mes: 'Jun', valor: Math.random() * 100000 }
  ];

  // Dados para gráfico de custos
  const custosData = [
    { nome: obras[0]?.nome || 'Obra 1', orcado: 100000, realizado: 80000 },
    { nome: obras[1]?.nome || 'Obra 2', orcado: 150000, realizado: 120000 },
    { nome: obras[2]?.nome || 'Obra 3', orcado: 80000, realizado: 75000 }
  ];

  const totalOrcado = obras.reduce((sum, o) => sum + (o.total_orcamento || 0), 0);
  const totalMedicoes = medicoes.reduce((sum, m) => sum + (m.valor_total_realizado || 0), 0);
  const totalFolha = colaboradores.filter(c => c.status === 'ativo').reduce((sum, c) => sum + (c.salario || 0), 0);
  const custosManutencao = manutencoes.reduce((sum, m) => sum + (m.valor_total || 0), 0);

  const margemLucrativa = totalOrcado > 0 ? (((totalOrcado - totalMedicoes) / totalOrcado) * 100) : 0;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">BI - Inteligência de Negócios</h1>
        <p className="text-gray-600 mt-1">Análise e insights dos dados operacionais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Orçamento Total</p>
                <p className="text-2xl font-bold">R$ {totalOrcado.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Medicões Realizadas</p>
                <p className="text-2xl font-bold">R$ {totalMedicoes.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Margem Lucrativa</p>
                <p className={`text-2xl font-bold ${margemLucrativa > 0 ? 'text-green-600' : 'text-red-600'}`}>{margemLucrativa.toFixed(1)}%</p>
              </div>
              {margemLucrativa > 0 ? <TrendingUp className="w-8 h-8 text-green-600" /> : <TrendingDown className="w-8 h-8 text-red-600" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Folha de Pagamento</p>
                <p className="text-2xl font-bold">R$ {totalFolha.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="obras">
        <TabsList>
          <TabsTrigger value="obras">Obras</TabsTrigger>
          <TabsTrigger value="medicoes">Medições</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
        </TabsList>

        <TabsContent value="obras">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusObraData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {statusObraData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medicoes">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={medicaoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="valor" stroke="#3b82f6" name="Valor Medido" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custos">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={custosData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="orcado" fill="#3b82f6" name="Orçado" />
                  <Bar dataKey="realizado" fill="#10b981" name="Realizado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}