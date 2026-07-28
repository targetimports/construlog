import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingDown, AlertTriangle, BarChart3, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalisadorCustosObraIA({ obraId, obraDados }) {
  const [analisando, setAnalisando] = useState(false);
  const [predicao, setPredicao] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [expandir, setExpandir] = useState(false);

  const handleAnalisar = async () => {
    setAnalisando(true);
    try {
      const resultado = await base44.functions.invoke('predizirCustosObraIA', {
        obraId
      });
      setPredicao(resultado.data.predicao);
      setMetricas(resultado.data.metricas_atuais);
      toast.success('Análise de custos concluída!');
    } catch (erro) {
      toast.error('Erro: ' + erro.message);
    } finally {
      setAnalisando(false);
    }
  };

  if (analisando) {
    return (
      <Card className="bg-blue-50">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-700">Analisando dados financeiros e histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (!predicao || !metricas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Análise Preditiva de Custos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Prevê custo final com base em histórico, identifica desvios antecipadamente e sugere otimizações
          </p>
          <Button onClick={handleAnalisar} disabled={analisando}>
            Iniciar Análise
          </Button>
        </CardContent>
      </Card>
    );
  }

  const desvioFinal = predicao.desvio_percentual_previsto;
  const custoBotomUp = metricas.valor_orcado || 0;
  const custoTopDown = predicao.previsao_custo_final || 0;
  const economiaVsOrcado = custoBotomUp - custoTopDown;

  const riscoAlto = predicao.risco_estouramento >= 7;
  const confidenceColor = metricas.confianca_modelo >= 80 ? 'text-green-600' : metricas.confianca_modelo >= 60 ? 'text-yellow-600' : 'text-red-600';

  // Dados para gráfico de simulação
  const simulacaoCustos = [
    { fase: 'Orçado', valor: custoBotomUp },
    { fase: 'Previsto', valor: custoTopDown },
    { fase: 'Realizado Atual', valor: metricas.valor_realizado }
  ];

  return (
    <div className="space-y-4">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={desvioFinal > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Desvio Previsto</p>
            <p className={`text-2xl font-bold ${desvioFinal > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {desvioFinal > 0 ? '+' : ''}{desvioFinal.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-600 mt-1">vs orçado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Custo Final Previsto</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {(custoTopDown / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {economiaVsOrcado < 0 ? `+R$ ${Math.abs(economiaVsOrcado).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : `-R$ ${economiaVsOrcado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Confiança da Previsão</p>
            <p className={`text-2xl font-bold ${confidenceColor}`}>{metricas.confianca_modelo}%</p>
            <p className="text-xs text-gray-600 mt-1">
              {metricas.confianca_modelo >= 80 ? 'Alta' : metricas.confianca_modelo >= 60 ? 'Média' : 'Baixa'}
            </p>
          </CardContent>
        </Card>

        <Card className={riscoAlto ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Risco Estouramento</p>
            <p className={`text-2xl font-bold ${riscoAlto ? 'text-red-600' : 'text-yellow-600'}`}>
              {predicao.risco_estouramento}/10
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Críticos */}
      {riscoAlto && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Risco Alto Detectado</p>
              <p className="text-sm text-red-800 mt-1">Probabilidade elevada de estouramento orçamentário. Revisão e ações imediatas recomendadas.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {predicao.alertas?.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-sm">Alertas Imediatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {predicao.alertas.map((alerta, idx) => (
              <div key={idx} className="flex gap-2 p-2 bg-white rounded">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{alerta}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Comparação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Comparação de Custos</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={simulacaoCustos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fase" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
              <Bar dataKey="valor" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pontos Críticos */}
      {predicao.pontos_criticos?.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-sm">Pontos Críticos de Custo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {predicao.pontos_criticos.map((ponto, idx) => (
              <div key={idx} className="p-2 bg-orange-50 rounded flex gap-2">
                <TrendingDown className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{ponto}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {expandir && (
        <>
          {/* Otimizações Financeiras */}
          {predicao.otimizacoes_financeiras?.length > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  Otimizações Financeiras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {predicao.otimizacoes_financeiras.map((opt, idx) => (
                  <div key={idx} className="p-3 bg-white rounded border border-green-200">
                    <p className="font-semibold text-sm text-gray-900">{opt.titulo}</p>
                    <p className="text-xs text-gray-700 mt-1">{opt.descricao}</p>
                    <p className="text-xs text-green-600 font-semibold mt-2">{opt.economia_potencial}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Acompanhamento Recomendado */}
          {predicao.acompanhamento_recomendado?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">KPIs para Acompanhamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {predicao.acompanhamento_recomendado.map((kpi, idx) => (
                  <div key={idx} className="p-2 bg-blue-50 rounded text-sm text-gray-700">
                    ✓ {kpi}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setExpandir(!expandir)} className="flex-1">
          {expandir ? 'Ocultar Detalhes' : 'Ver Análise Completa'}
        </Button>
        <Button variant="outline" onClick={handleAnalisar}>
          Atualizar Previsão
        </Button>
      </div>
    </div>
  );
}