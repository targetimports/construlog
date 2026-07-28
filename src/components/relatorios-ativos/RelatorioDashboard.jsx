import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import StatCard from '../dashboard/StatCard';
import { Package, AlertCircle, CheckCircle2, Wrench } from 'lucide-react';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

export default function RelatorioDashboard({ ativos }) {
  // Estatísticas gerais
  const totalAtivos = ativos.length;
  const disponiveis = ativos.filter(a => a.status === 'disponivel').length;
  const emUso = ativos.filter(a => a.status === 'em_uso').length;
  const manutencao = ativos.filter(a => a.status === 'manutencao').length;
  const inativos = ativos.filter(a => a.status === 'inativo').length;
  const pct = (n) => (totalAtivos > 0 ? ((n / totalAtivos) * 100).toFixed(0) : 0);

  // Ativos por tipo
  const ativosPorTipo = [
    { name: 'Ferramenta', value: ativos.filter(a => a.tipo === 'ferramenta').length },
    { name: 'Equipamento', value: ativos.filter(a => a.tipo === 'equipamento').length },
    { name: 'Máquina', value: ativos.filter(a => a.tipo === 'maquina').length },
    { name: 'Veículo', value: ativos.filter(a => a.tipo === 'veiculo_pequeno').length },
    { name: 'Outros', value: ativos.filter(a => !['ferramenta', 'equipamento', 'maquina', 'veiculo_pequeno'].includes(a.tipo)).length }
  ].filter(item => item.value > 0);

  // Ativos por localização
  const ativosPorLocalizacao = [
    { name: 'Almoxarifado', value: ativos.filter(a => a.localizacao_atual === 'almoxarifado').length },
    { name: 'Em Obra', value: ativos.filter(a => a.localizacao_atual === 'em_obra').length },
    { name: 'Em Trânsito', value: ativos.filter(a => a.localizacao_atual === 'em_transito').length }
  ].filter(item => item.value > 0);

  if (totalAtivos === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="py-16 text-center text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhum ativo encontrado para os filtros selecionados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Ativos"
          value={totalAtivos}
          subtitle="Patrimônio total"
          icon={Package}
        />
        <StatCard
          title="Disponíveis"
          value={disponiveis}
          subtitle={`${pct(disponiveis)}% do total`}
          icon={CheckCircle2}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Em Uso"
          value={emUso}
          subtitle={`${pct(emUso)}% do total`}
          icon={CheckCircle2}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Manutenção"
          value={manutencao}
          subtitle={`${pct(manutencao)}% do total`}
          icon={Wrench}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Disponível', value: disponiveis },
                      { name: 'Em Uso', value: emUso },
                      { name: 'Manutenção', value: manutencao },
                      { name: 'Inativo', value: inativos }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-gray-500">Disponível: {disponiveis}</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-gray-500">Em Uso: {emUso}</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-gray-500">Manutenção: {manutencao}</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-gray-500">Inativo: {inativos}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Tipos */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Ativos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ativosPorTipo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#F59E0B" radius={[8, 8, 0, 0]} maxBarSize={80} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Localização */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Ativos por Localização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ativosPorLocalizacao.map((local, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-500">{local.name}</span>
                  <Badge className="bg-blue-100 text-blue-700 border-0">{local.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}