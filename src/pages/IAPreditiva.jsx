import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Brain,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
  Target,
  Lightbulb,
  BarChart3,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';

export default function IAPreditiva() {
  const [obraSelecionada, setObraSelecionada] = useState('');
  const [analise, setAnalise] = useState(null);
  const [analisando, setAnalisando] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  const analisarObraMutation = useMutation({
    mutationFn: async (obraId) => {
      const obra = obras.find(o => o.id === obraId);
      const contasObra = contas.filter(c => c.obra_id === obraId);
      const medicoesObra = medicoes.filter(m => m.obra_id === obraId);

      const valorGasto = contasObra
        .filter(c => c.tipo === 'pagar' && c.status === 'pago')
        .reduce((acc, c) => acc + (c.valor || 0), 0);

      const valorMedido = medicoesObra
        .filter(m => m.status === 'aprovada')
        .reduce((acc, m) => acc + (m.valor_medido || 0), 0);

      const prompt = `Você é um analista especializado em gestão de obras de construção civil.

Analise a seguinte obra e forneça insights preditivos:

DADOS DA OBRA:
- Nome: ${obra.nome}
- Tipo: ${obra.tipo}
- Status: ${obra.status}
- Valor do Contrato: R$ ${(obra.valor_contrato || 0).toLocaleString('pt-BR')}
- Valor Orçado: R$ ${(obra.valor_orcado || 0).toLocaleString('pt-BR')}
- Valor Realizado: R$ ${(obra.valor_realizado || 0).toLocaleString('pt-BR')}
- Valor Gasto (Contas Pagas): R$ ${valorGasto.toLocaleString('pt-BR')}
- Valor Medido (Aprovado): R$ ${valorMedido.toLocaleString('pt-BR')}
- Percentual Concluído: ${obra.percentual_concluido || 0}%
- Data Início: ${obra.data_inicio}
- Data Prevista Fim: ${obra.data_prevista_fim}

MEDIÇÕES:
${medicoesObra.length} medições realizadas
Última medição: ${medicoesObra[0]?.percentual_fisico_acumulado || 0}% físico acumulado

CONTAS:
Total de ${contasObra.length} lançamentos financeiros
- Contas Pagas: ${contasObra.filter(c => c.status === 'pago').length}
- Contas Pendentes: ${contasObra.filter(c => c.status === 'pendente').length}

Forneça uma análise detalhada incluindo:
1. Risco de estouro de orçamento (baixo/médio/alto)
2. Probabilidade de atraso (%)
3. Principais riscos identificados
4. Recomendações específicas e acionáveis
5. Previsão de custo final
6. Score de saúde da obra (0-100)`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            risco_orcamento: {
              type: "string",
              enum: ["baixo", "medio", "alto"]
            },
            probabilidade_atraso: {
              type: "number",
              description: "Porcentagem de 0-100"
            },
            riscos_identificados: {
              type: "array",
              items: { type: "string" }
            },
            recomendacoes: {
              type: "array",
              items: { type: "string" }
            },
            previsao_custo_final: {
              type: "number"
            },
            score_saude: {
              type: "number",
              description: "0-100"
            },
            justificativa_score: {
              type: "string"
            },
            tendencia_custos: {
              type: "string",
              enum: ["crescente", "estavel", "decrescente"]
            }
          }
        }
      });

      return {
        obra,
        analise: response,
        dados: {
          valorGasto,
          valorMedido,
          contasObra: contasObra.length,
          medicoesObra: medicoesObra.length
        }
      };
    }
  });

  const handleAnalisar = async () => {
    if (!obraSelecionada) {
      return;
    }
    setAnalisando(true);
    try {
      const resultado = await analisarObraMutation.mutateAsync(obraSelecionada);
      setAnalise(resultado);
    } finally {
      setAnalisando(false);
    }
  };

  const riscoConfig = {
    baixo: { label: 'Baixo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: TrendingUp },
    medio: { label: 'Médio', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle },
    alto: { label: 'Alto', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertTriangle }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inteligência Preditiva"
        subtitle="Análise automática e previsões baseadas em IA"
      />

      {/* Seleção de Obra */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-gray-700 mb-2 block font-medium">Selecione uma obra para análise</Label>
              <Select value={obraSelecionada} onValueChange={setObraSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.filter(o => o.status === 'em_andamento').map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAnalisar}
              disabled={!obraSelecionada || analisando}
              className="mt-7"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analisar com IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados da Análise */}
      {analise && (
        <>
          {/* Score de Saúde */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                Score de Saúde da Obra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <p className={cn(
                        "text-4xl font-bold",
                        analise.analise.score_saude >= 70 ? "text-emerald-600" :
                        analise.analise.score_saude >= 40 ? "text-amber-600" : "text-red-600"
                      )}>
                        {analise.analise.score_saude}
                      </p>
                      <p className="text-gray-500 text-xs">de 100</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold mb-2">{analise.obra.nome}</h3>
                  <p className="text-gray-600 text-sm mb-4">{analise.analise.justificativa_score}</p>
                  <Progress 
                    value={analise.analise.score_saude} 
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs Preditivos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <AlertTriangle className={cn(
                    "w-8 h-8",
                    analise.analise.risco_orcamento === 'baixo' ? 'text-emerald-600' :
                    analise.analise.risco_orcamento === 'medio' ? 'text-amber-600' : 'text-red-600'
                  )} />
                </div>
                <p className="text-gray-600 text-sm mb-1">Risco de Orçamento</p>
                <Badge className={cn("border", riscoConfig[analise.analise.risco_orcamento].color)}>
                  {riscoConfig[analise.analise.risco_orcamento].label}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Probabilidade de Atraso</p>
                <p className="text-2xl font-bold text-gray-900">{analise.analise.probabilidade_atraso}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Previsão Custo Final</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analise.analise.previsao_custo_final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  analise.analise.previsao_custo_final > analise.obra.valor_orcado 
                    ? "text-red-600" 
                    : "text-emerald-600"
                )}>
                  {analise.analise.previsao_custo_final > analise.obra.valor_orcado ? '▲' : '▼'} {' '}
                  {(((analise.analise.previsao_custo_final - analise.obra.valor_orcado) / analise.obra.valor_orcado) * 100).toFixed(1)}% vs orçado
                </p>
                </CardContent>
                </Card>
                </div>

                {/* Riscos Identificados */}
                <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Riscos Identificados
                </CardTitle>
                </CardHeader>
                <CardContent>
                {analise.analise.riscos_identificados.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum risco crítico identificado</p>
                ) : (
                <div className="space-y-3">
                  {analise.analise.riscos_identificados.map((risco, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">{risco}</p>
                    </div>
                  ))}
                </div>
                )}
                </CardContent>
                </Card>

                {/* Recomendações */}
                <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                Recomendações da IA
                </CardTitle>
                </CardHeader>
                <CardContent>
                {analise.analise.recomendacoes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma recomendação neste momento</p>
                ) : (
                <div className="space-y-3">
                  {analise.analise.recomendacoes.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <Lightbulb className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">{rec}</p>
                    </div>
                  ))}
                </div>
                )}
                </CardContent>
                </Card>

                {/* Dados da Análise */}
                <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Dados Analisados
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-100 rounded-xl">
                  <p className="text-gray-600 text-sm">Valor Gasto</p>
                  <p className="text-gray-900 font-bold text-lg">
                    {analise.dados.valorGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="p-4 bg-gray-100 rounded-xl">
                  <p className="text-gray-600 text-sm">Valor Medido</p>
                  <p className="text-gray-900 font-bold text-lg">
                    {analise.dados.valorMedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="p-4 bg-gray-100 rounded-xl">
                  <p className="text-gray-600 text-sm">Lançamentos</p>
                  <p className="text-gray-900 font-bold text-lg">{analise.dados.contasObra}</p>
                </div>
                <div className="p-4 bg-gray-100 rounded-xl">
                  <p className="text-gray-600 text-sm">Medições</p>
                  <p className="text-gray-900 font-bold text-lg">{analise.dados.medicoesObra}</p>
                </div>
                </div>
                </CardContent>
                </Card>
                </>
                )}

                {/* Estado Vazio */}
                {!analise && !analisando && (
                <Card>
                <CardContent className="p-12 text-center">
                <Brain className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Análise Preditiva com IA</h3>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                Selecione uma obra e clique em "Analisar com IA" para obter insights preditivos sobre riscos,
                custos e cronograma baseados em dados históricos e análise avançada.
                </p>
                <div className="flex justify-center gap-8 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Detecção de Riscos</span>
                </div>
                <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Previsões</span>
                </div>
                <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>Recomendações</span>
                </div>
                </div>
                </CardContent>
                </Card>
                )}
    </div>
  );
}