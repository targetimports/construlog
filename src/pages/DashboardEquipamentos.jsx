import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wrench, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Activity,
  DollarSign,
  Calendar,
  BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

export default function DashboardEquipamentos() {
  const navigate = useNavigate();

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-equipamento'],
    queryFn: () => base44.entities.SolicitacaoEquipamento.list('-created_date', 100)
  });

  const { data: registrosUso = [] } = useQuery({
    queryKey: ['registros-uso'],
    queryFn: () => base44.entities.RegistroUsoEquipamento.list('-created_date', 200)
  });

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes-equipamento'],
    queryFn: () => base44.entities.ManutencaoEquipamento.list('-created_date', 100)
  });

  // Métricas gerais
  const metricas = useMemo(() => {
    const total = equipamentos.length;
    const ativos = equipamentos.filter(e => e.status === 'ativo').length;
    const manutencao = equipamentos.filter(e => e.status === 'manutencao').length;
    
    const solicitacoesPendentes = solicitacoes.filter(s => s.status === 'pendente').length;
    
    const custosManutencao = manutencoes.reduce((acc, m) => acc + (m.custo_total || 0), 0);
    
    const manutencoesUrgentes = manutencoes.filter(m => 
      m.status !== 'concluida' && m.prioridade === 'urgente'
    ).length;

    return {
      total,
      ativos,
      manutencao,
      solicitacoesPendentes,
      custosManutencao,
      manutencoesUrgentes
    };
  }, [equipamentos, solicitacoes, manutencoes]);

  // Taxa de utilização por equipamento
  const utilizacaoPorEquipamento = useMemo(() => {
    return equipamentos.map(eq => {
      const usos = registrosUso.filter(r => r.equipamento_id === eq.id);
      const horasTotais = usos.reduce((acc, r) => acc + (r.horas_trabalhadas || 0), 0);

      // Assumindo 8 horas/dia útil, 22 dias/mês
      const horasDisponiveis = 176; // ~1 mês
      const taxaUtilizacao = horasDisponiveis > 0 ? (horasTotais / horasDisponiveis) * 100 : 0;

      return {
        nome: eq.nome || 'Sem nome',
        horasUso: horasTotais,
        taxaUtilizacao: Math.min(taxaUtilizacao, 100),
        status: eq.status
      };
    })
    .sort((a, b) => b.taxaUtilizacao - a.taxaUtilizacao)
    .slice(0, 10);
  }, [equipamentos, registrosUso]);

  // Custos de manutenção por mês
  const custosPorMes = useMemo(() => {
    const mesesData = {};
    
    manutencoes.forEach(m => {
      if (m.data_realizada && m.custo_total) {
        const data = new Date(m.data_realizada);
        const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
        
        if (!mesesData[mesAno]) {
          mesesData[mesAno] = { mes: mesAno, preventiva: 0, corretiva: 0 };
        }
        
        if (m.tipo === 'preventiva') {
          mesesData[mesAno].preventiva += m.custo_total;
        } else {
          mesesData[mesAno].corretiva += m.custo_total;
        }
      }
    });

    return Object.values(mesesData)
      .sort((a, b) => {
        const [mesA, anoA] = a.mes.split('/').map(Number);
        const [mesB, anoB] = b.mes.split('/').map(Number);
        return anoA - anoB || mesA - mesB;
      })
      .slice(-6);
  }, [manutencoes]);

  // Distribuição por status
  const equipamentosPorStatus = useMemo(() => {
    const statusCount = {
      ativo: equipamentos.filter(e => e.status === 'ativo').length,
      manutencao: equipamentos.filter(e => e.status === 'manutencao').length,
      aposentado: equipamentos.filter(e => e.status === 'aposentado').length
    };

    return [
      { name: 'Ativo', value: statusCount.ativo },
      { name: 'Manutenção', value: statusCount.manutencao },
      { name: 'Aposentado', value: statusCount.aposentado }
    ].filter(item => item.value > 0);
  }, [equipamentos]);

  // Próximas manutenções
  const proximasManutencoes = useMemo(() => {
    return manutencoes
      .filter(m => m.status === 'agendada')
      .sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada))
      .slice(0, 5);
  }, [manutencoes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Equipamentos</h1>
          <p className="text-gray-600 mt-1">Visão completa de uso, disponibilidade e manutenção</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(createPageUrl('Equipamentos'))}>
            <Wrench className="w-4 h-4 mr-2" />
            Gerenciar Equipamentos
          </Button>
          <Button onClick={() => navigate(createPageUrl('SolicitacaoEquipamentos'))} variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Solicitar Equipamento
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Equipamentos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metricas.total}</p>
                <p className="text-sm text-emerald-600 mt-1">{metricas.ativos} ativos</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Solicitações Pendentes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metricas.solicitacoesPendentes}</p>
                <p className="text-sm text-amber-600 mt-1">Aguardando aprovação</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Manutenções Urgentes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metricas.manutencoesUrgentes}</p>
                <p className="text-sm text-red-600 mt-1">Requer atenção</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Custos de Manutenção</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {metricas.custosManutencao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-sm text-gray-600 mt-1">Total acumulado</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de Utilização */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle>Taxa de Utilização por Equipamento</CardTitle>
          </CardHeader>
          <CardContent>
            {utilizacaoPorEquipamento.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm">Sem registros de uso ainda</p>
              </div>
            ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizacaoPorEquipamento} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="nome" type="category" width={100} fontSize={11} />
                  <Tooltip 
                    formatter={(value) => `${value.toFixed(1)}%`}
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="taxaUtilizacao" fill="#3B82F6" radius={[0, 8, 8, 0]} name="Utilização %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Status dos Equipamentos */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {equipamentosPorStatus.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                <Activity className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm">Nenhum equipamento cadastrado</p>
              </div>
            ) : (
            <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={equipamentosPorStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {equipamentosPorStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {equipamentosPorStatus.map((item, index) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
            </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custos de Manutenção */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle>Custos de Manutenção (Preventiva vs Corretiva)</CardTitle>
        </CardHeader>
        <CardContent>
          {custosPorMes.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-gray-400">
              <DollarSign className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma manutenção concluída com custo registrado</p>
            </div>
          ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={custosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="preventiva" stroke="#10B981" strokeWidth={2} name="Preventiva" />
                <Line type="monotone" dataKey="corretiva" stroke="#EF4444" strokeWidth={2} name="Corretiva" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Próximas Manutenções */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Próximas Manutenções Agendadas
            <Badge variant="secondary">{proximasManutencoes.length} agendadas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {proximasManutencoes.map(manutencao => {
              const equipamento = equipamentos.find(e => e.id === manutencao.equipamento_id);
              const diasRestantes = Math.ceil((new Date(manutencao.data_programada) - new Date()) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={manutencao.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      manutencao.tipo === 'preventiva' ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      <Wrench className={`w-5 h-5 ${
                        manutencao.tipo === 'preventiva' ? 'text-blue-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{equipamento?.nome || 'Equipamento'}</p>
                      <p className="text-sm text-gray-600">{manutencao.descricao}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={manutencao.prioridade === 'urgente' ? 'destructive' : 'secondary'}>
                      {manutencao.tipo}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {diasRestantes > 0 ? `em ${diasRestantes} dias` : 'Atrasada'}
                    </p>
                  </div>
                </div>
              );
            })}
            {proximasManutencoes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Nenhuma manutenção agendada</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}