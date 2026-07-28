import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoAlcadas() {
  const [modalAberto, setModalAberto] = useState(false);
  const [alcadaEditando, setAlcadaEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    nivel: 1,
    valor_minimo: 0,
    valor_maximo: null,
    requer_todos_aprovadores: false,
    aprovadores: []
  });
  const queryClient = useQueryClient();

  const { data: alcadas = [], isLoading } = useQuery({
    queryKey: ['alcadas-aprovacao'],
    queryFn: () => base44.entities.AlcadaAprovacao.list('-nivel')
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-sistema'],
    queryFn: () => base44.asServiceRole.functions.invoke('listarTodosUsuarios', {})
      .then(r => r.data?.usuarios || [])
      .catch(() => [])
  });

  const salvaMutation = useMutation({
    mutationFn: async (dados) => {
      if (alcadaEditando?.id) {
        return base44.entities.AlcadaAprovacao.update(alcadaEditando.id, dados);
      } else {
        return base44.entities.AlcadaAprovacao.create(dados);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alcadas-aprovacao'] });
      toast.success('Alçada salva com sucesso');
      resetForm();
      setModalAberto(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const deletaMutation = useMutation({
    mutationFn: (id) => base44.entities.AlcadaAprovacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alcadas-aprovacao'] });
      toast.success('Alçada removida');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      nivel: 1,
      valor_minimo: 0,
      valor_maximo: null,
      requer_todos_aprovadores: false,
      aprovadores: []
    });
    setAlcadaEditando(null);
  };

  const handleEditar = (alcada) => {
    setAlcadaEditando(alcada);
    setFormData({
      nome: alcada.nome,
      nivel: alcada.nivel,
      valor_minimo: alcada.valor_minimo || 0,
      valor_maximo: alcada.valor_maximo,
      requer_todos_aprovadores: alcada.requer_todos_aprovadores || false,
      aprovadores: alcada.aprovadores || []
    });
    setModalAberto(true);
  };

  const handleAdicionarAprovador = (usuario) => {
    const novoAprovador = {
      user_email: usuario.email,
      nome: usuario.full_name,
      cargo: usuario.cargo || ''
    };
    setFormData({
      ...formData,
      aprovadores: [...formData.aprovadores, novoAprovador]
    });
  };

  const handleRemoverAprovador = (email) => {
    setFormData({
      ...formData,
      aprovadores: formData.aprovadores.filter(a => a.user_email !== email)
    });
  };

  const handleSalvar = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome da alçada é obrigatório');
      return;
    }
    salvaMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Alçadas de Aprovação</h2>
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Alçada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{alcadaEditando ? 'Editar' : 'Nova'} Alçada de Aprovação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome</label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="ex: Gerente de Compras"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nível Hierárquico</label>
                  <Input
                    type="number"
                    value={formData.nivel}
                    onChange={(e) => setFormData({...formData, nivel: parseInt(e.target.value)})}
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Mínimo (R$)</label>
                  <Input
                    type="number"
                    value={formData.valor_minimo || 0}
                    onChange={(e) => setFormData({...formData, valor_minimo: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Máximo (R$)</label>
                  <Input
                    type="number"
                    value={formData.valor_maximo || ''}
                    onChange={(e) => setFormData({...formData, valor_maximo: e.target.value ? parseFloat(e.target.value) : null})}
                    placeholder="Deixe vazio para sem limite"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.requer_todos_aprovadores}
                  onCheckedChange={(checked) => setFormData({...formData, requer_todos_aprovadores: checked})}
                />
                <label className="text-sm">Exigir aprovação de TODOS os aprovadores desta alçada</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Aprovadores</label>
                <div className="max-h-48 overflow-y-auto border rounded p-3 mb-3 space-y-2">
                  {formData.aprovadores.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum aprovador adicionado</p>
                  ) : (
                    formData.aprovadores.map(apr => (
                      <div key={apr.user_email} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div>
                          <p className="text-sm font-medium">{apr.nome}</p>
                          <p className="text-xs text-gray-500">{apr.user_email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoverAprovador(apr.user_email)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                  onChange={(e) => {
                    const usuario = usuarios.find(u => u.email === e.target.value);
                    if (usuario && !formData.aprovadores.find(a => a.user_email === usuario.email)) {
                      handleAdicionarAprovador(usuario);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="">Selecione um usuário para adicionar...</option>
                  {usuarios.map(usuario => (
                    <option key={usuario.email} value={usuario.email}>
                      {usuario.full_name} ({usuario.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 border-t pt-4">
                <Button variant="outline" onClick={() => setModalAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSalvar}
                  disabled={salvaMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {salvaMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alçada'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {alcadas.map(alcada => (
          <Card key={alcada.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{alcada.nome}</h3>
                  <p className="text-sm text-gray-600">
                    Nível {alcada.nivel} • 
                    {alcada.valor_minimo > 0 && ` Mín: R$ ${alcada.valor_minimo.toLocaleString('pt-BR')}`}
                    {alcada.valor_maximo && ` Máx: R$ ${alcada.valor_maximo.toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleEditar(alcada)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deletaMutation.mutate(alcada.id)}
                    disabled={deletaMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Aprovadores ({alcada.aprovadores?.length || 0}):</span>
                </p>
                {alcada.aprovadores?.map(apr => (
                  <div key={apr.user_email} className="text-sm text-gray-600 ml-4">
                    • {apr.nome}
                  </div>
                ))}
                {alcada.requer_todos_aprovadores && (
                  <p className="text-xs text-blue-600 ml-4 mt-2">Requer aprovação de TODOS</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}