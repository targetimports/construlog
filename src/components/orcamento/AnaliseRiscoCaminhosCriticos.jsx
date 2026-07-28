import React, { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter 
} from 'recharts';
import { cn } from '@/lib/utils';

export default function AnaliseRiscoCaminhosCriticos({ itensOrcamento, analise }) {
  const dadosCaminhosCriticos = useMemo(() => {
    if (!analise?.caminho_critico_identificado) return null;

    const cc = analise.caminho_critico_identificado;
    const scoreRiscosMap = {};
    
    analise.pontos_risco?.forEach(risco => {
      scoreRiscosMap[risco.item_orcamento_id] = risco;
    });

    return {
      caminhoCritico: cc,
      pontosRisco: analise.pontos_risco || [],
      duracaoTotal: analise.duracao_total_projeto,
      dataTermino: analise.data_termino_prevista,
      scoreRiscosMap,
      cenarios: analise.cenarios_simulados || []
    };
  }, [analise]);

  if (!dadosCaminhosCriticos) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Análise de caminho crítico não disponível</p>
        </CardContent>
      </Card>
    );
  }

  const { caminhoCritico, pontosRisco, duracaoTotal, scoreRiscosMap, cenarios } = dadosCaminhosCriticos;
  const countAlta = pontosRisco.filter(p => p.score_risco >= 70).length;
  const countMedia = pontosRisco.filter(p => p.score_risco >= 40 && p.score_risco < 70).length;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Duração Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{duracaoTotal}</p>
            <p className="text-xs text-gray-500 mt-1">dias de projeto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Atividades Críticas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{caminhoCritico.length}</p>
            <p className="text-xs text-gray-500 mt-1">sem folga</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Riscos Altos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{countAlta}</p>
            <p className="text-xs text-gray-500 mt-1">atenção necessária</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Riscos Médios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{countMedia}</p>
            <p className="text-xs text-gray-500 mt-1">monitorar</p>
          </CardContent>
        </Card>
      </div>

      {/* Caminho Crítico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Caminho Crítico Identificado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {caminhoCritico.map((item, idx) => {
              const risco = scoreRiscosMap[item.item_orcamento_id];
              const criticidade = item.nivel_criticidade || 'media';
              
              return (
                <div key={item.item_orcamento_id} className="border border-red-200 bg-red-50 rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.descricao}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.duracao_dias} dias | Folga: {item.folga_total} dias
                      </p>
                    </div>
                    <Badge className={cn(
                      criticidade === 'critica' ? 'bg-red-600 text-white' :
                      criticidade === 'alta' ? 'bg-orange-500 text-white' :
                      'bg-yellow-500 text-white'
                    )}>
                      {criticidade}
                    </Badge>
                  </div>
                  
                  {risco && (
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {risco.tipo_risco.replace(/_/g, ' ')} - Score: {risco.score_risco}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pontos de Risco */}
      {pontosRisco.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Análise de Riscos Detalhada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {pontosRisco.sort((a, b) => b.score_risco - a.score_risco).map((risco) => {
                const item = caminhoCritico.find(i => i.item_orcamento_id === risco.item_orcamento_id);
                
                return (
                  <div key={risco.item_orcamento_id} className="border border-gray-200 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {item?.descricao || 'Item desconhecido'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 capitalize">
                          {risco.tipo_risco.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-lg font-bold',
                          risco.score_risco >= 70 ? 'text-red-600' :
                          risco.score_risco >= 40 ? 'text-orange-600' :
                          'text-yellow-600'
                        )}>
                          {risco.score_risco}%
                        </p>
                      </div>
                    </div>
                    
                    <Progress 
                      value={risco.score_risco} 
                      className="mb-2 h-1.5"
                    />
                    
                    {risco.recomendacao && (
                      <p className="text-xs text-gray-600 italic">
                        {risco.recomendacao}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cenários */}
      {cenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cenários Simulados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cenarios.map((cenario) => (
                <div key={cenario.nome_cenario} className="border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900 capitalize">
                        {cenario.tipo} - {cenario.nome_cenario}
                      </h4>
                    </div>
                    <Badge variant="outline">
                      {cenario.duracao_dias} dias
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-600">Impacto Financeiro</p>
                      <p className="font-semibold text-gray-900">
                        R$ {(cenario.impacto_financeiro || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2
                        })}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-600">Variação Cronograma</p>
                      <p className={cn(
                        'font-semibold',
                        cenario.duracao_dias > duracaoTotal ? 'text-red-600' : 'text-green-600'
                      )}>
                        {cenario.duracao_dias > duracaoTotal ? '+' : ''}
                        {cenario.duracao_dias - duracaoTotal} dias
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}