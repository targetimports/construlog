import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Award, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RankingGestores({ obras, colaboradores, contas }) {
  // Agrupar obras por responsável técnico
  const gestoresMap = {};

  obras.forEach(obra => {
    const gestor = obra.responsavel_tecnico || 'Não atribuído';
    if (!gestoresMap[gestor]) {
      gestoresMap[gestor] = {
        nome: gestor,
        obras: [],
        totalReceitas: 0,
        totalDespesas: 0,
        obrasNoPrazo: 0,
        totalObras: 0
      };
    }

    gestoresMap[gestor].obras.push(obra);
    gestoresMap[gestor].totalObras++;

    // Receitas e Despesas
    const contasObra = contas.filter(c => c.obra_id === obra.id);
    const receitas = contasObra.filter(c => c.tipo === 'receber' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    const despesas = contasObra.filter(c => c.tipo === 'pagar' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);

    gestoresMap[gestor].totalReceitas += receitas;
    gestoresMap[gestor].totalDespesas += despesas;

    // Verificar prazo
    if (obra.status === 'em_andamento' && obra.data_prevista_fim) {
      const hoje = new Date();
      const previsao = new Date(obra.data_prevista_fim);
      if (previsao >= hoje) {
        gestoresMap[gestor].obrasNoPrazo++;
      }
    }
  });

  // Calcular score para cada gestor
  const gestoresComScore = Object.values(gestoresMap)
    .filter(g => g.nome !== 'Não atribuído' && g.totalObras > 0)
    .map(gestor => {
      const margem = gestor.totalReceitas > 0 
        ? ((gestor.totalReceitas - gestor.totalDespesas) / gestor.totalReceitas) * 100 
        : 0;

      const obrasAtivasNoPrazo = gestor.obrasNoPrazo;
      const taxaNoPrazo = gestor.totalObras > 0 
        ? (obrasAtivasNoPrazo / gestor.totalObras) * 100 
        : 100;

      // Score: 50% margem + 50% cumprimento de prazo
      const scoreMargem = Math.max(0, Math.min(margem * 2.5, 50));
      const scorePrazo = taxaNoPrazo * 0.5;
      const scoreTotal = scoreMargem + scorePrazo;

      return {
        ...gestor,
        margem,
        taxaNoPrazo,
        scoreTotal: Math.round(scoreTotal)
      };
    })
    .sort((a, b) => b.scoreTotal - a.scoreTotal);

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            Top Gestores por Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gestoresComScore.slice(0, 10).map((gestor, index) => {
            const isPodio = index < 3;

            return (
              <div
                key={gestor.nome}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  isPodio 
                    ? "bg-gradient-to-r from-purple-500/5 to-transparent border-purple-500/20" 
                    : "bg-gray-800/50 border-gray-700"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Posição */}
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg",
                    isPodio 
                      ? "bg-purple-500 text-white" 
                      : "bg-gray-700 text-gray-400"
                  )}>
                    {index === 0 && ''}
                    {index === 1 && ''}
                    {index === 2 && ''}
                    {index > 2 && `${index + 1}º`}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg mb-1">{gestor.nome}</h3>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                            <Building2 className="w-3 h-3 mr-1" />
                            {gestor.totalObras} {gestor.totalObras === 1 ? 'obra' : 'obras'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-3xl font-bold",
                          gestor.scoreTotal >= 80 ? "text-emerald-400" :
                          gestor.scoreTotal >= 60 ? "text-blue-400" :
                          gestor.scoreTotal >= 40 ? "text-amber-400" : "text-red-400"
                        )}>
                          {gestor.scoreTotal}
                        </p>
                        <p className="text-xs text-gray-500">Score</p>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-gray-800 rounded-lg">
                        <p className="text-gray-500 text-xs mb-1">Margem Média</p>
                        <p className="text-white font-bold">{gestor.margem.toFixed(1)}%</p>
                      </div>
                      <div className="p-3 bg-gray-800 rounded-lg">
                        <p className="text-gray-500 text-xs mb-1">Obras no Prazo</p>
                        <p className="text-white font-bold">{gestor.obrasNoPrazo}/{gestor.totalObras}</p>
                      </div>
                      <div className="p-3 bg-gray-800 rounded-lg">
                        <p className="text-gray-500 text-xs mb-1">Taxa Prazo</p>
                        <p className="text-white font-bold">{gestor.taxaNoPrazo.toFixed(0)}%</p>
                      </div>
                    </div>

                    {/* Financeiro */}
                    <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500">Total Receitas: </span>
                        <span className="text-emerald-400 font-medium block mt-1">
                          {gestor.totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Lucro: </span>
                        <span className="text-blue-400 font-medium block mt-1">
                          {(gestor.totalReceitas - gestor.totalDespesas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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