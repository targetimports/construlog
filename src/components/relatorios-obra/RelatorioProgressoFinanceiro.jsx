import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function RelatorioProgressoFinanceiro({ obraId, periodoInicio, periodoFim }) {
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
      let filter = {};
      
      if (obraId) {
        filter.obra_id = obraId;
      }
      
      const todasContas = await base44.entities.ContaFinanceira.list();
      
      return todasContas.filter(conta => {
        if (obraId && conta.obra_id !== obraId) return false;
        
        if (periodoInicio && conta.data_vencimento < periodoInicio) return false;
        if (periodoFim && conta.data_vencimento > periodoFim) return false;
        
        return true;
      });
    }
  });

  const { data: medicoes = [], isLoading: medicoesLoading } = useQuery({
    queryKey: ['medicoes', obraId, periodoInicio, periodoFim],
    queryFn: async () => {
      const todasMedicoes = await base44.entities.Medicao.list();
      
      return todasMedicoes.filter(medicao => {
        if (obraId && medicao.obra_id !== obraId) return false;
        
        if (periodoInicio && medicao.data_medicao < periodoInicio) return false;
        if (periodoFim && medicao.data_medicao > periodoFim) return false;
        
        return true;
      });
    }
  });

  if (obrasLoading || contasLoading || medicoesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  // Calcular dados financeiros
  const dadosFinanceiros = obras.map(obra => {
    const orcado = obra.valor_orcado || 0;
    const realizado = contas
      .filter(c => c.obra_id === obra.id && c.tipo === 'pagar' && c.status === 'pago')
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    const faturado = medicoes
      .filter(m => m.obra_id === obra.id && m.status === 'aprovada')
      .reduce((sum, m) => sum + (m.valor_total || 0), 0);

    return {
      nome: obra.nome,
      orcado,
      realizado,
      faturado,
      saldo: orcado - realizado,
      desvio: ((realizado - orcado) / orcado) * 100
    };
  });

  const totais = dadosFinanceiros.reduce((acc, item) => ({
    orcado: acc.orcado + item.orcado,
    realizado: acc.realizado + item.realizado,
    faturado: acc.faturado + item.faturado,
    saldo: acc.saldo + item.saldo
  }), { orcado: 0, realizado: 0, faturado: 0, saldo: 0 });

  const desvioPorcentual = totais.orcado > 0 
    ? ((totais.realizado - totais.orcado) / totais.orcado) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Orçado</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {totais.orcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Realizado</span>
          </div>
          <p className="text-2xl font-bold text-orange-900">
            {totais.realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Faturado</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {totais.faturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className={`bg-gradient-to-br rounded-lg p-4 border ${
          desvioPorcentual > 0 
            ? 'from-red-50 to-red-100 border-red-200' 
            : 'from-emerald-50 to-emerald-100 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {desvioPorcentual > 0 ? (
              <TrendingUp className="w-5 h-5 text-red-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-emerald-600" />
            )}
            <span className={`text-sm font-medium ${
              desvioPorcentual > 0 ? 'text-red-900' : 'text-emerald-900'
            }`}>
              Desvio
            </span>
          </div>
          <p className={`text-2xl font-bold ${
            desvioPorcentual > 0 ? 'text-red-900' : 'text-emerald-900'
          }`}>
            {desvioPorcentual.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Gráfico Comparativo */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Comparativo: Orçado vs Realizado vs Faturado
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dadosFinanceiros}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="nome" 
              angle={-45}
              textAnchor="end"
              height={100}
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              tickFormatter={(value) => 
                `R$ ${(value / 1000).toFixed(0)}k`
              }
            />
            <Tooltip 
              formatter={(value) => 
                value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              }
            />
            <Legend />
            <Bar dataKey="orcado" fill="#3B82F6" name="Orçado" />
            <Bar dataKey="realizado" fill="#F97316" name="Realizado" />
            <Bar dataKey="faturado" fill="#10B981" name="Faturado" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Obra</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Orçado</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Realizado</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Faturado</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Saldo</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Desvio %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dadosFinanceiros.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{item.nome}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                  {item.orcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900">
                  {item.realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900">
                  {item.faturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${
                  item.saldo >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {item.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-bold ${
                  item.desvio > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {item.desvio.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}