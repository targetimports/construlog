import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, 
  DollarSign, Calendar, Package, Loader2, ChevronDown,
  ChevronUp, Target, Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function OtimizadorComprasIA() {
  const [obraSelecionada, setObraSelecionada] = useState('');
  const [mesesAnalise, setMesesAnalise] = useState(6);
  const [expandido, setExpandido] = useState({});
  const [analiseData, setAnaliseData] = useState(null);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const analisarMutation = useMutation({
    mutationFn: async ({ obra_id, meses_analise }) => {
      const response = await base44.functions.invoke('analisadorComprasIA', {
        obra_id,
        meses_analise
      });
      return response.data;
    },
    onSuccess: (data) => {
      setAnaliseData(data);
      toast.success('Análise concluída!');
    },
    onError: (error) => {
      toast.error('Erro na análise: ' + error.message);
    }
  });

  const handleAnalisar = () => {
    if (!obraSelecionada) {
      toast.error('Selecione uma obra');
      return;
    }
    analisarMutation.mutate({ obra_id: obraSelecionada, meses_analise: mesesAnalise });
  };

  const toggleSecao = (secao) => {
    setExpandido(prev => ({ ...prev, [secao]: !prev[secao] }));
  };

  const severidadeCor = {
    alta: 'bg-red-100 text-red-700 border-red-300',
    media: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    baixa: 'bg-blue-100 text-blue-700 border-blue-300'
  };

  const prioridadeCor = {
    alta: 'bg-red-500 text-white',
    media: 'bg-yellow-500 text-white',
    baixa: 'bg-green-500 text-white'
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Otimizador de Compras com IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Obra
              </label>
              <Select value={obraSelecionada} onValueChange={setObraSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Período de Análise
              </label>
              <Select value={String(mesesAnalise)} onValueChange={(v) => setMesesAnalise(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleAnalisar}
              disabled={analisarMutation.isPending || !obraSelecionada}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {analisarMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analisar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {analiseData && analiseData.success && (
        <div className="space-y-4">
          {/* Resumo Executivo */}
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Resumo Executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                {analiseData.analise.resumo_executivo}
              </p>
            </CardContent>
          </Card>

          {/* Alertas Críticos */}
          {analiseData.analise.alertas_criticos?.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="cursor-pointer" onClick={() => toggleSecao('alertas')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Alertas Críticos ({analiseData.analise.alertas_criticos.length})
                  </CardTitle>
                  {expandido.alertas ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandido.alertas && (
                <CardContent className="space-y-3">
                  {analiseData.analise.alertas_criticos.map((alerta, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${severidadeCor[alerta.severidade] || 'bg-gray-100'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold">{alerta.tipo}</div>
                        <Badge variant="outline" className="text-xs">
                          {alerta.severidade}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{alerta.descricao}</p>
                      <div className="text-sm font-medium text-gray-900">
                        ✓ Ação: {alerta.acao_recomendada}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Oportunidades de Economia */}
          {analiseData.analise.oportunidades_economia?.length > 0 && (
            <Card className="border-green-200">
              <CardHeader className="cursor-pointer" onClick={() => toggleSecao('economia')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Oportunidades de Economia ({analiseData.analise.oportunidades_economia.length})
                  </CardTitle>
                  {expandido.economia ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandido.economia && (
                <CardContent className="space-y-3">
                  {analiseData.analise.oportunidades_economia.map((oport, idx) => (
                    <div key={idx} className="p-4 rounded-lg border bg-green-50 border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-green-900">{oport.tipo}</div>
                        {oport.economia_estimada > 0 && (
                          <Badge className="bg-green-600 text-white">
                            R$ {oport.economia_estimada.toLocaleString('pt-BR')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{oport.descricao}</p>
                      <div className="text-sm font-medium text-green-800">
                        → {oport.acao}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Recomendações de Cotação */}
          {analiseData.analise.recomendacoes_cotacao?.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleSecao('cotacao')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Recomendações de Cotação ({analiseData.analise.recomendacoes_cotacao.length})
                  </CardTitle>
                  {expandido.cotacao ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandido.cotacao && (
                <CardContent className="space-y-3">
                  {analiseData.analise.recomendacoes_cotacao.map((rec, idx) => (
                    <div key={idx} className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-blue-900">{rec.material}</div>
                        <Badge className="bg-blue-600 text-white">
                          {rec.quantidade_sugerida} un
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Melhor período: <strong>{rec.melhor_periodo}</strong>
                      </div>
                      <p className="text-sm text-gray-600">{rec.justificativa}</p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Padrões de Consumo */}
          {analiseData.analise.padroes_consumo?.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleSecao('padroes')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Padrões de Consumo ({analiseData.analise.padroes_consumo.length})
                  </CardTitle>
                  {expandido.padroes ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandido.padroes && (
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analiseData.analise.padroes_consumo.map((padrao, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-gray-900">{padrao.material}</div>
                          <Badge className={prioridadeCor[padrao.criticidade] || 'bg-gray-500'}>
                            {padrao.criticidade}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          Consumo médio: <strong>{padrao.consumo_medio_mensal}</strong>/mês
                        </div>
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          {padrao.tendencia?.includes('aument') ? (
                            <TrendingUp className="w-3 h-3 text-red-600" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-green-600" />
                          )}
                          {padrao.tendencia}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Previsão de Necessidades */}
          {analiseData.analise.previsao_necessidades?.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleSecao('previsao')}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-orange-600" />
                    Previsão de Necessidades ({analiseData.analise.previsao_necessidades.length})
                  </CardTitle>
                  {expandido.previsao ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandido.previsao && (
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analiseData.analise.previsao_necessidades.map((prev, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-orange-50 border-orange-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-gray-900">{prev.material}</div>
                          <Badge className={prioridadeCor[prev.prioridade] || 'bg-gray-500'}>
                            {prev.prioridade}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-700">
                          Quantidade: <strong>{prev.quantidade_prevista}</strong>
                        </div>
                        <div className="text-sm text-gray-600">
                          Período: {prev.mes_previsto}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Ações Prioritárias */}
          {analiseData.analise.acoes_prioritarias?.length > 0 && (
            <Card className="border-indigo-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Ações Prioritárias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analiseData.analise.acoes_prioritarias.map((acao, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-indigo-50 border-indigo-200 flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{acao.acao}</div>
                      <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                        <span>Prazo: {acao.prazo}</span>
                        <span>Impacto: {acao.impacto}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}