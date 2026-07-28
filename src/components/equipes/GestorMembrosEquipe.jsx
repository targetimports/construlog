import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function GestorMembrosEquipe({ equipe, onMembrosAtualizados }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modoOperacao, setModoOperacao] = useState('add'); // 'add', 'remove', 'replace'
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('');
  const [colaboradorAntigo, setColaboradorAntigo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000,
  });

  const membrosDetalhados = colaboradores.filter(c =>
    equipe.colaboradores_ids?.includes(c.id)
  );

  // Lista todos os funcionários disponíveis (qualquer cargo), exceto inativos/
  // demitidos e contas de administrador geral / super admin.
  const colaboradoresAtivos = colaboradores.filter(c => {
    const cargo = String(c.cargo || '').toLowerCase();
    const ehAdminGeral = cargo === 'administrador' || cargo.includes('super') || c.role === 'admin';
    return c.status !== 'inativo' && c.status !== 'demitido' && !ehAdminGeral;
  });

  // Funcionários ainda não vinculados à equipe (opções para adicionar).
  const colaboradoresDisponiveis = colaboradoresAtivos.filter(c => !equipe.colaboradores_ids?.includes(c.id));

  const mutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      try {
        const atuais = Array.isArray(equipe.colaboradores_ids) ? [...equipe.colaboradores_ids] : [];
        let novos = atuais;
        let message = '';

        if (modoOperacao === 'add') {
          novos = Array.from(new Set([...atuais, colaboradorSelecionado]));
          message = 'Membro adicionado à equipe.';
        } else if (modoOperacao === 'remove') {
          novos = atuais.filter(id => id !== colaboradorSelecionado);
          message = 'Membro removido da equipe.';
        } else if (modoOperacao === 'replace') {
          novos = Array.from(new Set([...atuais.filter(id => id !== colaboradorAntigo), colaboradorSelecionado]));
          message = 'Membro substituído.';
        }

        await base44.entities.Equipe.update(equipe.id, { colaboradores_ids: novos });

        // Registra no histórico (LogAuditoria) — lido pelo HistoricoMembrosEquipe.
        const nomeColab = colaboradores.find(c => c.id === colaboradorSelecionado)?.nome || colaboradorSelecionado;
        const nomeAntigo = colaboradores.find(c => c.id === colaboradorAntigo)?.nome;
        const acaoLog = modoOperacao === 'add' ? 'ADD' : modoOperacao === 'remove' ? 'REMOVE' : 'REPLACE';
        try {
          await base44.entities.LogAuditoria.create({
            entidade: 'Equipe',
            entidade_id: equipe.id,
            acao: acaoLog,
            data_hora: new Date().toISOString(),
            user_email: currentUser?.email || '',
            dados_novos: {
              colaborador_id: nomeColab,
              ...(acaoLog === 'REPLACE' && nomeAntigo ? { motivo: `Substituiu ${nomeAntigo}` } : {}),
            },
          });
        } catch (e) {
          // Histórico é complementar — não bloqueia a operação principal.
          console.warn('[GestorMembros] falha ao registrar histórico:', e?.message);
        }

        return { message };
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      queryClient.invalidateQueries({ queryKey: ['historico-equipe', equipe.id] });
      resetDialog();
      onMembrosAtualizados?.();
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao processar');
    }
  });

  const resetDialog = () => {
    setDialogOpen(false);
    setModoOperacao('add');
    setColaboradorSelecionado('');
    setColaboradorAntigo('');
  };

  const handleSubmit = () => {
    if (!colaboradorSelecionado) {
      toast.error('Selecione um colaborador');
      return;
    }

    if (modoOperacao === 'replace' && !colaboradorAntigo) {
      toast.error('Selecione quem será substituído');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Header com botão */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Gerenciar Membros ({membrosDetalhados.length})</h4>
        <Button
          onClick={() => setDialogOpen(true)}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Lista de membros */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {membrosDetalhados.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Nenhum membro adicionado</p>
        ) : (
          membrosDetalhados.map(membro => (
            <div
              key={membro.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">{membro.nome}</p>
                <p className="text-xs text-gray-600">{membro.cargo}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setColaboradorSelecionado(membro.id);
                    setModoOperacao('remove');
                    setDialogOpen(true);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modoOperacao === 'add' && 'Adicionar Membro'}
              {modoOperacao === 'remove' && 'Remover Membro'}
              {modoOperacao === 'replace' && 'Substituir Membro'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Modo de operação (só mostra se não estiver em remove) */}
            {modoOperacao !== 'remove' && (
              <div>
                <label className="block text-sm font-medium mb-2">Operação</label>
                <div className="flex gap-2">
                  <Button
                    variant={modoOperacao === 'add' ? 'default' : 'outline'}
                    onClick={() => {
                      setModoOperacao('add');
                      setColaboradorAntigo('');
                    }}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                  <Button
                    variant={modoOperacao === 'replace' ? 'default' : 'outline'}
                    onClick={() => setModoOperacao('replace')}
                    className="flex-1"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-1" />
                    Substituir
                  </Button>
                </div>
              </div>
            )}

            {/* Remover: confirmar */}
            {modoOperacao === 'remove' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Tem certeza que deseja remover <strong>{colaboradores.find(c => c.id === colaboradorSelecionado)?.nome}</strong> da equipe?
                </p>
              </div>
            )}

            {/* Adicionar: selecionar colaborador */}
            {modoOperacao === 'add' && (
              <div>
                <label className="block text-sm font-medium mb-2">Colaborador *</label>
                <Select value={colaboradorSelecionado} onValueChange={setColaboradorSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)]">
                    {colaboradoresDisponiveis.length > 0 ? (
                      colaboradoresDisponiveis.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.cargo})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">Nenhum funcionário disponível.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Replace: selecionar antigo e novo */}
            {modoOperacao === 'replace' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Remover (atual) *</label>
                  <Select value={colaboradorAntigo} onValueChange={setColaboradorAntigo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione quem sair..." />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {membrosDetalhados.length > 0 ? (
                        membrosDetalhados.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">Nenhum funcionário na equipe.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Adicionar (novo) *</label>
                  <Select value={colaboradorSelecionado} onValueChange={setColaboradorSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione quem entra..." />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {colaboradoresDisponiveis.length > 0 ? (
                        colaboradoresDisponiveis.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} ({c.cargo})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">Nenhum funcionário disponível.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetDialog} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={mutation.isPending || isProcessing}
                className={modoOperacao === 'remove' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {mutation.isPending || isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  modoOperacao === 'remove' ? 'Remover' : 'Salvar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}