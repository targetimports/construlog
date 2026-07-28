import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Link2, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function GerenciarDependencias({ open, onOpenChange, tarefa, dependenciasAtuais = [], onSalvar }) {
  const [dependenciasSelecionadas, setDependenciasSelecionadas] = useState(dependenciasAtuais);

  const { data: todasTarefas = [] } = useQuery({
    queryKey: ['tarefas-campo', tarefa?.obra_id],
    queryFn: () => base44.entities.TarefaCampo.filter({ obra_id: tarefa?.obra_id }),
    enabled: !!tarefa?.obra_id && open
  });

  // Filtrar tarefas que podem ser dependências (excluir a própria tarefa e subtarefas)
  const tarefasDisponiveis = todasTarefas.filter(t => 
    t.id !== tarefa?.id && 
    t.tarefa_pai_id !== tarefa?.id &&
    t.status !== 'cancelada'
  );

  const toggleDependencia = (tarefaId) => {
    setDependenciasSelecionadas(prev => 
      prev.includes(tarefaId)
        ? prev.filter(id => id !== tarefaId)
        : [...prev, tarefaId]
    );
  };

  const handleSalvar = () => {
    onSalvar(dependenciasSelecionadas);
    onOpenChange(false);
  };

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-gray-500/10 text-gray-400' },
    em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400' },
    concluida: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-400' },
    bloqueada: { label: 'Bloqueada', color: 'bg-red-500/10 text-red-400' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-500" />
            Gerenciar Dependências
          </DialogTitle>
          <p className="text-gray-400 text-sm mt-1">
            Selecione as tarefas que precisam ser concluídas antes de iniciar "{tarefa?.titulo}"
          </p>
        </DialogHeader>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
            <div className="text-sm text-amber-400">
              <p>A tarefa ficará <strong>bloqueada</strong> até que todas as dependências sejam concluídas.</p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {tarefasDisponiveis.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma tarefa disponível para adicionar como dependência
              </div>
            ) : (
              tarefasDisponiveis.map(t => {
                const selecionada = dependenciasSelecionadas.includes(t.id);
                const status = statusConfig[t.status];

                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <Checkbox
                      checked={selecionada}
                      onCheckedChange={() => toggleDependencia(t.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium truncate">{t.titulo}</h4>
                        {t.status === 'concluida' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      {t.descricao && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-2">{t.descricao}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                        {t.data_prazo && (
                          <Badge variant="outline" className="border-gray-600 text-gray-400">
                            {new Date(t.data_prazo).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-400"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            className="bg-blue-500 hover:bg-blue-600"
          >
            Salvar Dependências ({dependenciasSelecionadas.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}