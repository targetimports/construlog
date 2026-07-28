import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FormMovimentacaoEntrada({ open, onClose, onSuccess }) {
  const [dados, setDados] = useState({
    insumo_id: '',
    almoxarifado_destino_id: '',
    quantidade: '',
    custo_unitario: '',
    observacoes: ''
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-entrada'],
    queryFn: () => base44.entities.Insumo.list('descricao', 500),
    enabled: open
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados-entrada'],
    queryFn: () => base44.entities.Almoxarifado.list('nome', 100),
    enabled: open
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'entrada_compra',
        insumo_id: dados.insumo_id,
        almoxarifado_destino_id: dados.almoxarifado_destino_id,
        quantidade: parseFloat(dados.quantidade),
        custo_unitario: parseFloat(dados.custo_unitario || 0),
        observacoes: dados.observacoes
      });
    },
    onSuccess: () => {
      toast.success('Entrada registrada com sucesso!');
      setDados({
        insumo_id: '',
        almoxarifado_destino_id: '',
        quantidade: '',
        custo_unitario: '',
        observacoes: ''
      });
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message || 'Erro ao processar entrada')
  });

  const handleSubmit = () => {
    if (!dados.insumo_id || !dados.almoxarifado_destino_id || !dados.quantidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (parseFloat(dados.quantidade) <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }
    criarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Entrada</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Insumo *</label>
            <Select value={dados.insumo_id} onValueChange={(v) => setDados({...dados, insumo_id: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o insumo" />
              </SelectTrigger>
              <SelectContent>
                {insumos.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Depósito Destino *</label>
            <Select value={dados.almoxarifado_destino_id} onValueChange={(v) => setDados({...dados, almoxarifado_destino_id: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o depósito" />
              </SelectTrigger>
              <SelectContent>
                {almoxarifados.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade *</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={dados.quantidade}
                onChange={(e) => setDados({...dados, quantidade: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Custo Unitário</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={dados.custo_unitario}
                onChange={(e) => setDados({...dados, custo_unitario: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <Textarea
              placeholder="Detalhes da entrada..."
              value={dados.observacoes}
              onChange={(e) => setDados({...dados, observacoes: e.target.value})}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criarMutation.isPending}>
            {criarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Registrar Entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}