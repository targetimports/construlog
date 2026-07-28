import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { CreditCard, Wallet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Registra o pagamento de uma conta a pagar escolhendo de qual Caixa/Banco sai o
// dinheiro (conta_tesouraria_id). O backend baixa o caixa + decrementa a verba da empresa.
export default function PagamentoContaModal({ open, conta, onClose, onSuccess }) {
  const qc = useQueryClient();
  const [contaTesId, setContaTesId] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [dataPag, setDataPag] = useState(new Date().toISOString().slice(0, 10));

  const { data: resumo } = useQuery({
    queryKey: ['tesouraria-resumo'],
    queryFn: () => base44.functions.invoke('tesourariaMovimentar', { action: 'get_resumo' }).then((r) => r.data),
    enabled: open,
  });
  const contasAtivas = (resumo?.contas || []).filter((c) => !c.status || c.status === 'ativa');
  // Só o caixa da EMPRESA DONA da conta (evita pagar conta de uma empresa com o caixa
  // de outra). Se a conta não tiver empresa definida, não restringe (fallback).
  const contaEmpresaId = conta?.empresa_id || null;
  const contas = contaEmpresaId
    ? contasAtivas.filter((c) => (c.empresa_id || null) === contaEmpresaId)
    : contasAtivas;

  useEffect(() => {
    if (open && conta) {
      setValorPago(conta.valor != null ? Number(conta.valor).toFixed(2) : '');
      setDataPag(new Date().toISOString().slice(0, 10));
      setContaTesId('');
    }
  }, [open, conta?.id]);

  const pagar = useMutation({
    mutationFn: () => base44.functions.invoke('pagarContaPagar', {
      conta_id: conta.id,
      conta_tesouraria_id: contaTesId || null,
      valor_pago: Number(valorPago) || conta.valor,
      data_pagamento: dataPag,
    }),
    onSuccess: (res) => {
      if (res.data?.success === false) { toast.error(res.data.error || 'Falha ao pagar'); return; }
      qc.invalidateQueries({ queryKey: ['contas-pagar'] });
      qc.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
      qc.invalidateQueries({ queryKey: ['empresas'] });
      const sv = res.data?.saldo_verba;
      toast.success('Pagamento registrado — caixa baixado' + (sv != null ? ` · limite orçamentário: ${fmtBRL(sv)}` : '') + '.');
      // Over-budget é permitido por design; só avisa quando o limite fica negativo.
      if (sv != null && sv < 0) toast.warning(`Atenção: o limite orçamentário da empresa ficou negativo (${fmtBRL(sv)}). Pagamento acima do orçamento.`);
      onSuccess?.();
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message),
  });

  const handlePagar = () => {
    if (!contaTesId) return toast.error('Selecione a conta de pagamento (Caixa & Bancos)');
    if (!(Number(valorPago) > 0)) return toast.error('Informe o valor pago');
    pagar.mutate();
  };

  const contaSel = contas.find((c) => c.id === contaTesId);
  const excede = contaSel && Number(valorPago) > Number(contaSel.saldo_atual) && !contaSel.permite_saldo_negativo;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /> Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{conta?.descricao || 'Conta'}</p>
            <p className="text-gray-500">{conta?.fornecedor_cliente ? `${conta.fornecedor_cliente} · ` : ''}Venc. {conta?.data_vencimento ? new Date(conta.data_vencimento).toLocaleDateString('pt-BR') : '—'} · {fmtBRL(conta?.valor)}</p>
          </div>

          <div>
            <Label>Conta de Pagamento (Caixa &amp; Bancos) *</Label>
            <div className="mt-1">
              <ComboboxBusca
                options={contas.map((c) => ({ value: c.id, label: `${c.nome} — ${fmtBRL(c.saldo_atual)}` }))}
                value={contaTesId} onSelect={setContaTesId}
                placeholder="Selecionar conta..." searchPlaceholder="Buscar conta..."
                emptyMessage={contaEmpresaId ? "Esta empresa não tem caixa cadastrado. Cadastre um caixa para ela em Caixa & Bancos." : "Nenhuma conta em Caixa & Bancos. Cadastre lá primeiro."}
              />
            </div>
            {excede && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Valor acima do saldo de {fmtBRL(contaSel.saldo_atual)}.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor Pago *</Label>
              <Input type="number" min="0" step="0.01" value={valorPago} onChange={(e) => setValorPago(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="w-full sm:flex-1">Cancelar</Button>
            <Button onClick={handlePagar} disabled={pagar.isPending} className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 gap-2">
              <Wallet className="w-4 h-4" /> {pagar.isPending ? 'Pagando...' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
