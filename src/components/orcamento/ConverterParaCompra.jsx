import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ConverterParaCompra({ item, orcamento, onClose }) {
  const [formData, setFormData] = useState({
    quantidade: item.quantidade,
    data_necessidade: '',
    prioridade: 'media'
  });
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const obra = obras.find(o => o.id === orcamento?.obra_id);

  const createRequisicaoMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.RequisicaoCompra.create({
        ...data,
        obra_id: orcamento.obra_id,
        orcamento_id: orcamento.id,
        item_orcamento_id: item.id,
        descricao: item.descricao,
        categoria: item.categoria,
        unidade: item.unidade,
        valor_estimado: item.valor_unitario,
        solicitante: user.email,
        status: 'pendente'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes'] });
      toast.success('Requisição de compra criada!');
      onClose();
    },
    onError: (error) => {
      toast.error('Erro ao criar requisição: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createRequisicaoMutation.mutate(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-500" />
            Converter para Requisição de Compra
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados do Item */}
          <div className="p-4 bg-gray-800/50 rounded-xl">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Item</p>
                <p className="text-white font-medium">{item.descricao}</p>
              </div>
              <div>
                <p className="text-gray-400">Categoria</p>
                <p className="text-white font-medium capitalize">{item.categoria.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-400">Obra</p>
                <p className="text-white font-medium">{obra?.nome || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400">Valor Estimado</p>
                <p className="text-white font-medium">
                  {item.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div>
            <Label className="text-gray-400">Quantidade a Comprar *</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                type="number"
                step="0.01"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) })}
                required
                className="bg-gray-800 border-gray-700 text-white"
              />
              <div className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-sm flex items-center">
                {item.unidade}
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Qtd. orçada: {item.quantidade} {item.unidade}
            </p>
          </div>

          {/* Data de Necessidade */}
          <div>
            <Label className="text-gray-400">Data de Necessidade *</Label>
            <Input
              type="date"
              value={formData.data_necessidade}
              onChange={(e) => setFormData({ ...formData, data_necessidade: e.target.value })}
              required
              className="mt-1.5 bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Prioridade */}
          <div>
            <Label className="text-gray-400">Prioridade</Label>
            <Select 
              value={formData.prioridade} 
              onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
            >
              <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor Total Estimado */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Valor Total Estimado</span>
              <span className="text-blue-400 text-xl font-bold">
                {(formData.quantidade * item.valor_unitario).toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-400"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createRequisicaoMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-gray-900 gap-2"
            >
              <Check className="w-4 h-4" />
              {createRequisicaoMutation.isPending ? 'Criando...' : 'Criar Requisição'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}