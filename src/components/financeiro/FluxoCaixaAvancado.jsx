import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function FluxoCaixaAvancado({ contas }) {
  const fluxoDiario = useMemo(() => {
    const flux = {};
    const hoje = new Date();
    
    // Gera 30 dias para frente
    for (let i = -10; i <= 30; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + i);
      const chave = data.toISOString().split('T')[0];
      flux[chave] = { data: chave, entradas: 0, saidas: 0, saldo: 0 };
    }

    // Adiciona contas reais
    contas.forEach(conta => {
      const data = conta.data_vencimento;
      if (flux[data]) {
        if (conta.tipo === 'receber') {
          flux[data].entradas += conta.valor;
        } else {
          flux[data].saidas += conta.valor;
        }
      }
    });

    // Calcula saldo acumulado
    let acumulado = 0;
    return Object.values(flux)
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .map(item => {
        acumulado += item.entradas - item.saidas;
        return {
          ...item,
          saldo: acumulado,
          mes: new Date(item.data).toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' })
        };
      });
  }, [contas]);

  const totalizacao = useMemo(() => {
    const entradas = contas.filter(c => c.tipo === 'receber').reduce((acc, c) => acc + c.valor, 0);
    const saidas = contas.filter(c => c.tipo === 'pagar').reduce((acc, c) => acc + c.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [contas]);

  const fluxoMensal = useMemo(() => {
    const meses = {};
    contas.forEach(conta => {
      const data = new Date(conta.data_vencimento);
      const mes = `${data.getMonth() + 1}/${data.getFullYear()}`;
      
      if (!meses[mes]) {
        meses[mes] = { mes, entradas: 0, saidas: 0 };
      }
      
      if (conta.tipo === 'receber') {
        meses[mes].entradas += conta.valor;
      } else {
        meses[mes].saidas += conta.valor;
      }
    });

    return Object.values(meses)
      .sort((a, b) => {
        const [mesA, anoA] = a.mes.split('/').map(Number);
        const [mesB, anoB] = b.mes.split('/').map(Number);
        return anoA - anoB || mesA - mesB;
      })
      .slice(0, 6);
  }, [contas]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="text-emerald-500"><TrendingUp className="w-6 h-6" /></div>
              <div>
                <div className="text-sm text-gray-500">Entradas Previstas</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {totalizacao.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="text-red-500"><TrendingUp className="w-6 h-6 rotate-180" /></div>
              <div>
                <div className="text-sm text-gray-500">Saídas Previstas</div>
                <div className="text-2xl font-bold text-red-600">
                  {totalizacao.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div>
              <div className="text-sm text-gray-500">Saldo Projetado</div>
              <div className={`text-2xl font-bold ${totalizacao.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalizacao.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fluxo Diário */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Fluxo de Caixa - Próximos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fluxoDiario}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" />
                <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px' }}
                  formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <Legend />
                <Bar dataKey="entradas" fill="#10B981" name="Entradas" radius={[8, 8, 0, 0]} />
                <Bar dataKey="saidas" fill="#EF4444" name="Saídas" radius={[8, 8, 0, 0]} />
                <Area type="monotone" dataKey="saldo" fill="#3B82F6" stroke="#2563EB" name="Saldo" yAxisId="right" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fluxo Mensal */}
      {fluxoMensal.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Comparativo Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px' }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Legend />
                  <Bar dataKey="entradas" fill="#10B981" name="Entradas" />
                  <Bar dataKey="saidas" fill="#EF4444" name="Saídas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}