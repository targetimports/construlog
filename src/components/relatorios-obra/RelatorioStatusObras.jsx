import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Building2, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const statusConfig = {
  orcamento: { label: 'Em Orçamento', color: 'bg-blue-100 text-blue-700', icon: Clock },
  a_iniciar: { label: 'A Iniciar', color: 'bg-purple-100 text-purple-700', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-green-100 text-green-700', icon: TrendingUp },
  pausada: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  concluida: { label: 'Concluída', color: 'bg-gray-100 text-gray-700', icon: CheckCircle },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
};

export default function RelatorioStatusObras({ periodoInicio, periodoFim }) {
  const { data: obras = [], isLoading: obrasLoading } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: async () => {
      const todasObras = await base44.entities.Obra.list();
      
      return todasObras.filter(obra => {
        // Filtrar apenas obras ativas
        if (!['em_andamento', 'a_iniciar', 'orcamento', 'pausada'].includes(obra.status)) {
          return false;
        }
        
        if (periodoInicio && obra.data_inicio && obra.data_inicio < periodoInicio) return false;
        if (periodoFim && obra.data_inicio && obra.data_inicio > periodoFim) return false;
        
        return true;
      });
    }
  });

  const { data: medicoes = [], isLoading: medicoesLoading } = useQuery({
    queryKey: ['medicoes-obras'],
    queryFn: () => base44.entities.Medicao.list()
  });

  if (obrasLoading || medicoesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  // Estatísticas por status
  const estatisticasPorStatus = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = obras.filter(o => o.status === status).length;
    return acc;
  }, {});

  const dadosGrafico = Object.entries(estatisticasPorStatus).map(([status, quantidade]) => ({
    status: statusConfig[status]?.label || status,
    quantidade
  }));

  // Calcular dados de cada obra
  const obrasComDetalhes = obras.map(obra => {
    const medicoesObra = medicoes.filter(m => m.obra_id === obra.id);
    const faturado = medicoesObra.reduce((sum, m) => sum + (m.valor_total || 0), 0);
    const percentualFaturado = obra.valor_contrato > 0 
      ? (faturado / obra.valor_contrato) * 100 
      : 0;
    
    // Calcular dias restantes
    let diasRestantes = null;
    if (obra.data_prevista_fim) {
      const hoje = new Date();
      const dataFim = new Date(obra.data_prevista_fim);
      diasRestantes = Math.ceil((dataFim - hoje) / (1000 * 60 * 60 * 24));
    }

    return {
      ...obra,
      faturado,
      percentualFaturado,
      diasRestantes
    };
  });

  const totalObras = obras.length;
  const valorTotalContratos = obras.reduce((sum, o) => sum + (o.valor_contrato || 0), 0);
  const obrasEmRisco = obrasComDetalhes.filter(o => 
    o.diasRestantes !== null && o.diasRestantes < 30 && o.percentual_concluido < 80
  ).length;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Total de Obras</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{totalObras}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Em Andamento</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {estatisticasPorStatus.em_andamento}
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-900">Em Risco</span>
          </div>
          <p className="text-2xl font-bold text-yellow-900">{obrasEmRisco}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Valor Total</span>
          </div>
          <p className="text-lg font-bold text-purple-900">
            {valorTotalContratos.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              notation: 'compact'
            })}
          </p>
        </div>
      </div>

      {/* Gráfico de Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Distribuição por Status
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dadosGrafico}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="quantidade" fill="#3B82F6" name="Quantidade de Obras" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Obras Ativas - Visão Detalhada
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Obra</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Progresso</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Valor Contrato</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Faturado</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {obrasComDetalhes.map(obra => {
                const config = statusConfig[obra.status] || statusConfig.em_andamento;
                const Icon = config.icon;
                
                return (
                  <tr key={obra.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{obra.nome}</p>
                        <p className="text-sm text-gray-500">{obra.cliente}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={config.color}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Físico</span>
                          <span>{obra.percentual_concluido || 0}%</span>
                        </div>
                        <Progress value={obra.percentual_concluido || 0} className="h-2" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium">
                      {(obra.valor_contrato || 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="text-sm text-gray-900 font-medium">
                          {obra.faturado.toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {obra.percentualFaturado.toFixed(1)}%
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {obra.diasRestantes !== null ? (
                        <Badge 
                          variant="outline"
                          className={
                            obra.diasRestantes < 0 
                              ? 'border-red-300 text-red-700' 
                              : obra.diasRestantes < 30 
                              ? 'border-yellow-300 text-yellow-700' 
                              : 'border-green-300 text-green-700'
                          }
                        >
                          {obra.diasRestantes < 0 
                            ? `${Math.abs(obra.diasRestantes)}d atrasado` 
                            : `${obra.diasRestantes}d restantes`
                          }
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">Não definido</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}