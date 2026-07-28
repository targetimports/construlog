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

export default function FormMovimentacaoSaida({ open, onClose, onSuccess }) {
  const [dados, setDados] = useState({
    insumo_id: '',
    almoxarifado_origem_id: '',
    obra_destino_id: '',
    quantidade: '',
    observacoes: ''
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-saida'],
    queryFn: () => base44.entities.Insumo.list('descricao', 500),
    enabled: open
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados-saida'],
    queryFn: () => base44.entities.Almoxarifado.list('nome', 100),
    enabled: open
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-saida'],
    queryFn: () => base44.entities.Obra.list('nome', 500),
    enabled: open
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'saida_consumo',
        insumo_id: dados.insumo_id,
        almoxarifado_origem_id: dados.almoxarifado_origem_id,
        obra_destino_id: dados.obra_destino_id,
        quantidade: parseFloat(dados.quantidade),
        observacoes: dados.observacoes,
        bypass_saldo_negativo: user?.role === 'admin' // Apenas admin pode ter saldo negativo
      });
    },
    onSuccess: () => {
      toast.success('Saída registrada com sucesso!');
      setDados({
        insumo_id: '',
        almoxarifado_origem_id: '',
        obra_destino_id: '',
        quantidade: '',
        observacoes: ''
      });
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg || 'Erro ao processar saída');
    }
  });

  const handleSubmit = () => {
    if (!dados.insumo_id || !dados.almoxarifado_origem_id || !dados.quantidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (!dados.obra_destino_id) {
      toast.error('Selecione uma obra de destino');
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
          <DialogTitle>Nova Saída para Obra</DialogTitle>
        </DialogHeader>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 text-sm">
            Saídas para obra exigem seleção da obra de destino
          </AlertDescription>
        </Alert>

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
            <label className="block text-sm font-medium mb-1">Depósito Origem *</label>
            <Select value={dados.almoxarifado_origem_id} onValueChange={(v) => setDados({...dados, almoxarifado_origem_id: v})}>
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
            <label className="block text-sm font-medium mb-1">Obra Destino * </label>
            <Select value={dados.obra_destino_id} onValueChange={(v) => setDados({...dados, obra_destino_id: v})}>
              <SelectTrigger className={!dados.obra_destino_id ? 'border-red-300' : ''}>
                <SelectValue placeholder="Selecione a obra" />
              </SelectTrigger>
              <SelectContent>
                {obras.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
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
            <label className="block text-sm font-medium mb-1">Observações</label>
            <Textarea
              placeholder="Detalhes da saída..."
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
            Registrar Saída
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}