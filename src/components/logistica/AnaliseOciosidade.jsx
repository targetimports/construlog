import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AnaliseOciosidade({ veiculos, viagens }) {
  // Calcular dias úteis no período (aproximado)
  const diasUteis = 20; // Últimos 20 dias úteis como padrão

  const analiseVeiculos = veiculos.map(veiculo => {
    const viagensVeiculo = viagens.filter(v => v.veiculo_id === veiculo.id);
    const diasUtilizados = new Set(
      viagensVeiculo.map(v => v.data_saida ? new Date(v.data_saida).toDateString() : null).filter(Boolean)
    ).size;

    const taxaUtilizacao = (diasUtilizados / diasUteis) * 100;
    const diasOciosos = diasUteis - diasUtilizados;

    return {
      veiculo,
      viagensRealizadas: viagensVeiculo.length,
      diasUtilizados,
      diasOciosos,
      taxaUtilizacao: taxaUtilizacao.toFixed(1),
      status: taxaUtilizacao >= 70 ? 'otimo' : taxaUtilizacao >= 40 ? 'medio' : 'baixo'
    };
  }).sort((a, b) => a.taxaUtilizacao - b.taxaUtilizacao);

  const veiculosOciosos = analiseVeiculos.filter(a => a.status === 'baixo');
  const taxaMediaUtilizacao = analiseVeiculos.length > 0
    ? (analiseVeiculos.reduce((acc, a) => acc + parseFloat(a.taxaUtilizacao), 0) / analiseVeiculos.length).toFixed(1)
    : 0;

  const statusConfig = {
    otimo: { label: 'Ótimo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', barColor: 'bg-emerald-500' },
    medio: { label: 'Médio', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', barColor: 'bg-amber-500' },
    baixo: { label: 'Baixo', color: 'bg-red-500/10 text-red-400 border-red-500/20', barColor: 'bg-red-500' }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Análise de Ociosidade da Frota
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div>
            <p className="text-gray-400 text-sm mb-1">Taxa Média de Utilização</p>
            <p className="text-2xl font-bold text-white">{taxaMediaUtilizacao}%</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Veículos Ociosos</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-white">{veiculosOciosos.length}</p>
              {veiculosOciosos.length > 0 && (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {analiseVeiculos.map(({ veiculo, taxaUtilizacao, diasUtilizados, diasOciosos, viagensRealizadas, status }) => {
            const config = statusConfig[status];
            
            return (
              <div key={veiculo.id} className="p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-white font-medium">{veiculo.placa}</p>
                      <p className="text-gray-500 text-xs">{veiculo.modelo}</p>
                    </div>
                  </div>
                  <Badge className={cn("border", config.color)}>
                    {config.label}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Utilização</span>
                    <span className="text-white font-medium">{taxaUtilizacao}%</span>
                  </div>
                  <Progress 
                    value={parseFloat(taxaUtilizacao)} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{viagensRealizadas} viagens • {diasUtilizados} dias úteis</span>
                    {diasOciosos > 0 && (
                      <span className="text-red-400">{diasOciosos} dias ociosos</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}