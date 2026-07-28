import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

export default function GestorMotivoCatalogo() {
  const [novoNome, setNovoNome] = useState('');
  const queryClient = useQueryClient();

  // Buscar motivos
  const { data: motivos = [], isLoading } = useQuery({
    queryKey: ['motivos-catalogo-admin'],
    queryFn: () => base44.entities.MotivoCatalogo.list('ordem')
  });

  // Criar motivo
  const criarMutation = useMutation({
    mutationFn: () =>
      base44.entities.MotivoCatalogo.create({
        nome: novoNome.toUpperCase(),
        ativo: true,
        ordem: (motivos?.length || 0) + 1
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motivos-catalogo-admin', 'motivos-catalogo'] });
      setNovoNome('');
      toast.success('Motivo criado');
    },
    onError: (err) => toast.error(err.message || 'Erro ao criar')
  });

  // Deletar motivo
  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.MotivoCatalogo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motivos-catalogo-admin', 'motivos-catalogo'] });
      toast.success('Motivo deletado');
    },
    onError: (err) => toast.error(err.message || 'Erro ao deletar')
  });

  // Toggle ativo
  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.MotivoCatalogo.update(id, { ativo: !ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motivos-catalogo-admin', 'motivos-catalogo'] });
      toast.success('Status atualizado');
    }
  });

  // Reordenar
  const reordenarMutation = useMutation({
    mutationFn: async ({ id, novaOrdem }) => {
      await base44.entities.MotivoCatalogo.update(id, { ordem: novaOrdem });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motivos-catalogo-admin', 'motivos-catalogo'] });
    }
  });

  const handleMoverCima = (motivo) => {
    const indexAtual = motivos.findIndex(m => m.id === motivo.id);
    if (indexAtual > 0) {
      const motivo_anterior = motivos[indexAtual - 1];
      reordenarMutation.mutate({ id: motivo.id, novaOrdem: motivo_anterior.ordem - 0.5 });
    }
  };

  const handleMoverBaixo = (motivo) => {
    const indexAtual = motivos.findIndex(m => m.id === motivo.id);
    if (indexAtual < motivos.length - 1) {
      const motivo_proximo = motivos[indexAtual + 1];
      reordenarMutation.mutate({ id: motivo.id, novaOrdem: motivo_proximo.ordem + 0.5 });
    }
  };

  return (
    <div className="space-y-4">
      {/* Novo motivo */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Adicionar Motivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Nome do motivo (ex: CHUVA, FALTA_MATERIAL)"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button
              onClick={() => criarMutation.mutate()}
              disabled={!novoNome.trim() || criarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de motivos */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Motivos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-400 text-center py-6">Carregando...</div>
          ) : motivos.length === 0 ? (
            <div className="text-gray-400 text-center py-6">Nenhum motivo cadastrado</div>
          ) : (
            <div className="space-y-2">
              {motivos.map((motivo, idx) => (
                <div
                  key={motivo.id}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      checked={motivo.ativo}
                      onCheckedChange={() => toggleAtivoMutation.mutate({ id: motivo.id, ativo: motivo.ativo })}
                      className="border-gray-500"
                    />
                    <span className={motivo.ativo ? 'text-white font-medium' : 'text-gray-500 line-through'}>
                      {motivo.nome}
                    </span>
                    {!motivo.ativo && <Badge className="bg-gray-600 text-gray-300">Inativo</Badge>}
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoverCima(motivo)}
                      disabled={idx === 0}
                      className="h-8 w-8 text-gray-400"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoverBaixo(motivo)}
                      disabled={idx === motivos.length - 1}
                      className="h-8 w-8 text-gray-400"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletarMutation.mutate(motivo.id)}
                      disabled={deletarMutation.isPending}
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}