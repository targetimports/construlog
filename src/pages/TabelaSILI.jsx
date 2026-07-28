import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Database, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { KpiCardsSkeleton, ListSkeleton } from '@/components/shared/Skeletons';

export default function TabelaSILI() {
  const [analisando, setAnalisando] = useState(false);
  const [analiseCompleta, setAnaliseCompleta] = useState(null);
  const [expandidos, setExpandidos] = useState({});

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['tabela-sili'],
    queryFn: () => base44.entities.TabelaSILI.list()
  });

  useEffect(() => {
    if (itens.length > 0 && !analiseCompleta && !analisando) {
      analisarAutomaticamente();
    }
  }, [itens]);

  const analisarAutomaticamente = async () => {
    setAnalisando(true);
    
    try {
      // Preparar dados para análise
      const contexto = {
        total_itens: itens.length,
        tipos: [...new Set(itens.map(i => i.tipo))],
        categorias: [...new Set(itens.map(i => i.categoria))],
        estados: [...new Set(itens.map(i => i.estado))],
        valor_medio: itens.reduce((acc, i) => acc + (i.valor_unitario || 0), 0) / itens.length,
        itens_sample: itens.slice(0, 10).map(i => ({
          codigo: i.codigo,
          descricao: i.descricao,
          tipo: i.tipo,
          categoria: i.categoria,
          valor_unitario: i.valor_unitario,
          unidade: i.unidade
        }))
      };

      const prompt = `
Analise profundamente esta base de dados da Tabela SILI (Sistema de Infraestrutura de Licitações e Insumos):

CONTEXTO GERAL:
- Total de itens: ${contexto.total_itens}
- Tipos de itens: ${contexto.tipos.join(', ')}
- Categorias: ${contexto.categorias.join(', ')}
- Estados: ${contexto.estados.join(', ')}
- Valor médio: R$ ${contexto.valor_medio.toFixed(2)}

AMOSTRA DE DADOS:
${JSON.stringify(contexto.itens_sample, null, 2)}

EXECUTE UMA ANÁLISE COMPLETA E FORNEÇA:

1. **ESTATÍSTICAS PRINCIPAIS** (em formato de array de objetos):
   - Quantidade por tipo
   - Quantidade por categoria
   - Valores médios por segmento
   - Tendências identificadas

2. **INSIGHTS DE PRECIFICAÇÃO** (array de objetos com):
   - Itens com preços acima da média
   - Itens com preços abaixo da média
   - Oportunidades de economia
   - Alertas de custos elevados

3. **ALERTAS E RECOMENDAÇÕES** (array de objetos classificados por severidade):
   - CRÍTICO: Problemas graves que requerem ação imediata
   - ATENÇÃO: Pontos que merecem revisão
   - OTIMIZAÇÃO: Sugestões de melhoria

4. **COMPARATIVOS REGIONAIS** (se houver múltiplos estados):
   - Diferenças de preços entre estados
   - Recomendações baseadas em localização

5. **AÇÕES SUGERIDAS** (lista priorizada de próximos passos)

Retorne EXCLUSIVAMENTE um JSON válido no seguinte formato:
{
  "estatisticas": [
    { "titulo": "...", "valor": "...", "descricao": "...", "icon": "database|trending-up|alert-triangle" }
  ],
  "insights_precificacao": [
    { "categoria": "...", "insight": "...", "itens_afetados": 0, "impacto": "alto|medio|baixo" }
  ],
  "alertas": [
    { "severidade": "critico|atencao|otimizacao", "titulo": "...", "descricao": "...", "acao_recomendada": "..." }
  ],
  "comparativos": [
    { "titulo": "...", "dados": "...", "recomendacao": "..." }
  ],
  "acoes_prioritarias": [
    { "prioridade": 1, "acao": "...", "justificativa": "...", "beneficio_esperado": "..." }
  ],
  "resumo_executivo": "Um parágrafo resumindo as principais descobertas e recomendações"
}
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            estatisticas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  valor: { type: "string" },
                  descricao: { type: "string" },
                  icon: { type: "string" }
                }
              }
            },
            insights_precificacao: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  categoria: { type: "string" },
                  insight: { type: "string" },
                  itens_afetados: { type: "number" },
                  impacto: { type: "string" }
                }
              }
            },
            alertas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severidade: { type: "string" },
                  titulo: { type: "string" },
                  descricao: { type: "string" },
                  acao_recomendada: { type: "string" }
                }
              }
            },
            comparativos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  dados: { type: "string" },
                  recomendacao: { type: "string" }
                }
              }
            },
            acoes_prioritarias: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  prioridade: { type: "number" },
                  acao: { type: "string" },
                  justificativa: { type: "string" },
                  beneficio_esperado: { type: "string" }
                }
              }
            },
            resumo_executivo: { type: "string" }
          }
        }
      });

      setAnaliseCompleta(response);
    } catch (error) {
      console.error('Erro ao analisar:', error);
    } finally {
      setAnalisando(false);
    }
  };

  const toggleExpandir = (secao) => {
    setExpandidos(prev => ({ ...prev, [secao]: !prev[secao] }));
  };

  const getSeveridadeColor = (severidade) => {
    const colors = {
      critico: 'bg-red-100 text-red-800 border-red-300',
      atencao: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      otimizacao: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[severidade] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getImpactoColor = (impacto) => {
    const colors = {
      alto: 'bg-red-600',
      medio: 'bg-yellow-600',
      baixo: 'bg-green-600'
    };
    return colors[impacto] || 'bg-gray-600';
  };

  const getIconComponent = (iconName) => {
    const icons = {
      'database': Database,
      'trending-up': TrendingUp,
      'alert-triangle': AlertTriangle,
      'check-circle': CheckCircle2
    };
    const Icon = icons[iconName] || Database;
    return <Icon className="w-6 h-6" />;
  };

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Análise Inteligente - Tabela SILI</h1>
          </div>
          <p className="text-gray-600 text-base">IA analisa automaticamente sua base de preços de infraestrutura</p>
        </div>
        {analisando && (
          <div className="flex items-center gap-2 text-purple-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-semibold">Analisando...</span>
          </div>
        )}
      </div>

      {/* Status da Base */}
      {(isLoading || analisando) && (
        <div className="space-y-6">
          <KpiCardsSkeleton count={3} />
          <ListSkeleton rows={6} />
        </div>
      )}

      {!isLoading && !analisando && itens.length > 0 && !analiseCompleta && (
        <Card className="bg-white border-gray-200 rounded-xl shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Database className="w-12 h-12 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{itens.length} itens</p>
                <p className="text-gray-600">Iniciando análise automática...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise Completa */}
      {analiseCompleta && (
        <div className="space-y-6">
          {/* Resumo Executivo */}
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 rounded-xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                Resumo Executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-800 text-lg leading-relaxed">{analiseCompleta.resumo_executivo}</p>
            </CardContent>
          </Card>

          {/* Estatísticas Principais */}
          {analiseCompleta.estatisticas && analiseCompleta.estatisticas.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Estatísticas Principais
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analiseCompleta.estatisticas.map((stat, idx) => (
                  <Card key={idx} className="bg-white border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          {getIconComponent(stat.icon)}
                        </div>
                        <div className="flex-1">
                          <p className="text-3xl font-bold text-gray-900 mb-1">{stat.valor}</p>
                          <p className="text-sm font-semibold text-gray-700 mb-1">{stat.titulo}</p>
                          <p className="text-sm text-gray-600">{stat.descricao}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Insights de Precificação */}
          {analiseCompleta.insights_precificacao && analiseCompleta.insights_precificacao.length > 0 && (
            <Card className="bg-white border-gray-200 rounded-xl shadow-md">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  Insights de Precificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analiseCompleta.insights_precificacao.map((insight, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-green-100 text-green-800 font-bold">
                            {insight.categoria}
                          </Badge>
                          <Badge className={`${getImpactoColor(insight.impacto)} text-white font-bold`}>
                            Impacto {insight.impacto}
                          </Badge>
                        </div>
                        <p className="text-gray-900 font-medium mb-1">{insight.insight}</p>
                        <p className="text-sm text-gray-600">{insight.itens_afetados} itens afetados</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Alertas e Recomendações */}
          {analiseCompleta.alertas && analiseCompleta.alertas.length > 0 && (
            <Card className="bg-white border-gray-200 rounded-xl shadow-md">
              <CardHeader className="cursor-pointer" onClick={() => toggleExpandir('alertas')}>
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                    Alertas e Recomendações ({analiseCompleta.alertas.length})
                  </div>
                  {expandidos.alertas ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
              </CardHeader>
              {expandidos.alertas && (
                <CardContent className="space-y-3">
                  {analiseCompleta.alertas.map((alerta, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${getSeveridadeColor(alerta.severidade)}`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <p className="font-bold text-lg mb-1">{alerta.titulo}</p>
                          <p className="text-sm mb-2">{alerta.descricao}</p>
                          <div className="bg-white/50 p-3 rounded mt-2">
                            <p className="text-sm font-semibold mb-1">Ação Recomendada:</p>
                            <p className="text-sm">{alerta.acao_recomendada}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Comparativos Regionais */}
          {analiseCompleta.comparativos && analiseCompleta.comparativos.length > 0 && (
            <Card className="bg-white border-gray-200 rounded-xl shadow-md">
              <CardHeader className="cursor-pointer" onClick={() => toggleExpandir('comparativos')}>
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-6 h-6 text-blue-600" />
                    Comparativos Regionais
                  </div>
                  {expandidos.comparativos ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
              </CardHeader>
              {expandidos.comparativos && (
                <CardContent className="space-y-3">
                  {analiseCompleta.comparativos.map((comp, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="font-bold text-lg text-gray-900 mb-2">{comp.titulo}</p>
                      <p className="text-gray-700 mb-2">{comp.dados}</p>
                      <div className="bg-white p-3 rounded">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Recomendação:</p>
                        <p className="text-sm text-gray-800">{comp.recomendacao}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Ações Prioritárias */}
          {analiseCompleta.acoes_prioritarias && analiseCompleta.acoes_prioritarias.length > 0 && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  Próximos Passos (Priorizados)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analiseCompleta.acoes_prioritarias.sort((a, b) => a.prioridade - b.prioridade).map((acao, idx) => (
                  <div key={idx} className="p-5 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {acao.prioridade}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-lg text-gray-900 mb-2">{acao.acao}</p>
                        <p className="text-gray-700 mb-2">{acao.justificativa}</p>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-sm font-semibold text-green-900 mb-1">Benefício Esperado:</p>
                          <p className="text-sm text-gray-800">{acao.beneficio_esperado}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!isLoading && itens.length === 0 && (
        <Card className="bg-white border-gray-200 rounded-xl shadow-md">
          <CardContent className="p-16 text-center">
            <Database className="w-20 h-20 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Nenhum dado encontrado</h3>
            <p className="text-gray-600 text-lg">Importe dados da Tabela SILI para começar a análise.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}