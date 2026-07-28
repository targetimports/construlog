import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SimuladorCenarios() {
  const [premissas, setPremissas] = useState({
    aumentoReceita: 0,
    aumenoDespesa: 0,
    mesesProjetados: 6,
    taxaJuros: 0
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const projecao = useMemo(() => {
    const hoje = new Date();
    const dados = [];
    let saldoAtual = contas
      .filter(c => c.status === 'pago')
      .reduce((a, c) => a + (c.tipo === 'receber' ? c.valor : -c.valor), 0);

    for (let mes = 0; mes <= premissas.mesesProjetados; mes++) {
      const dataMes = new Date(hoje.getTime() + mes * 30 * 24 * 60 * 60 * 1000);
      
      const entradas = contas
        .filter(c => 
          c.tipo === 'receber' &&
          new Date(c.data_vencimento).getMonth() === dataMes.getMonth()
        )
        .reduce((a, c) => a + (c.valor || 0), 0) * (1 + premissas.aumentoReceita / 100);

      const saidas = contas
        .filter(c => 
          c.tipo === 'pagar' &&
          new Date(c.data_vencimento).getMonth() === dataMes.getMonth()
        )
        .reduce((a, c) => a + (c.valor || 0), 0) * (1 + premissas.aumenoDespesa / 100);

      saldoAtual = saldoAtual + entradas - saidas;

      dados.push({
        mes: dataMes.toLocaleDateString('pt-BR', { month: 'short' }),
        saldo: saldoAtual,
        entradas,
        saidas
      });
    }

    return dados;
  }, [contas, premissas]);

  const saldoFinal = projecao[projecao.length - 1]?.saldo || 0;
  const saldoInicial = projecao[0]?.saldo || 0;
  const variacao = saldoFinal - saldoInicial;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Premissas da Simulação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="aumenReceitaInput">Aumento de Receita (%)</Label>
              <Input
                id="aumenReceitaInput"
                type="number"
                step="0.5"
                value={premissas.aumentoReceita}
                onChange={(e) => setPremissas({ ...premissas, aumentoReceita: parseFloat(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="aumenDespesaInput">Aumento de Despesa (%)</Label>
              <Input
                id="aumenDespesaInput"
                type="number"
                step="0.5"
                value={premissas.aumenoDespesa}
                onChange={(e) => setPremissas({ ...premissas, aumenoDespesa: parseFloat(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="mesesProjetInput">Meses a Projetar</Label>
              <Input
                id="mesesProjetInput"
                type="number"
                value={premissas.mesesProjetados}
                onChange={(e) => setPremissas({ ...premissas, mesesProjetados: parseInt(e.target.value) || 6 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="taxaJurosInput">Taxa de Juros Mensal (%)</Label>
              <Input
                id="taxaJurosInput"
                type="number"
                step="0.1"
                value={premissas.taxaJuros}
                onChange={(e) => setPremissas({ ...premissas, taxaJuros: parseFloat(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600 text-sm">Saldo Inicial</p>
            <p className="text-2xl font-bold text-gray-900">{saldoInicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600 text-sm">Saldo Final (Mês {premissas.mesesProjetados})</p>
            <p className={`text-2xl font-bold ${saldoFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600 text-sm">Variação</p>
            <div className="flex items-center gap-2 mt-2">
              {variacao >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <p className={`text-2xl font-bold ${variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {variacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projeção de Caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={projecao}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Legend />
              <Line type="monotone" dataKey="saldo" stroke="#3B82F6" strokeWidth={2} name="Saldo Projetado" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}