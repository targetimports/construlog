/**
 * Volumetria: Cadastro de volumetrias por obra
 * Tabela simples com chave/valor_decimal
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Save } from 'lucide-react';
import RouteGuardWithFallback from '@/components/layout/RouteGuardWithFallback';

export default function VolumetriaPage() {
  return (
    <RouteGuardWithFallback requiredPermissionKey="MEDICOES_VIEW">
      <VolumetriaContent />
    </RouteGuardWithFallback>
  );
}

function VolumetriaContent() {
  const queryClient = useQueryClient();
  const [newItems, setNewItems] = useState([]);
  const [editingValues, setEditingValues] = useState({});

  // Buscar obra ativa (primeiro, ou tela pode ter seletor)
  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.filter({ status: 'EM_ANDAMENTO' }, '-created_date', 1),
  });
  const obraId = obras?.[0]?.id;

  // Buscar volumetrias
  const { data: volumetrias = [], isLoading: volumLoading } = useQuery({
    queryKey: ['volumetrias', obraId],
    queryFn: () => base44.entities.Volumetria.filter({ obra_id: obraId }) || [],
    enabled: !!obraId,
  });

  // Mutation criar volumetria
  const createMutation = useMutation({
    mutationFn: (newVol) => base44.entities.Volumetria.create(newVol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumetrias', obraId] });
      setNewItems([]);
      toast.success('Volumetria criada!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  // Mutation atualizar volumetria
  const updateMutation = useMutation({
    mutationFn: ({ id, valor_decimal }) => base44.entities.Volumetria.update(id, { valor_decimal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumetrias', obraId] });
      setEditingValues({});
      toast.success('Volumetria atualizada!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  // Mutation deletar volumetria
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Volumetria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumetrias', obraId] });
      toast.success('Volumetria removida!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  if (!obraId) {
    return <div className="text-gray-600 py-10">Nenhuma obra selecionada.</div>;
  }

  if (volumLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Volumetria</h1>
        <p className="text-sm text-gray-600">
          Obra: {obras?.[0]?.nome || 'N/A'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Volumes Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {volumetrias.length === 0 && newItems.length === 0 && (
              <p className="text-xs text-gray-500">Nenhuma volumetria registrada.</p>
            )}

            {volumetrias.map((vol) => (
              <div key={vol.id} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1">Chave</label>
                  <Input 
                    value={vol.chave} 
                    disabled 
                    className="text-xs h-8"
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs text-gray-600 block mb-1">Valor</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={(editingValues[vol.id] ?? vol.valor_decimal) || 0}
                    onChange={(e) => setEditingValues(p => ({ ...p, [vol.id]: parseFloat(e.target.value) || 0 }))}
                    className="text-xs h-8"
                  />
                </div>
                <Button 
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: vol.id, valor_decimal: editingValues[vol.id] ?? vol.valor_decimal })}
                  disabled={editingValues[vol.id] === undefined || updateMutation.isPending}
                  className="h-8"
                >
                  <Save className="w-3 h-3" />
                </Button>
                <Button 
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(vol.id)}
                  disabled={deleteMutation.isPending}
                  className="h-8"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}

            {newItems.map((newItem, idx) => (
              <div key={`new-${idx}`} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1">Chave</label>
                  <Input 
                    value={newItem.chave}
                    onChange={(e) => {
                      const updated = [...newItems];
                      updated[idx].chave = e.target.value;
                      setNewItems(updated);
                    }}
                    placeholder="ex: volume_corte"
                    className="text-xs h-8"
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs text-gray-600 block mb-1">Valor</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={newItem.valor_decimal}
                    onChange={(e) => {
                      const updated = [...newItems];
                      updated[idx].valor_decimal = parseFloat(e.target.value) || 0;
                      setNewItems(updated);
                    }}
                    className="text-xs h-8"
                  />
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    if (newItem.chave && newItem.valor_decimal >= 0) {
                      createMutation.mutate({ 
                        obra_id: obraId,
                        chave: newItem.chave,
                        valor_decimal: newItem.valor_decimal
                      });
                    }
                  }}
                  disabled={!newItem.chave || createMutation.isPending}
                  className="h-8"
                >
                  <Save className="w-3 h-3" />
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const updated = newItems.filter((_, i) => i !== idx);
                    setNewItems(updated);
                  }}
                  className="h-8"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <Button 
            size="sm"
            onClick={() => setNewItems(p => [...p, { chave: '', valor_decimal: 0 }])}
            className="mt-4 gap-2"
          >
            <Plus className="w-3 h-3" />
            Adicionar Volume
          </Button>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
        <strong>Volumetria:</strong> Use para levantamentos reais (topografia, escavação, etc).
        Registre com chave única (ex: volume_corte, volume_aterro) e valor em m³.
        Ao criar aditivo tipo LEVANTAMENTO_REAL, o sistema usará esses valores automaticamente.
      </div>
    </div>
  );
}