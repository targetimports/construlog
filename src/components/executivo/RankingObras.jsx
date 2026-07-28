import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Target, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RankingObras({ obras, contas, medicoes }) {
  // Calcular score para cada obra
  const obrasComScore = obras.map(obra => {
    const contasObra = contas.filter(c => c.obra_id === obra.id);
    const medicoesObra = medicoes.filter(m => m.obra_id === obra.id);
    
    // Receitas e Despesas
    const receitas = contasObra.filter(c => c.tipo === 'receber' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    const despesas = contasObra.filter(c => c.tipo === 'pagar' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    const margem = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

    // Progresso
    const progresso = obra.percentual_concluido || 0;

    // Eficiência medições
    const medicoesAprovadas = medicoesObra.filter(m => m.status === 'aprovada').length;
    const eficienciaMedicoes = medicoesObra.length > 0 
      ? (medicoesAprovadas / medicoesObra.length) * 100 
      : 100;

    // Score geral (0-100)
    const scoreMargem = Math.max(0, Math.min(margem * 2, 40)); // Até 40 pontos
    const scoreProgresso = progresso * 0.3; // Até 30 pontos
    const scoreEficiencia = eficienciaMedicoes * 0.3; // Até 30 pontos
    const scoreTotal = scoreMargem + scoreProgresso + scoreEficiencia;

    // Classificação
    let classificacao = 'regular';
    if (scoreTotal >= 80) classificacao = 'excelente';
    else if (scoreTotal >= 60) classificacao = 'bom';
    else if (scoreTotal >= 40) classificacao = 'regular';
    else classificacao = 'critico';

    return {
      obra,
      scoreTotal: Math.round(scoreTotal),
      margem,
      progresso,
      eficienciaMedicoes,
      classificacao,
      receitas,
      despesas
    };
  });

  // Ordenar por score
  const obrasRankeadas = obrasComScore
    .filter(o => o.obra.status !== 'concluida' && o.obra.status !== 'cancelada')
    .sort((a, b) => b.scoreTotal - a.scoreTotal);

  const classificacaoConfig = {
    excelente: { label: 'Excelente', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: '' },
    bom: { label: 'Bom', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: '' },
    regular: { label: 'Regular', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '' },
    critico: { label: 'Crítico', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: '' }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Top Obras por Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {obrasRankeadas.slice(0, 10).map((item, index) => {
            const config = classificacaoConfig[item.classificacao];
            const isPodio = index < 3;

            return (
              <div
                key={item.obra.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  isPodio 
                    ? "bg-gradient-to-r from-amber-500/5 to-transparent border-amber-500/20" 
                    : "bg-gray-800/50 border-gray-700"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Posição */}
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg",
                    isPodio 
                      ? "bg-amber-500 text-gray-900" 
                      : "bg-gray-700 text-gray-400"
                  )}>
                    {index === 0 && ''}
                    {index === 1 && ''}
                    {index === 2 && ''}
                    {index > 2 && `${index + 1}º`}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-white font-semibold mb-1">{item.obra.nome}</h3>
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>
                            {config.icon} {config.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-gray-400">
                            {item.obra.cliente}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-3xl font-bold",
                          item.scoreTotal >= 80 ? "text-emerald-400" :
                          item.scoreTotal >= 60 ? "text-blue-400" :
                          item.scoreTotal >= 40 ? "text-amber-400" : "text-red-400"
                        )}>
                          {item.scoreTotal}
                        </p>
                        <p className="text-xs text-gray-500">Score</p>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <div className="flex items-center gap-1 text-gray-500 mb-1">
                          <DollarSign className="w-3 h-3" />
                          <span>Margem</span>
                        </div>
                        <p className="text-white font-semibold">{item.margem.toFixed(1)}%</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-500 mb-1">
                          <Target className="w-3 h-3" />
                          <span>Progresso</span>
                        </div>
                        <p className="text-white font-semibold">{item.progresso.toFixed(0)}%</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-gray-500 mb-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>Eficiência</span>
                        </div>
                        <p className="text-white font-semibold">{item.eficienciaMedicoes.toFixed(0)}%</p>
                      </div>
                    </div>

                    {/* Financeiro */}
                    <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-xs">
                      <div>
                        <span className="text-gray-500">Receitas: </span>
                        <span className="text-emerald-400 font-medium">
                          {item.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Despesas: </span>
                        <span className="text-red-400 font-medium">
                          {item.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}