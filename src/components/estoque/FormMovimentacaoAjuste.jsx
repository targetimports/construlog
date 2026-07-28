import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FormMovimentacaoAjuste({ open, onClose, onSuccess }) {
  const [dados, setDados] = useState({
    insumo_id: '',
    almoxarifado_id: '',
    tipo_ajuste: 'incremento', // 'incremento' | 'decremento'
    quantidade: '',
    motivo: ''
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-ajuste'],
    queryFn: () => base44.entities.Insumo.list('descricao', 500),
    enabled: open
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados-ajuste'],
    queryFn: () => base44.entities.Almoxarifado.list('nome', 100),
    enabled: open
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const quantidade = parseFloat(dados.quantidade);
      const quantidadeAjustada = dados.tipo_ajuste === 'incremento' ? quantidade : -quantidade;

      return await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'ajuste_inventario',
        insumo_id: dados.insumo_id,
        almoxarifado_destino_id: dados.tipo_ajuste === 'incremento' ? dados.almoxarifado_id : undefined,
        almoxarifado_origem_id: dados.tipo_ajuste === 'decremento' ? dados.almoxarifado_id : undefined,
        quantidade: Math.abs(quantidadeAjustada),
        observacoes: `[AJUSTE ${dados.tipo_ajuste.toUpperCase()}] ${dados.motivo}`
      });
    },
    onSuccess: () => {
      toast.success('Ajuste registrado com sucesso!');
      setDados({
        insumo_id: '',
        almoxarifado_id: '',
        tipo_ajuste: 'incremento',
        quantidade: '',
        motivo: ''
      });
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg || 'Erro ao processar ajuste');
    }
  });

  const handleSubmit = () => {
    if (!dados.insumo_id || !dados.almoxarifado_id || !dados.quantidade || !dados.motivo) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (parseFloat(dados.quantidade) <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }
    if (dados.motivo.trim().length < 10) {
      toast.error('Motivo deve ter no mínimo 10 caracteres');
      return;
    }
    criarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuste de Estoque</DialogTitle>
        </DialogHeader>

        <Alert className="bg-orange-50 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 text-sm">
            Ajustes de estoque exigem motivo detalhado (mín. 10 caracteres)
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Ajuste *</label>
            <Select value={dados.tipo_ajuste} onValueChange={(v) => setDados({...dados, tipo_ajuste: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incremento">Incremento (adicionar)</SelectItem>
                <SelectItem value="decremento">Decremento (remover)</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            <label className="block text-sm font-medium mb-1">Depósito *</label>
            <Select value={dados.almoxarifado_id} onValueChange={(v) => setDados({...dados, almoxarifado_id: v})}>
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
            <label className="block text-sm font-medium mb-1">Motivo do Ajuste * (mín. 10 caracteres)</label>
            <Textarea
              placeholder="Ex: Inventário físico identificou divergência de 5 unidades..."
              value={dados.motivo}
              onChange={(e) => setDados({...dados, motivo: e.target.value})}
              rows={3}
              className={dados.motivo.length > 0 && dados.motivo.length < 10 ? 'border-red-300' : ''}
            />
            <p className="text-xs text-gray-500 mt-1">
              {dados.motivo.length}/10 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criarMutation.isPending}>
            {criarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Registrar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}