import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';
import { Loader, CheckCircle } from 'lucide-react';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BaixaRecebimentoModal({ open, onClose, recebimento, obraId }) {
  const queryClient = useQueryClient();
  const [dataReal, setDataReal] = useState(new Date().toISOString().split('T')[0]);
  const [valorReal, setValorReal] = useState(recebimento?.valor_previsto || '');
  const [contaTesId, setContaTesId] = useState('');

  const { data: caixas = [] } = useQuery({
    queryKey: ['contas-tesouraria-ativas'],
    queryFn: () => base44.entities.ContaTesouraria.filter({ status: 'ativa' }).catch(() => []),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const vr = Number(valorReal);
      if (!vr || !dataReal) throw new Error('Preencha data e valor');
      if (!contaTesId) throw new Error('Selecione a conta de recebimento (Caixa & Bancos)');

      // 1. Cria a conta a receber PENDENTE (razão único ContaFinanceira).
      const conta = await base44.entities.ContaFinanceira.create({
        obra_id: obraId, tipo: 'receber',
        descricao: `Recebimento: ${recebimento.descricao}`,
        valor: vr, valor_recebido: 0, status: 'pendente', categoria: 'recebimento',
        data_vencimento: dataReal, historico_baixas: [],
        origem: 'RecebimentoPrevisto', origem_id: recebimento.id,
      });

      // 2. Dá baixa via backend → CREDITA o caixa (ContaTesouraria) + concilia.
      const res = await base44.functions.invoke('darBaixaRecebimento', {
        conta_id: conta.id, data_recebimento: dataReal, valor_recebido: vr,
        forma_pagamento: 'transferencia', conta_tesouraria_id: contaTesId,
      });
      if (res.data?.ok === false) throw new Error(res.data.error || 'Falha ao baixar recebimento');

      // 3. Vincula ao RecebimentoPrevisto.
      await base44.entities.RecebimentoPrevisto.update(recebimento.id, {
        status: 'RECEBIDO', data_real: dataReal, valor_real: vr, conta_financeira_id: conta.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recebimentos-previstos', obraId] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
      toast.success('Recebimento baixado — entrada creditada no caixa!');
      onClose();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Confirmar Recebimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">{recebimento?.descricao}</p>
            <p className="text-xs mt-1 text-gray-500">Previsto: {fmt(recebimento?.valor_previsto)}</p>
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Conta de Recebimento (Caixa &amp; Bancos) *</Label>
            <div className="mt-1">
              <ComboboxBusca
                options={caixas.map((c) => ({ value: c.id, label: `${c.nome} — ${fmt(c.saldo_atual)}` }))}
                value={contaTesId} onSelect={setContaTesId}
                placeholder="Selecionar conta..." searchPlaceholder="Buscar conta..."
                emptyMessage="Nenhuma conta em Caixa & Bancos."
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Data do Recebimento *</Label>
            <Input type="date" value={dataReal} onChange={(e) => setDataReal(e.target.value)} className="bg-white border-gray-300 text-gray-900 mt-1" />
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Valor Recebido (R$) *</Label>
            <Input type="number" step="0.01" value={valorReal} onChange={(e) => setValorReal(e.target.value)} className="bg-white border-gray-300 text-gray-900 mt-1" />
          </div>

          <p className="text-xs text-emerald-600">A entrada será creditada no caixa/banco escolhido.</p>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={() => mutation.mutate()} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={mutation.isPending}>
            {mutation.isPending && <Loader className="w-4 h-4 animate-spin" />}
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
