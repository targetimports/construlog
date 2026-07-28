import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KPIDashboard({ obra, contas }) {
  // Fallback cadeia de múltiplas fontes para valor orçado
  const valorOrcado =
    (obra?.valor_orcado > 0 ? obra.valor_orcado : null) ??
    (obra?.total_orcamento > 0 ? obra.total_orcamento : null) ??
    0;
  
  const totalDespesas = contas
    .filter(c => c.tipo === 'pagar')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const custoVsOrcado = valorOrcado > 0
    ? ((totalDespesas / valorOrcado) * 100).toFixed(1)
    : 0;

  // Prazo: só calcular se houver datas definidas
  const diasPassados = obra.data_inicio 
    ? Math.floor((new Date() - new Date(obra.data_inicio)) / (1000 * 60 * 60 * 24))
    : null;

  const diasRestantes = obra.data_prevista_fim
    ? Math.floor((new Date(obra.data_prevista_fim) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const isCustoExcedido = valorOrcado > 0 && Number(custoVsOrcado) > 100;
  const isAtrasado = diasRestantes !== null && diasRestantes < 0;
  const progressoFisico = obra.percentual_concluido || 0;

  // Indicador de saúde do projeto
  const projetoSaudavel = !isCustoExcedido && !isAtrasado && progressoFisico >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI: Progresso Físico */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Progresso Físico</p>
              <p className="text-3xl font-bold text-white">{progressoFisico}%</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <Progress value={progressoFisico} className="h-2 bg-gray-800" />
          <p className="text-xs text-gray-500 mt-2">
            {progressoFisico >= 75 ? 'Próximo da conclusão' : progressoFisico >= 50 ? 'Em bom andamento' : 'Em fase inicial'}
          </p>
        </CardContent>
      </Card>

      {/* KPI: Custo vs Orçado */}
      <Card className={cn(
        "bg-gradient-to-br border",
        isCustoExcedido 
          ? "from-red-500/10 to-red-500/5 border-red-500/20" 
          : "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Custo vs Orçado</p>
              {valorOrcado > 0 ? (
                <p className={cn(
                  "text-3xl font-bold",
                  isCustoExcedido ? "text-red-400" : "text-emerald-400"
                )}>
                  {custoVsOrcado}%
                </p>
              ) : (
                <p className="text-lg text-gray-500">—</p>
              )}
            </div>
            <div className={cn(
              "p-3 rounded-lg",
              isCustoExcedido ? "bg-red-500/20" : "bg-emerald-500/20"
            )}>
              {isCustoExcedido ? (
                <TrendingUp className="w-6 h-6 text-red-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Realizado</span>
              <span className="text-white">
                {totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Orçado</span>
              <span className="text-gray-400">
                {valorOrcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Prazo */}
      <Card className={cn(
        "bg-gradient-to-br border",
        isAtrasado 
          ? "from-amber-500/10 to-amber-500/5 border-amber-500/20" 
          : "from-purple-500/10 to-purple-500/5 border-purple-500/20"
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Prazo</p>
              {diasRestantes !== null ? (
                <p className={cn(
                  "text-3xl font-bold",
                  isAtrasado ? "text-amber-400" : "text-purple-400"
                )}>
                  {Math.abs(diasRestantes)}d
                </p>
              ) : (
                <p className="text-lg text-gray-500">—</p>
              )}
            </div>
            <div className={cn(
              "p-3 rounded-lg",
              isAtrasado ? "bg-amber-500/20" : "bg-purple-500/20"
            )}>
              <Calendar className={cn(
                "w-6 h-6",
                isAtrasado ? "text-amber-400" : "text-purple-400"
              )} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {diasRestantes !== null ? (
              isAtrasado 
                ? `${Math.abs(diasRestantes)} dias de atraso` 
                : `${diasRestantes} dias restantes`
            ) : 'Prazo não definido'}
          </p>
          {diasPassados !== null && diasPassados > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {diasPassados} dias decorridos
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI: Saúde do Projeto */}
      <Card className={cn(
        "bg-gradient-to-br border",
        projetoSaudavel 
          ? "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20" 
          : "from-amber-500/10 to-amber-500/5 border-amber-500/20"
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Saúde do Projeto</p>
              <p className={cn(
                "text-3xl font-bold",
                projetoSaudavel ? "text-emerald-400" : "text-amber-400"
              )}>
                {projetoSaudavel ? 'Saudável' : 'Atenção'}
              </p>
            </div>
            <div className={cn(
              "p-3 rounded-lg",
              projetoSaudavel ? "bg-emerald-500/20" : "bg-amber-500/20"
            )}>
              {projetoSaudavel ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              )}
            </div>
          </div>
          <div className="space-y-1 text-xs">
            {isCustoExcedido && (
              <p className="text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                Custo excedido
              </p>
            )}
            {isAtrasado && (
              <p className="text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                Prazo atrasado
              </p>
            )}
            {projetoSaudavel && (
              <p className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Dentro do planejado
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}