import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function GerenciadorEtapas({
  obraId,
  etapas,
  etapaSelecionada,
  onEtapaSelect,
  onEtapaCriada,
  onEtapaAtualizada,
  mostrarForm,
  onToggleForm
}) {
  const [novaEtapa, setNovaEtapa] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNome, setEditandoNome] = useState('');

  const createMutation = useMutation({
    mutationFn: async (nome) => {
      const proximaOrdem = Math.max(...etapas.map(e => e.ordem || 0), 0) + 1;
      return base44.entities.EtapaObra.create({
        obra_id: obraId,
        nome_etapa: nome.toUpperCase(),
        ordem: proximaOrdem,
        ativo: true
      });
    },
    onSuccess: () => {
      toast.success('Etapa criada');
      setNovaEtapa('');
      onToggleForm();
      onEtapaCriada();
    },
    onError: () => toast.error('Erro ao criar etapa')
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome }) => {
      return base44.entities.EtapaObra.update(id, {
        nome_etapa: nome.toUpperCase()
      });
    },
    onSuccess: () => {
      toast.success('Etapa atualizada');
      setEditandoId(null);
      setEditandoNome('');
      onEtapaAtualizada();
    },
    onError: () => toast.error('Erro ao atualizar etapa')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return base44.entities.EtapaObra.update(id, { ativo: false });
    },
    onSuccess: () => {
      toast.success('Etapa removida');
      if (etapaSelecionada === id) onEtapaSelect(null);
      onEtapaAtualizada();
    },
    onError: () => toast.error('Erro ao remover etapa')
  });

  const handleReordenar = async (etapaId, direcao) => {
    const idxAtual = etapas.findIndex(e => e.id === etapaId);
    if (idxAtual === -1) return;

    const idxProximo = direcao === 'up' ? idxAtual - 1 : idxAtual + 1;
    if (idxProximo < 0 || idxProximo >= etapas.length) return;

    const etapaAtual = etapas[idxAtual];
    const etapaProxima = etapas[idxProximo];

    try {
      await base44.entities.EtapaObra.update(etapaAtual.id, { ordem: etapaProxima.ordem });
      await base44.entities.EtapaObra.update(etapaProxima.id, { ordem: etapaAtual.ordem });
      toast.success('Ordem atualizada');
      onEtapaAtualizada();
    } catch (err) {
      toast.error('Erro ao reordenar');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Etapas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mostrarForm && (
            <div className="flex gap-2 mb-3 pb-3 border-b border-gray-200">
              <Input
                placeholder="Nome da etapa"
                value={novaEtapa}
                onChange={(e) => setNovaEtapa(e.target.value)}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={() => createMutation.mutate(novaEtapa)}
                disabled={!novaEtapa || createMutation.isPending}
              >
                Criar
              </Button>
            </div>
          )}

          {etapas.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Nenhuma etapa criada</p>
          ) : (
            <div className="space-y-2">
              {etapas.map((etapa, idx) => (
                <div
                  key={etapa.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                    etapaSelecionada === etapa.id
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />

                  {editandoId === etapa.id ? (
                    <Input
                      autoFocus
                      value={editandoNome}
                      onChange={(e) => setEditandoNome(e.target.value)}
                      className="text-xs h-7"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateMutation.mutate({ id: etapa.id, nome: editandoNome });
                        if (e.key === 'Escape') setEditandoId(null);
                      }}
                    />
                  ) : (
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => onEtapaSelect(etapa.id)}
                    >
                      <p className="text-sm font-medium text-gray-900">{etapa.nome_etapa}</p>
                    </div>
                  )}

                  <div className="flex gap-1 flex-shrink-0">
                    {editandoId === etapa.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => updateMutation.mutate({ id: etapa.id, nome: editandoNome })}
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => setEditandoId(null)}
                        >
                          ✕
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setEditandoId(etapa.id);
                            setEditandoNome(etapa.nome_etapa);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => deleteMutation.mutate(etapa.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={onToggleForm}
          >
            <Plus className="w-4 h-4" />
            {mostrarForm ? 'Cancelar' : 'Nova Etapa'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}