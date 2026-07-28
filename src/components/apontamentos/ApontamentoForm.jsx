import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import ValidadorDivergencias from './ValidadorDivergencias';
import SeletorKit from './SeletorKit';

export default function ApontamentoForm({ open, onOpenChange, apontamento }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    codigo: '',
    obra_id: '',
    data_apontamento: new Date().toISOString().split('T')[0],
    encarregado: '',
    materiais: [],
    status: 'rascunho',
    observacoes: ''
  });
  const [novoMaterial, setNovoMaterial] = useState({
    material_id: '',
    material_nome: '',
    quantidade_inventario: '',
    quantidade_teorica: '',
    motivo_diferenca: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  useEffect(() => {
    if (apontamento) {
      setFormData({
        codigo: apontamento.codigo || '',
        obra_id: apontamento.obra_id || '',
        data_apontamento: apontamento.data_apontamento || new Date().toISOString().split('T')[0],
        encarregado: apontamento.encarregado || '',
        materiais: apontamento.materiais || [],
        status: apontamento.status || 'rascunho',
        observacoes: apontamento.observacoes || ''
      });
    }
  }, [apontamento, open]);

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (apontamento) {
        return base44.entities.ApontamentoMateriaisSemanal.update(apontamento.id, data);
      }
      return base44.entities.ApontamentoMateriaisSemanal.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['apontamentos-materiais']);
      toast.success(apontamento ? 'Apontamento atualizado!' : 'Apontamento criado!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const adicionarMaterial = (materialData = null) => {
    const dados = materialData || novoMaterial;
    
    if (!dados.material_id || !dados.quantidade_inventario) {
      toast.error('Selecione o material e informe a quantidade');
      return;
    }

    const mat = materiais.find(m => m.id === dados.material_id);
    const novoItem = {
      material_id: dados.material_id,
      material_nome: mat?.nome || dados.material_nome,
      quantidade_inventario: parseFloat(dados.quantidade_inventario),
      quantidade_teorica: parseFloat(dados.quantidade_teorica) || 0,
      diferenca: (parseFloat(dados.quantidade_inventario) - (parseFloat(dados.quantidade_teorica) || 0)),
      motivo_diferenca: dados.motivo_diferenca
    };

    setFormData({
      ...formData,
      materiais: [...formData.materiais, novoItem]
    });

    if (!materialData) {
      setNovoMaterial({
        material_id: '',
        material_nome: '',
        quantidade_inventario: '',
        quantidade_teorica: '',
        motivo_diferenca: ''
      });
    }
  };

  const removerMaterial = (index) => {
    setFormData({
      ...formData,
      materiais: formData.materiais.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.obra_id || !formData.encarregado) {
      toast.error('Preencha obra e encarregado');
      return;
    }
    salvarMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {apontamento ? 'Editar Apontamento' : 'Novo Apontamento Semanal'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-400">Código</Label>
            <Input
              value={formData.codigo}
              onChange={(e) => setFormData({...formData, codigo: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(v) => setFormData({...formData, obra_id: v})} required>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Encarregado *</Label>
              <Select value={formData.encarregado} onValueChange={(v) => setFormData({...formData, encarregado: v})} required>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.email || c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <h4 className="text-white font-medium mb-4">Materiais do Apontamento</h4>

            {formData.obra_id && (
              <SeletorKit 
                empresaId={formData.obra_id}
                onAplicarKit={(mat) => adicionarMaterial(mat)}
                materiaisExistentes={formData.materiais}
              />
            )}

            <div className="space-y-3 mb-4 p-4 bg-gray-800 rounded-lg">
              <div>
                <Label className="text-gray-400 text-sm">Material *</Label>
                <Select value={novoMaterial.material_id} onValueChange={(v) => setNovoMaterial({...novoMaterial, material_id: v})}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {materiais.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome} ({m.unidade})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-gray-400 text-sm">Quantidade Inventário *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoMaterial.quantidade_inventario}
                    onChange={(e) => setNovoMaterial({...novoMaterial, quantidade_inventario: e.target.value})}
                    className="bg-gray-900 border-gray-700 text-white mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Quantidade Teórica</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoMaterial.quantidade_teorica}
                    onChange={(e) => setNovoMaterial({...novoMaterial, quantidade_teorica: e.target.value})}
                    className="bg-gray-900 border-gray-700 text-white mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Motivo Diferença</Label>
                  <Input
                    value={novoMaterial.motivo_diferenca}
                    onChange={(e) => setNovoMaterial({...novoMaterial, motivo_diferenca: e.target.value})}
                    className="bg-gray-900 border-gray-700 text-white mt-1"
                    placeholder="Ex: Falta, perda..."
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={adicionarMaterial}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Material
              </Button>
            </div>

            {formData.materiais.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {formData.materiais.map((mat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <div className="text-white text-sm">{mat.material_nome}</div>
                        <div className="text-xs text-gray-500">
                          Inv: {mat.quantidade_inventario} | Teórico: {mat.quantidade_teorica} | Dif: {mat.diferenca}
                          {mat.motivo_diferenca && ` (${mat.motivo_diferenca})`}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => removerMaterial(idx)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <h5 className="text-white text-sm font-medium mb-3">Validação de Divergências</h5>
                  <ValidadorDivergencias 
                    materiais={formData.materiais}
                    onValidar={(mat, motivo) => {
                      const idx = formData.materiais.findIndex(m => m.material_id === mat.material_id);
                      if (idx >= 0) {
                        const novosMateriais = [...formData.materiais];
                        novosMateriais[idx].motivo_diferenca = motivo;
                        setFormData({ ...formData, materiais: novosMateriais });
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-gray-400">Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white min-h-20"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-gray-700 text-gray-400 hover:bg-gray-800">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending} className="flex-1 bg-amber-500 hover:bg-amber-600 text-gray-900">
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}