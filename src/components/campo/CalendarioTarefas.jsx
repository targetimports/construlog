import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CalendarioTarefas({ obraId, onTarefaClick }) {
  const [mesAtual, setMesAtual] = useState(new Date());

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas-campo', obraId],
    queryFn: () => base44.entities.TarefaCampo.filter({ obra_id: obraId }),
    enabled: !!obraId && navigator.onLine
  });

  const mudarMes = (direcao) => {
    const novoMes = new Date(mesAtual);
    novoMes.setMonth(mesAtual.getMonth() + direcao);
    setMesAtual(novoMes);
  };

  const getDiasDoMes = () => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    
    const dias = [];
    const diaSemanaInicio = primeiroDia.getDay();
    
    // Dias do mês anterior para preencher
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const dia = new Date(ano, mes, -i);
      dias.push({ data: dia, mesAtual: false });
    }
    
    // Dias do mês atual
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      dias.push({ data: new Date(ano, mes, dia), mesAtual: true });
    }
    
    // Dias do próximo mês para completar
    const diasRestantes = 42 - dias.length;
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({ data: new Date(ano, mes + 1, i), mesAtual: false });
    }
    
    return dias;
  };

  const getTarefasDoDia = (data) => {
    const dataStr = data.toISOString().split('T')[0];
    return tarefas.filter(t => t.data_prazo === dataStr);
  };

  const getPrioridadeMaisAlta = (tarefasDia) => {
    const prioridades = { urgente: 4, alta: 3, normal: 2, baixa: 1 };
    let maxPrioridade = 0;
    let prioridadeStr = 'normal';
    
    tarefasDia.forEach(t => {
      if (prioridades[t.prioridade] > maxPrioridade) {
        maxPrioridade = prioridades[t.prioridade];
        prioridadeStr = t.prioridade;
      }
    });
    
    return prioridadeStr;
  };

  const getCorPrioridade = (prioridade, tarefasDia) => {
    const temAtrasada = tarefasDia.some(t => {
      const prazo = new Date(t.data_prazo);
      return prazo < new Date() && t.status !== 'concluida';
    });

    if (temAtrasada) return 'bg-red-500/20 border-red-500';
    
    const cores = {
      urgente: 'bg-red-500/10 border-red-500/30',
      alta: 'bg-amber-500/10 border-amber-500/30',
      normal: 'bg-blue-500/10 border-blue-500/30',
      baixa: 'bg-gray-500/10 border-gray-500/30'
    };
    
    return cores[prioridade] || cores.normal;
  };

  const dias = getDiasDoMes();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Calendário de Tarefas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => mudarMes(-1)}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-white font-medium min-w-[150px] text-center">
              {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => mudarMes(1)}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
            <div key={dia} className="text-center text-xs font-medium text-gray-500 py-2">
              {dia}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-1">
          {dias.map((dia, index) => {
            const tarefasDia = getTarefasDoDia(dia.data);
            const temTarefas = tarefasDia.length > 0;
            const ehHoje = dia.data.getTime() === hoje.getTime();
            const prioridade = getPrioridadeMaisAlta(tarefasDia);
            const corDia = getCorPrioridade(prioridade, tarefasDia);

            return (
              <button
                key={index}
                onClick={() => temTarefas && onTarefaClick && onTarefaClick(dia.data, tarefasDia)}
                className={cn(
                  "aspect-square p-1 rounded-lg border transition-all relative",
                  dia.mesAtual ? "bg-gray-800 border-gray-700" : "bg-gray-900 border-gray-800 opacity-50",
                  ehHoje && "ring-2 ring-blue-500",
                  temTarefas && "cursor-pointer hover:scale-105",
                  temTarefas && corDia
                )}
              >
                <div className={cn(
                  "text-sm font-medium",
                  dia.mesAtual ? "text-white" : "text-gray-600",
                  ehHoje && "text-blue-400"
                )}>
                  {dia.data.getDate()}
                </div>
                
                {temTarefas && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    <div className={cn(
                      "w-1 h-1 rounded-full",
                      tarefasDia.some(t => t.status === 'concluida') ? "bg-emerald-500" : 
                      tarefasDia.some(t => new Date(t.data_prazo) < hoje && t.status !== 'concluida') ? "bg-red-500" :
                      "bg-blue-500"
                    )} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-400">Concluída</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-400">Pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-400">Atrasada</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}