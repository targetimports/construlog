import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function FluxoCaixaProjetado({ obraId, periodo }) {
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtradas', obraId],
    queryFn: async () => {
      if (obraId === 'todas') {
        return base44.entities.Obra.filter({ status: 'em_andamento' });
      }
      const obra = await base44.entities.Obra.filter({ id: obraId });
      return obra;
    }
  });

  const { data: fluxos = [], isLoading } = useQuery({
    queryKey: ['fluxo-caixa', obraId, periodo],
    queryFn: async () => {
      const results = [];
      
      for (const obra of obras) {
        try {
          // Buscar contas a pagar e receber
          const contasPagar = await base44.entities.ContaFinanceira.filter({
            obra_id: obra.id,
            tipo: 'pagar',
            status: 'pendente'
          });
          
          const contasReceber = await base44.entities.ContaFinanceira.filter({
            obra_id: obra.id,
            tipo: 'receber',
            status: 'pendente'
          });

          // Agrupar por mês
          const meses = {};
          const hoje = new Date();
          
          for (let i = 0; i < 6; i++) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
            const mesAno = `${data.toLocaleString('pt-BR', { month: 'short' })}/${data.getFullYear().toString().slice(-2)}`;
            meses[mesAno] = { mes: mesAno, entradas: 0, saidas: 0, saldo: 0 };
          }

          // Processar contas
          contasPagar.forEach(conta => {
            if (conta.data_vencimento) {
              const data = new Date(conta.data_vencimento);
              const mesAno = `${data.toLocaleString('pt-BR', { month: 'short' })}/${data.getFullYear().toString().slice(-2)}`;
              if (meses[mesAno]) {
                meses[mesAno].saidas += conta.valor || 0;
              }
            }
          });

          contasReceber.forEach(conta => {
            if (conta.data_vencimento) {
              const data = new Date(conta.data_vencimento);
              const mesAno = `${data.toLocaleString('pt-BR', { month: 'short' })}/${data.getFullYear().toString().slice(-2)}`;
              if (meses[mesAno]) {
                meses[mesAno].entradas += conta.valor || 0;
              }
            }
          });

          // Calcular saldo acumulado
          let saldoAcumulado = 0;
          const dadosFluxo = Object.values(meses).map(m => {
            saldoAcumulado += m.entradas - m.saidas;
            return { ...m, saldo: saldoAcumulado };
          });

          results.push({
            obra: obra.nome,
            obra_id: obra.id,
            dados: dadosFluxo,
            totalEntradas: dadosFluxo.reduce((sum, d) => sum + d.entradas, 0),
            totalSaidas: dadosFluxo.reduce((sum, d) => sum + d.saidas, 0),
            saldoFinal: saldoAcumulado
          });
        } catch (error) {
          console.error(`Erro ao gerar fluxo de caixa da obra ${obra.nome}:`, error);
        }
      }
      
      return results;
    },
    enabled: obras.length > 0
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Carregando fluxo de caixa...</div>;
  }

  return (
    <div className="space-y-6">
      {fluxos.map((fluxo) => (
        <Card key={fluxo.obra_id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{fluxo.obra}</span>
              <div className={`flex items-center gap-2 ${
                fluxo.saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className="h-5 w-5" />
                <span className="text-lg font-semibold">
                  {fluxo.saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Entradas Previstas</div>
                  <div className="text-xl font-bold text-green-700">
                    {fluxo.totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Saídas Previstas</div>
                  <div className="text-xl font-bold text-red-700">
                    {fluxo.totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
                <div className={`text-center p-4 rounded-lg ${
                  fluxo.saldoFinal >= 0 ? 'bg-blue-50' : 'bg-orange-50'
                }`}>
                  <div className="text-sm text-gray-600 mb-1">Saldo Projetado</div>
                  <div className={`text-xl font-bold ${
                    fluxo.saldoFinal >= 0 ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    {fluxo.saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>

              {/* Gráfico */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fluxo.dados}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="entradas" stroke="#10B981" name="Entradas" strokeWidth={2} />
                    <Line type="monotone" dataKey="saidas" stroke="#EF4444" name="Saídas" strokeWidth={2} />
                    <Line type="monotone" dataKey="saldo" stroke="#3B82F6" name="Saldo Acumulado" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Mensal */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Projeção Mensal</h4>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Mês</th>
                        <th className="px-4 py-2 text-right">Entradas</th>
                        <th className="px-4 py-2 text-right">Saídas</th>
                        <th className="px-4 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fluxo.dados.map((d, idx) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{d.mes}</td>
                          <td className="px-4 py-2 text-right text-green-600">
                            {d.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="px-4 py-2 text-right text-red-600">
                            {d.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${
                            d.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                            {d.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}