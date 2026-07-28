import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function PrevisaoFluxoCaixaIA() {
  const [obraFiltro, setObraFiltro] = useState('todas');
  const [previsaoGerada, setPrevisaoGerada] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const gerarPrevisao = async () => {
    try {
      setCarregando(true);
      const { data } = await base44.functions.invoke('preverFluxoCaixaIA', {
        obra_id: obraFiltro !== 'todas' ? obraFiltro : null
      });
      
      if (data.sucesso) {
        setPrevisaoGerada(data);
        toast.success('Previsão gerada com sucesso!');
      } else {
        toast.error('Erro ao gerar previsão');
      }
    } catch (error) {
      toast.error('Erro ao gerar previsão: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const nivelRiscoCor = {
    'baixo': 'text-green-600 bg-green-50 border-green-200',
    'medio': 'text-yellow-600 bg-yellow-50 border-yellow-200',
    'alto': 'text-red-600 bg-red-50 border-red-200',
    'crítico': 'text-red-700 bg-red-100 border-red-300'
  };

  const prioridadeCor = {
    'alta': 'bg-red-100 text-red-700 border-red-300',
    'media': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'baixa': 'bg-blue-100 text-blue-700 border-blue-300'
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Controles */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                <Brain className="w-5 h-5 text-blue-600" />
                Previsão de Fluxo de Caixa com IA
              </CardTitle>
              <p className="text-gray-600 mt-1">Análise preditiva e sugestões de otimização financeira</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <ComboboxBusca
                options={[{ value: 'todas', label: 'Todas as Obras' }, ...obras.map(o => ({ value: o.id, label: o.nome }))]}
                value={obraFiltro}
                onSelect={setObraFiltro}
                placeholder="Filtrar por obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra."
              />
            </div>
            <Button 
              onClick={gerarPrevisao}
              disabled={carregando}
              className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Gerar Previsão
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {previsaoGerada && (
        <>
          {/* Previsão de Fluxo de Caixa */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">30 Dias</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
                  {previsaoGerada.previsao.previsao_fluxo_caixa.previsao_30_dias.toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  })}
                </div>
                <div className={`flex items-center gap-1 mt-2 text-sm ${
                  previsaoGerada.previsao.previsao_fluxo_caixa.previsao_30_dias > 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {previsaoGerada.previsao.previsao_fluxo_caixa.previsao_30_dias > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>Previsão</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">60 Dias</span>
                  <Calendar className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
                  {previsaoGerada.previsao.previsao_fluxo_caixa.previsao_60_dias.toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  })}
                </div>
                <div className={`flex items-center gap-1 mt-2 text-sm ${
                  previsaoGerada.previsao.previsao_fluxo_caixa.previsao_60_dias > 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {previsaoGerada.previsao.previsao_fluxo_caixa.previsao_60_dias > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>Previsão</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">90 Dias</span>
                  <Calendar className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
                  {previsaoGerada.previsao.previsao_fluxo_caixa.previsao_90_dias.toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  })}
                </div>
                <div className={`flex items-center gap-1 mt-2 text-sm ${
                  previsaoGerada.previsao.previsao_fluxo_caixa.previsao_90_dias > 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {previsaoGerada.previsao.previsao_fluxo_caixa.previsao_90_dias > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>Previsão</span>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 ${nivelRiscoCor[previsaoGerada.previsao.previsao_fluxo_caixa.nivel_risco?.toLowerCase()] || 'border-gray-200'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">Nível de Risco</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-lg sm:text-2xl font-bold capitalize">
                  {previsaoGerada.previsao.previsao_fluxo_caixa.nivel_risco}
                </div>
                <div className="text-sm text-gray-600 mt-2 capitalize">
                  {previsaoGerada.previsao.previsao_fluxo_caixa.tendencia}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas Críticos */}
          {previsaoGerada.previsao.alertas_criticos?.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  Alertas Críticos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {previsaoGerada.previsao.alertas_criticos.map((alerta, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-red-900 font-semibold mb-1">{alerta.mensagem}</p>
                          <p className="text-red-700 text-sm">{alerta.acao_recomendada}</p>
                        </div>
                        <Badge className="bg-red-100 text-red-700 border-0">{alerta.gravidade}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análise Detalhada */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Pontos de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {previsaoGerada.previsao.analise_detalhada.pontos_atencao.map((ponto, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-yellow-600 mt-0.5">•</span>
                      <span>{ponto}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-green-600" />
                  Oportunidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {previsaoGerada.previsao.analise_detalhada.oportunidades.map((oportunidade, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>{oportunidade}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Riscos Identificados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {previsaoGerada.previsao.analise_detalhada.riscos_identificados.map((risco, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-600 mt-0.5">•</span>
                      <span>{risco}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Sugestões de Otimização */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Sugestões de Otimização do Fluxo de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {previsaoGerada.previsao.sugestoes_otimizacao.map((sugestao, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{sugestao.titulo}</h4>
                          <Badge className={`${prioridadeCor[sugestao.prioridade?.toLowerCase()] || 'bg-gray-100'}`}>
                            {sugestao.prioridade}
                          </Badge>
                        </div>
                        <p className="text-gray-700 text-sm mb-2">{sugestao.descricao}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          <span className="text-gray-600">
                            <strong>Impacto:</strong> {sugestao.impacto_estimado}
                          </span>
                          <span className="text-gray-600">
                            <strong>Categoria:</strong> {sugestao.categoria}
                          </span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dados Base */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-base">Dados da Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Receitas Futuras:</span>
                  <div className="font-semibold text-green-600 break-words">
                    {previsaoGerada.dados_base.total_receitas_futuras.toLocaleString('pt-BR', {
                      style: 'currency', 
                      currency: 'BRL' 
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Despesas Futuras:</span>
                  <div className="font-semibold text-red-600 break-words">
                    {previsaoGerada.dados_base.total_despesas_futuras.toLocaleString('pt-BR', {
                      style: 'currency', 
                      currency: 'BRL' 
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Taxa Inadimplência:</span>
                  <div className="font-semibold text-gray-900">
                    {previsaoGerada.dados_base.taxa_inadimplencia.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Contas Pendentes:</span>
                  <div className="font-semibold text-gray-900">
                    {previsaoGerada.dados_base.quantidade_contas_pendentes}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}