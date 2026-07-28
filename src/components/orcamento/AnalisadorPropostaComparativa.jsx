import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function AnalisadorPropostaComparativa({ proposta, historicoPrecos, orcamento }) {
  const analise = useMemo(() => {
    if (!historicoPrecos || historicoPrecos.length === 0) {
      return null;
    }

    // Agrupar por insumo
    const porInsumo = {};
    historicoPrecos.forEach(hp => {
      if (!porInsumo[hp.insumo_id]) {
        porInsumo[hp.insumo_id] = [];
      }
      porInsumo[hp.insumo_id].push(hp);
    });

    // Calcular estatísticas
    const comparativa = [];
    let totalDesvio = 0;
    let countComDesvio = 0;

    Object.entries(porInsumo).forEach(([insumoId, precos]) => {
      const precoAtual = proposta.itens?.find(i => i.insumo_id === insumoId)?.valor_unitario;
      const precoMedio = precos.reduce((acc, p) => acc + p.preco, 0) / precos.length;
      
      if (precoAtual) {
        const desvio = ((precoAtual - precoMedio) / precoMedio) * 100;
        const tendencia = precos.length > 1 
          ? ((precos[precos.length - 1].preco - precos[0].preco) / precos[0].preco) * 100
          : 0;

        comparativa.push({
          insumo_id: insumoId,
          descricao: precos[0].descricao_insumo,
          preco_atual: precoAtual,
          preco_medio_historico: precoMedio,
          desvio_percentual: desvio,
          tendencia_percentual: tendencia,
          registros: precos.length,
          recomendacao: desvio > 15 ? 'revisar' : desvio < -10 ? 'oportunidade' : 'ok'
        });

        totalDesvio += Math.abs(desvio);
        countComDesvio++;
      }
    });

    const desvioMedio = countComDesvio > 0 ? totalDesvio / countComDesvio : 0;

    // Dados para gráfico de tendência
    const dataGrafico = historicoPrecos
      .sort((a, b) => new Date(a.data_registro) - new Date(b.data_registro))
      .map(hp => ({
        data: new Date(hp.data_registro).toLocaleDateString('pt-BR'),
        preco: hp.preco,
        insumo: hp.descricao_insumo
      }));

    return {
      comparativa,
      desvioMedio,
      dataGrafico,
      totalItensAnalisados: comparativa.length,
      itensComOportunidade: comparativa.filter(c => c.recomendacao === 'oportunidade').length,
      itensParaRevisar: comparativa.filter(c => c.recomendacao === 'revisar').length
    };
  }, [historicoPrecos, proposta]);

  if (!analise) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Sem histórico de preços para comparação</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Desvio Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {analise.desvioMedio > 10 ? (
                <TrendingUp className="w-5 h-5 text-orange-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-600" />
              )}
              <p className={cn(
                "text-2xl font-bold",
                analise.desvioMedio > 10 ? "text-orange-600" : "text-green-600"
              )}>
                {analise.desvioMedio.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Oportunidades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{analise.itensComOportunidade}</p>
            <p className="text-xs text-gray-500 mt-1">Preços abaixo da média</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Para Revisar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{analise.itensParaRevisar}</p>
            <p className="text-xs text-gray-500 mt-1">Preços acima da média</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência */}
      {analise.dataGrafico.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Preços</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analise.dataGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${value.toFixed(2)}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="preco" 
                  stroke="#3b82f6" 
                  name="Preço"
                  dot={{ fill: '#3b82f6', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela Comparativa */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada por Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {analise.comparativa.map((item) => (
              <div key={item.insumo_id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.descricao}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Registros: {item.registros} | Tendência: {item.tendencia_percentual.toFixed(1)}%
                    </p>
                  </div>
                  <Badge className={cn(
                    item.recomendacao === 'revisar' ? 'bg-red-100 text-red-800' :
                    item.recomendacao === 'oportunidade' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  )}>
                    {item.recomendacao === 'revisar' ? 'Revisar' :
                     item.recomendacao === 'oportunidade' ? 'Opportunity' :
                     '✓ Ok'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-600">Atual</p>
                    <p className="font-semibold text-gray-900">
                      R$ {item.preco_atual.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-600">Histórico</p>
                    <p className="font-semibold text-gray-900">
                      R$ {item.preco_medio_historico.toFixed(2)}
                    </p>
                  </div>
                  <div className={cn(
                    'p-2 rounded',
                    item.desvio_percentual > 15 ? 'bg-red-50' :
                    item.desvio_percentual < -10 ? 'bg-green-50' :
                    'bg-blue-50'
                  )}>
                    <p className="text-gray-600">Desvio</p>
                    <p className={cn(
                      'font-semibold',
                      item.desvio_percentual > 0 ? 'text-red-600' : 'text-green-600'
                    )}>
                      {item.desvio_percentual > 0 ? '+' : ''}{item.desvio_percentual.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}