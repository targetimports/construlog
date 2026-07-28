import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

export default function BoletoPagarModal({ open, onClose, boleto }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    valor_pago: boleto?.valor || 0,
    conta_tesouraria_id: '',
    comprovante_pagamento_url: ''
  });
  const [uploading, setUploading] = useState(false);

  const { data: contas } = useQuery({
    queryKey: ['contas-tesouraria-pagar'],
    queryFn: () => base44.entities.ContaTesouraria.filter({ status: 'ativa' }),
    enabled: open
  });

  React.useEffect(() => {
    if (boleto) {
      setForm(f => ({ ...f, valor_pago: boleto.valor || 0 }));
    }
  }, [boleto]);

  const pagarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('boletoPagar', {
      action: 'pagar',
      id: boleto.id,
      data_pagamento: form.data_pagamento,
      valor_pago: parseFloat(form.valor_pago) || boleto.valor,
      conta_tesouraria_id: form.conta_tesouraria_id,
      comprovante_pagamento_url: form.comprovante_pagamento_url
    }),
    onSuccess: () => {
      toast.success('Boleto pago com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['boletos-pagar'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message)
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, comprovante_pagamento_url: file_url }));
    setUploading(false);
    toast.success('Comprovante anexado');
  };

  if (!boleto) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
            <p><strong>Boleto:</strong> {boleto.descricao}</p>
            <p><strong>Fornecedor:</strong> {boleto.fornecedor_nome || '-'}</p>
            <p><strong>Valor:</strong> R$ {(boleto.valor || 0).toFixed(2)}</p>
            <p><strong>Vencimento:</strong> {boleto.data_vencimento ? new Date(boleto.data_vencimento).toLocaleDateString('pt-BR') : '-'}</p>
          </div>

          <div>
            <Label>Data do Pagamento *</Label>
            <Input className="h-11" type="date" value={form.data_pagamento} onChange={e => setForm(f => ({...f, data_pagamento: e.target.value}))} />
          </div>

          <div>
            <Label>Valor Pago (R$)</Label>
            <Input className="h-11" type="number" step="0.01" value={form.valor_pago} onChange={e => setForm(f => ({...f, valor_pago: e.target.value}))} />
          </div>

          <div>
            <Label>Conta de Pagamento (Caixa e Bancos)</Label>
            <Select value={form.conta_tesouraria_id} onValueChange={v => setForm(f => ({...f, conta_tesouraria_id: v}))}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas?.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — R$ {(c.saldo_atual || 0).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Comprovante</Label>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm border">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Anexar comprovante'}
              <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={handleUpload} />
            </label>
            {form.comprovante_pagamento_url && (
              <a href={form.comprovante_pagamento_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline ml-2">
                Ver
              </a>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => pagarMutation.mutate()}
            disabled={pagarMutation.isPending || !form.data_pagamento || !form.conta_tesouraria_id}
            className="bg-green-600 hover:bg-green-700"
          >
            {pagarMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}