import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckSquare, MapPin, Video, Image as ImageIcon, Check, X, Plus, ChevronDown, ChevronRight, Users, Link2, Lock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FilaSincronizacao } from './FilaSincronizacao';
import TarefaFormDialog from './TarefaFormDialog';
import { useNotificacoesTarefas, NotificacoesTarefas } from './NotificacoesTarefas';
import CalendarioTarefas from './CalendarioTarefas';
import { GerenciarTemplatesChecklist } from './TemplatesChecklist';

const TAREFAS_CACHE_KEY = 'tarefas_offline_cache';

export default function GestorTarefasOffline({ obraId }) {
  const [tarefasLocal, setTarefasLocal] = useState([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [tarefaPaiSelecionada, setTarefaPaiSelecionada] = useState(null);
  const [tarefasExpandidas, setTarefasExpandidas] = useState({});
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [dialogTemplates, setDialogTemplates] = useState(false);
  const queryClient = useQueryClient();
  
  // Hook de notificações
  useNotificacoesTarefas(obraId);

  const { data: tarefasOnline = [] } = useQuery({
    queryKey: ['tarefas-campo', obraId],
    queryFn: () => base44.entities.TarefaCampo.filter({ obra_id: obraId }, '-created_date', 100),
    enabled: navigator.onLine
  });

  // Carregar cache offline
  useEffect(() => {
    try {
      const cache = localStorage.getItem(`${TAREFAS_CACHE_KEY}_${obraId}`);
      if (cache) {
        setTarefasLocal(JSON.parse(cache));
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
  }, [obraId]);

  // Atualizar cache quando dados online mudarem
  useEffect(() => {
    if (tarefasOnline.length > 0) {
      setTarefasLocal(tarefasOnline);
      try {
        localStorage.setItem(`${TAREFAS_CACHE_KEY}_${obraId}`, JSON.stringify(tarefasOnline));
      } catch (error) {
        console.error('Erro ao salvar cache:', error);
      }
    }
  }, [tarefasOnline, obraId]);

  const tarefas = navigator.onLine ? tarefasOnline : tarefasLocal;

  // Filtrar apenas tarefas principais (sem tarefa_pai_id)
  const tarefasPrincipais = tarefas.filter(t => !t.tarefa_pai_id);
  
  // Função para obter subtarefas
  const getSubtarefas = (tarefaId) => {
    return tarefas.filter(t => t.tarefa_pai_id === tarefaId);
  };

  // Toggle expansão de tarefa
  const toggleExpansao = (tarefaId) => {
    setTarefasExpandidas(prev => ({
      ...prev,
      [tarefaId]: !prev[tarefaId]
    }));
  };

  const abrirDialogSubtarefa = (tarefaPai) => {
    setTarefaPaiSelecionada(tarefaPai);
    setDialogAberto(true);
  };

  // Verificar se tarefa está bloqueada por dependências
  const estaBloqueada = (tarefa) => {
    if (!tarefa.dependencias || tarefa.dependencias.length === 0) return false;
    
    return tarefa.dependencias.some(depId => {
      const depTarefa = tarefas.find(t => t.id === depId);
      return depTarefa && depTarefa.status !== 'concluida';
    });
  };

  const atualizarTarefa = (tarefaId, dados) => {
    if (navigator.onLine) {
      // Online: enviar imediatamente
      base44.entities.TarefaCampo.update(tarefaId, dados).then(() => {
        queryClient.invalidateQueries(['tarefas-campo']);
        toast.success('Atualizado!');
      });
    } else {
      // Offline: adicionar à fila e atualizar cache local
      FilaSincronizacao.adicionar('tarefa_atualizar', { id: tarefaId, data: dados });
      
      const novasTarefas = tarefasLocal.map(t => 
        t.id === tarefaId ? { ...t, ...dados } : t
      );
      setTarefasLocal(novasTarefas);
      localStorage.setItem(`${TAREFAS_CACHE_KEY}_${obraId}`, JSON.stringify(novasTarefas));
      
      toast.info('Salvo offline. Será sincronizado quando conectar.');
    }
  };

  const toggleItemChecklist = (tarefa, itemIndex) => {
    const novosItens = [...(tarefa.itens_checklist || [])];
    novosItens[itemIndex] = {
      ...novosItens[itemIndex],
      concluido: !novosItens[itemIndex].concluido,
      data_conclusao: !novosItens[itemIndex].concluido ? new Date().toISOString() : null
    };
    atualizarTarefa(tarefa.id, { itens_checklist: novosItens });
  };

  const mudarStatus = (tarefa, novoStatus) => {
    atualizarTarefa(tarefa.id, {
      status: novoStatus,
      data_conclusao: novoStatus === 'concluida' ? new Date().toISOString() : null
    });
    
    // Enviar notificação sobre mudança de status
    NotificacoesTarefas.notificarAtualizacao(tarefa, novoStatus);
  };

  const prioridadeConfig = {
    baixa: { color: 'bg-blue-500/10 text-blue-400', label: 'Baixa' },
    normal: { color: 'bg-gray-500/10 text-gray-400', label: 'Normal' },
    alta: { color: 'bg-amber-500/10 text-amber-400', label: 'Alta' },
    urgente: { color: 'bg-red-500/10 text-red-400', label: 'Urgente' }
  };

  const statusConfig = {
    pendente: { color: 'bg-gray-500/10 text-gray-400', label: 'Pendente' },
    em_andamento: { color: 'bg-blue-500/10 text-blue-400', label: 'Em Andamento' },
    concluida: { color: 'bg-emerald-500/10 text-emerald-400', label: 'Concluída' },
    cancelada: { color: 'bg-red-500/10 text-red-400', label: 'Cancelada' }
  };

  const tarefasPendentes = tarefasPrincipais.filter(t => t.status !== 'concluida' && t.status !== 'cancelada');

  const renderTarefa = (tarefa, isSubtarefa = false) => {
    const subtarefas = getSubtarefas(tarefa.id);
    const hasSubtarefas = subtarefas.length > 0;
    const isExpanded = tarefasExpandidas[tarefa.id];
    const bloqueada = estaBloqueada(tarefa);
    const hasDependencias = tarefa.dependencias && tarefa.dependencias.length > 0;

    return (
      <div key={tarefa.id} className={cn("space-y-2", isSubtarefa && "ml-8")}>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={prioridadeConfig[tarefa.prioridade]?.color}>
                    {prioridadeConfig[tarefa.prioridade]?.label}
                  </Badge>
                  <Badge className={statusConfig[tarefa.status]?.color}>
                    {statusConfig[tarefa.status]?.label}
                  </Badge>
                  {tarefa.responsaveis && tarefa.responsaveis.length > 1 && (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      <Users className="w-3 h-3 mr-1" />
                      {tarefa.responsaveis.length}
                    </Badge>
                  )}
                  {bloqueada && (
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                      <Lock className="w-3 h-3 mr-1" />
                      Bloqueada
                    </Badge>
                  )}
                  {hasDependencias && !bloqueada && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      <Link2 className="w-3 h-3 mr-1" />
                      {tarefa.dependencias.length}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  {hasSubtarefas && (
                    <button
                      onClick={() => toggleExpansao(tarefa.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <h4 className="text-white font-medium">{tarefa.titulo}</h4>
                </div>
                
                {tarefa.descricao && (
                  <p className="text-gray-400 text-sm mb-2">{tarefa.descricao}</p>
                )}

                {tarefa.responsaveis && tarefa.responsaveis.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tarefa.responsaveis.slice(0, 3).map(email => (
                      <Badge key={email} variant="outline" className="text-xs border-gray-600">
                        {email.split('@')[0]}
                      </Badge>
                    ))}
                    {tarefa.responsaveis.length > 3 && (
                      <Badge variant="outline" className="text-xs border-gray-600">
                        +{tarefa.responsaveis.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {tarefa.itens_checklist && tarefa.itens_checklist.length > 0 && (
              <div className="space-y-2 mb-3">
                {tarefa.itens_checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-900 rounded">
                    <Checkbox
                      checked={item.concluido}
                      onCheckedChange={() => toggleItemChecklist(tarefa, idx)}
                    />
                    <span className={cn(
                      "text-sm flex-1",
                      item.concluido ? "text-gray-500 line-through" : "text-gray-300"
                    )}>
                      {item.texto}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {tarefa.status !== 'concluida' && (
                <>
                  {tarefa.status === 'pendente' && (
                    <Button
                      size="sm"
                      onClick={() => mudarStatus(tarefa, bloqueada ? 'bloqueada' : 'em_andamento')}
                      disabled={bloqueada}
                      className="bg-blue-500 hover:bg-blue-600 text-xs"
                      title={bloqueada ? 'Tarefa bloqueada por dependências' : ''}
                    >
                      {bloqueada ? 'Bloqueada' : 'Iniciar'}
                    </Button>
                  )}
                  {tarefa.status === 'em_andamento' && (
                    <Button
                      size="sm"
                      onClick={() => mudarStatus(tarefa, 'concluida')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-xs"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Concluir
                    </Button>
                  )}
                  {!isSubtarefa && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDialogSubtarefa(tarefa)}
                      className="border-gray-600 text-gray-400 hover:bg-gray-700 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Subtarefa
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Renderizar subtarefas se expandido */}
        {hasSubtarefas && isExpanded && (
          <div className="space-y-2">
            {subtarefas.map(sub => renderTarefa(sub, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-purple-500" />
            Tarefas & Checklists
            <Badge className="bg-purple-500/10 text-purple-400">
              {tarefasPendentes.length} ativas
            </Badge>
            {!navigator.onLine && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                Modo Offline
              </Badge>
            )}
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMostrarCalendario(!mostrarCalendario)}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              <Calendar className="w-4 h-4 mr-1" />
              {mostrarCalendario ? 'Ocultar' : 'Calendário'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogTemplates(true)}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              <CheckSquare className="w-4 h-4 mr-1" />
              Templates
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTarefaPaiSelecionada(null);
                setDialogAberto(true);
              }}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nova
            </Button>
          </div>
        </div>

        {mostrarCalendario && (
          <CalendarioTarefas
            obraId={obraId}
            onTarefaClick={(data, tarefas) => {
              toast.info(`${tarefas.length} tarefa(s) neste dia`);
            }}
          />
        )}

        <div className="space-y-3">
          {tarefasPrincipais.map(tarefa => renderTarefa(tarefa))}
        </div>
      </div>

      <TarefaFormDialog
        open={dialogAberto}
        onOpenChange={(open) => {
          setDialogAberto(open);
          if (!open) setTarefaPaiSelecionada(null);
        }}
        obraId={obraId}
        tarefaPai={tarefaPaiSelecionada}
      />

      <GerenciarTemplatesChecklist
        open={dialogTemplates}
        onOpenChange={setDialogTemplates}
      />
    </>
  );
}