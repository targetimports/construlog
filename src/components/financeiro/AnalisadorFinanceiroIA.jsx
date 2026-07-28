import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, AlertTriangle, Lightbulb, TrendingUp, Target, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalisadorFinanceiroIA() {
  const [carregando, setCarregando] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [obraId, setObraId] = useState('');
  const [mesesProjetados, setMesesProjetados] = useState(12);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const handleAnalisar = async () => {
    if (!analise || mesesProjetados !== 12) {
      setCarregando(true);
      try {
        const resultado = await base44.functions.invoke('analisadorFinanceiroIA', {
          obraId: obraId || undefined,
          mesesProjetados
        });
        setAnalise(resultado.data.analise);
        toast.success('Análise IA concluída!');
      } catch (erro) {
        toast.error('Erro ao gerar análise: ' + erro.message);
      } finally {
        setCarregando(false);
      }
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-600">Analisando dados financeiros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Previsão Financeira com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Obra (opcional)</label>
              <select
                value={obraId}
                onChange={(e) => setObraId(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todas as obras</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Período de Projeção</label>
              <select
                value={mesesProjetados}
                onChange={(e) => setMesesProjetados(parseInt(e.target.value))}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
                <option value="24">24 meses</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAnalisar} className="w-full gap-2">
                <Zap className="w-4 h-4" />
                Gerar Análise IA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {analise && (
        <>
          {/* Previsão de Caixa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Projeção de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analise.previsao || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" stroke="#10B981" strokeWidth={2} name="Receita" />
                  <Line type="monotone" dataKey="despesa" stroke="#EF4444" strokeWidth={2} name="Despesa" />
                  <Line type="monotone" dataKey="saldo" stroke="#3B82F6" strokeWidth={2} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tendências */}
          <Card>
            <CardHeader>
              <CardTitle>Análise de Tendências</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{analise.tendencias}</p>
            </CardContent>
          </Card>

          {/* Riscos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Riscos Identificados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analise.riscos?.map((risco, idx) => (
                <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-semibold text-red-900">{risco.risco}</p>
                  <p className="text-sm text-red-700 mt-1">
                    <strong>Severidade:</strong> {risco.severidade} | <strong>Impacto:</strong> {risco.impacto}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Oportunidades */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Oportunidades de Otimização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analise.oportunidades?.map((oport, idx) => (
                <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-semibold text-yellow-900">{oport.oportunidade}</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    <strong>Potencial:</strong> {oport.potencial}
                  </p>
                  <p className="text-sm text-yellow-700">
                    <strong>Ação:</strong> {oport.acao}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Estratégias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                Estratégias Recomendadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analise.estrategias?.map((est, idx) => (
                <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold text-green-900">{est.estrategia}</p>
                  <p className="text-sm text-green-700 mt-1">{est.descricao}</p>
                  <p className="text-sm text-green-700 mt-1">
                    <strong>Implementação:</strong> {est.implementacao}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Alertas Críticos */}
          {analise.alertas?.length > 0 && (
            <Card className="border-2 border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <Clock className="w-5 h-5" />
                  Alertas Imediatos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analise.alertas.map((alerta, idx) => (
                    <li key={idx} className="flex gap-3 text-red-800">
                      <span className="text-red-600"></span>
                      <span>{alerta}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!analise && (
        <Card className="text-center p-8">
          <p className="text-gray-600">Clique em "Gerar Análise IA" para visualizar previsões e estratégias financeiras inteligentes</p>
        </Card>
      )}
    </div>
  );
}