import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

export default function DialogGerarContaPagar({ nf, open, onClose, onSuccess }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(nf?.valor_final_ajustado || nf?.valor_total || 0);
  const [statusPagamento, setStatusPagamento] = useState('PENDENTE');
  const [obraId, setObraId] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('gerarContaPagarDeNotaFiscal', {
        nf_id: nf.id,
        valor_final: Number(valor),
        status_pagamento: statusPagamento,
        obra_id: obraId || null
      });
      return data;
    },
    onSuccess: (result) => {
      toast.success(result.message || 'Conta a pagar gerada!');
      qc.invalidateQueries({ queryKey: ['contas-pagar'] });
      qc.invalidateQueries({ queryKey: ['nf-detalhes', nf.id] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const diferenca = Math.abs(Number(valor) - (nf?.valor_final_ajustado || nf?.valor_total || 0));
  const temAlteracaoValor = diferenca > 0.01;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Conta a Pagar</DialogTitle>
          <DialogDescription>
            NF {nf?.numero} - {nf?.emissor_nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Valor */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Valor Final
            </label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="text-right"
            />
            {temAlteracaoValor && (
              <p className="text-xs text-orange-600 mt-1">
                Alterado de R$ {Number(nf?.valor_final_ajustado || nf?.valor_total || 0).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          {/* Status Pagamento */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Status Pagamento
            </label>
            <Select value={statusPagamento} onValueChange={setStatusPagamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Obra (opcional) */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Obra (opcional)
            </label>
            <Input
              placeholder="Será detectada automaticamente se houver vínculo"
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              disabled
              className="bg-gray-50 text-xs"
            />
          </div>

          {/* Aviso se valor alterado */}
          {temAlteracaoValor && (
            <div className="flex gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Auditoria será registrada para esta alteração</span>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !valor}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {mutation.isPending ? 'Gerando...' : 'Gerar Conta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}