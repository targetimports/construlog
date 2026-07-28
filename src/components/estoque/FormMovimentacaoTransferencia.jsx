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

export default function FormMovimentacaoTransferencia({ open, onClose, onSuccess }) {
  const [dados, setDados] = useState({
    insumo_id: '',
    tipo_origem: 'almoxarifado', // 'almoxarifado' | 'obra'
    almoxarifado_origem_id: '',
    obra_origem_id: '',
    tipo_destino: 'almoxarifado',
    almoxarifado_destino_id: '',
    obra_destino_id: '',
    quantidade: '',
    observacoes: ''
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-transf'],
    queryFn: () => base44.entities.Insumo.list('descricao', 500),
    enabled: open
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados-transf'],
    queryFn: () => base44.entities.Almoxarifado.list('nome', 100),
    enabled: open
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-transf'],
    queryFn: () => base44.entities.Obra.list('nome', 500),
    enabled: open
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tipo: dados.tipo_destino === 'almoxarifado' ? 'entrada_transferencia' : 'saida_transferencia',
        insumo_id: dados.insumo_id,
        quantidade: parseFloat(dados.quantidade),
        observacoes: dados.observacoes
      };

      // Origem
      if (dados.tipo_origem === 'almoxarifado') {
        payload.almoxarifado_origem_id = dados.almoxarifado_origem_id;
      } else {
        payload.obra_origem_id = dados.obra_origem_id;
      }

      // Destino
      if (dados.tipo_destino === 'almoxarifado') {
        payload.almoxarifado_destino_id = dados.almoxarifado_destino_id;
      } else {
        payload.obra_destino_id = dados.obra_destino_id;
      }

      return await base44.functions.invoke('processarMovimentacaoEstoque', payload);
    },
    onSuccess: () => {
      toast.success('Transferência registrada com sucesso!');
      setDados({
        insumo_id: '',
        tipo_origem: 'almoxarifado',
        almoxarifado_origem_id: '',
        obra_origem_id: '',
        tipo_destino: 'almoxarifado',
        almoxarifado_destino_id: '',
        obra_destino_id: '',
        quantidade: '',
        observacoes: ''
      });
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg || 'Erro ao processar transferência');
    }
  });

  const handleSubmit = () => {
    if (!dados.insumo_id || !dados.quantidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar origem
    if (dados.tipo_origem === 'almoxarifado' && !dados.almoxarifado_origem_id) {
      toast.error('Selecione o depósito de origem');
      return;
    }
    if (dados.tipo_origem === 'obra' && !dados.obra_origem_id) {
      toast.error('Selecione a obra de origem');
      return;
    }

    // Validar destino
    if (dados.tipo_destino === 'almoxarifado' && !dados.almoxarifado_destino_id) {
      toast.error('Selecione o depósito de destino');
      return;
    }
    if (dados.tipo_destino === 'obra' && !dados.obra_destino_id) {
      toast.error('Selecione a obra de destino');
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
          <DialogTitle>Nova Transferência</DialogTitle>
        </DialogHeader>

        {dados.tipo_destino === 'obra' && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              Transferência para obra exige seleção da obra de destino
            </AlertDescription>
          </Alert>
        )}

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

          {/* Origem */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold">Origem</p>
            <Select value={dados.tipo_origem} onValueChange={(v) => setDados({...dados, tipo_origem: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="almoxarifado">Depósito</SelectItem>
                <SelectItem value="obra">Obra</SelectItem>
              </SelectContent>
            </Select>

            {dados.tipo_origem === 'almoxarifado' ? (
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
            ) : (
              <Select value={dados.obra_origem_id} onValueChange={(v) => setDados({...dados, obra_origem_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Destino */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold">Destino</p>
            <Select value={dados.tipo_destino} onValueChange={(v) => setDados({...dados, tipo_destino: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="almoxarifado">Depósito</SelectItem>
                <SelectItem value="obra">Obra</SelectItem>
              </SelectContent>
            </Select>

            {dados.tipo_destino === 'almoxarifado' ? (
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
            ) : (
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
            )}
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
              placeholder="Detalhes da transferência..."
              value={dados.observacoes}
              onChange={(e) => setDados({...dados, observacoes: e.target.value})}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criarMutation.isPending}>
            {criarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Registrar Transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}