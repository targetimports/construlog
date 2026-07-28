import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function MovimentacaoDialog({ open, onOpenChange, tipo, materiais, obras }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    material_id: '',
    quantidade: '',
    obra_origem_id: '',
    obra_destino_id: '',
    valor_unitario: '',
    nota_fiscal: '',
    data_movimentacao: new Date().toISOString().split('T')[0],
    responsavel: '',
    observacoes: ''
  });

  const createMovimentacaoMutation = useMutation({
    mutationFn: async (data) => {
      const material = materiais.find(m => m.id === data.material_id);
      const quantidade = Number(data.quantidade);
      const valorUnitario = Number(data.valor_unitario || material?.preco_medio || 0);

      // Criar movimentação
      await base44.entities.MovimentacaoEstoque.create({
        ...data,
        tipo,
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: quantidade * valorUnitario
      });

      // Atualizar estoque do material
      let novoEstoque = material.estoque_atual || 0;
      
      if (tipo === 'entrada') {
        novoEstoque += quantidade;
      } else if (tipo === 'saida') {
        novoEstoque -= quantidade;
      } else if (tipo === 'transferencia') {
        // Transferência não altera estoque total, só localização
      }

      await base44.entities.Material.update(material.id, {
        estoque_atual: Math.max(0, novoEstoque)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiais'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
      toast.success('Movimentação registrada!');
      onOpenChange(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      material_id: '',
      quantidade: '',
      obra_origem_id: '',
      obra_destino_id: '',
      valor_unitario: '',
      nota_fiscal: '',
      data_movimentacao: new Date().toISOString().split('T')[0],
      responsavel: '',
      observacoes: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validação: saída/transferência EXIGEM obra_destino_id
    if (tipo === 'saida' && !formData.obra_destino_id) {
      toast.error('Selecione a obra destino');
      return;
    }
    
    if (tipo === 'transferencia' && !formData.obra_destino_id) {
      toast.error('Selecione a obra destino');
      return;
    }
    
    // Entrada não exige obra_id (vai para estoque central)
    createMovimentacaoMutation.mutate(formData);
  };

  const getTitulo = () => {
    switch(tipo) {
      case 'entrada': return 'Entrada de Material';
      case 'saida': return 'Saída de Material';
      case 'transferencia': return 'Transferência entre Obras';
      default: return 'Movimentação';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">{getTitulo()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-gray-400">Material *</Label>
              <Select value={formData.material_id} onValueChange={(v) => setFormData({ ...formData, material_id: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {materiais.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} ({m.estoque_atual || 0} {m.unidade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Data *</Label>
              <Input
                type="date"
                value={formData.data_movimentacao}
                onChange={(e) => setFormData({ ...formData, data_movimentacao: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            {tipo === 'entrada' && (
              <>
                <div>
                  <Label className="text-gray-400">Valor Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_unitario}
                    onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                    className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Nota Fiscal</Label>
                  <Input
                    value={formData.nota_fiscal}
                    onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                    className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Destino</Label>
                  <Select value={formData.obra_destino_id} onValueChange={(v) => setFormData({ ...formData, obra_destino_id: v })}>
                    <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Estoque Central" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value={null}>Estoque Central</SelectItem>
                      {obras.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {tipo === 'saida' && (
              <div>
                <Label className="text-gray-400">Obra Destino *</Label>
                <Select value={formData.obra_destino_id} onValueChange={(v) => setFormData({ ...formData, obra_destino_id: v })}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {obras.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipo === 'transferencia' && (
              <>
                <div>
                  <Label className="text-gray-400">De (Origem) *</Label>
                  <Select value={formData.obra_origem_id} onValueChange={(v) => setFormData({ ...formData, obra_origem_id: v })}>
                    <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value={null}>Estoque Central</SelectItem>
                      {obras.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">Para (Destino) *</Label>
                  <Select value={formData.obra_destino_id} onValueChange={(v) => setFormData({ ...formData, obra_destino_id: v })}>
                    <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value={null}>Estoque Central</SelectItem>
                      {obras.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label className="text-gray-400">Responsável</Label>
              <Input
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-gray-400">Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-700 text-gray-400"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMovimentacaoMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-gray-900"
            >
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}