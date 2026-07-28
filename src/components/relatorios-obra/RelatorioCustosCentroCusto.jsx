import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Package, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function RelatorioCustosCentroCusto({ obraId, periodoInicio, periodoFim }) {
  const { data: obras = [], isLoading: obrasLoading } = useQuery({
    queryKey: ['obras', obraId],
    queryFn: async () => {
      if (obraId) {
        return base44.entities.Obra.filter({ id: obraId });
      }
      return base44.entities.Obra.filter({ 
        status: { $in: ['em_andamento', 'a_iniciar', 'orcamento'] } 
      });
    }
  });

  const { data: contas = [], isLoading: contasLoading } = useQuery({
    queryKey: ['contas-financeiras', obraId, periodoInicio, periodoFim],
    queryFn: async () => {
      const todasContas = await base44.entities.ContaFinanceira.list();
      
      return todasContas.filter(conta => {
        if (obraId && conta.obra_id !== obraId) return false;
        if (conta.tipo !== 'pagar') return false;
        
        if (periodoInicio && conta.data_vencimento < periodoInicio) return false;
        if (periodoFim && conta.data_vencimento > periodoFim) return false;
        
        return true;
      });
    }
  });

  const { data: orcamentos = [], isLoading: orcamentosLoading } = useQuery({
    queryKey: ['orcamentos', obraId],
    queryFn: async () => {
      const todosOrcamentos = await base44.entities.OrcamentoObra.list();
      
      return todosOrcamentos.filter(orc => {
        if (obraId && orc.obra_id !== obraId) return false;
        return orc.status === 'aprovado';
      });
    }
  });

  if (obrasLoading || contasLoading || orcamentosLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Agrupar custos por centro de custo
  const custosPorCentro = obras.reduce((acc, obra) => {
    const centroCusto = obra.centro_custo || 'Não definido';
    
    if (!acc[centroCusto]) {
      acc[centroCusto] = {
        obras: [],
        custoRealizado: 0,
        custoOrcado: 0
      };
    }
    
    acc[centroCusto].obras.push(obra.nome);
    
    // Custos realizados
    const custosObra = contas
      .filter(c => c.obra_id === obra.id && c.status === 'pago')
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    acc[centroCusto].custoRealizado += custosObra;
    
    // Custos orçados
    acc[centroCusto].custoOrcado += obra.valor_orcado || 0;
    
    return acc;
  }, {});

  // Dados para gráfico de pizza
  const dadosPizza = Object.entries(custosPorCentro).map(([centro, dados]) => ({
    name: centro,
    value: dados.custoRealizado
  }));

  const totalCustos = dadosPizza.reduce((sum, item) => sum + item.value, 0);

  // Custos por categoria
  const custosPorCategoria = contas.reduce((acc, conta) => {
    const categoria = conta.categoria || 'outros';
    if (!acc[categoria]) {
      acc[categoria] = 0;
    }
    if (conta.status === 'pago') {
      acc[categoria] += conta.valor || 0;
    }
    return acc;
  }, {});

  const categoriasOrdenadas = Object.entries(custosPorCategoria)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Resumo Total */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Total de Centros</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {Object.keys(custosPorCentro).length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Custo Total Realizado</span>
          </div>
          <p className="text-2xl font-bold text-orange-900">
            {totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Obras Monitoradas</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {obras.length}
          </p>
        </div>
      </div>

      {/* Gráfico de Pizza */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribuição por Centro de Custo
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosPizza}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {dadosPizza.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => 
                  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Custos por Categoria
          </h3>
          <div className="space-y-3">
            {categoriasOrdenadas.map(([categoria, valor], idx) => {
              const porcentagem = totalCustos > 0 ? (valor / totalCustos) * 100 : 0;
              return (
                <div key={categoria}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {categoria.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${porcentagem}%`,
                        backgroundColor: COLORS[idx % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela Detalhada por Centro */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Detalhamento por Centro de Custo
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Centro de Custo
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Obras
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  Orçado
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  Realizado
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  Desvio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(custosPorCentro).map(([centro, dados], idx) => {
                const desvio = dados.custoOrcado > 0 
                  ? ((dados.custoRealizado - dados.custoOrcado) / dados.custoOrcado) * 100 
                  : 0;
                
                return (
                  <tr key={centro} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{centro}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {dados.obras.map((obra, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {obra}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium">
                      {dados.custoOrcado.toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {dados.custoRealizado.toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${
                      desvio > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {desvio.toFixed(1)}%
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