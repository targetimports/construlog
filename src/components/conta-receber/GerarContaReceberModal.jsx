import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function GerarContaReceberModal({ open, onClose, medicao, contrato, onGerada }) {
  const hoje = new Date();
  const trintaDias = new Date(hoje.setDate(hoje.getDate() + 30)).toISOString().split('T')[0];

  const [dataVencimento, setDataVencimento] = useState(trintaDias);
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleGerar() {
    if (!dataVencimento) {
      toast.error('Informe a data de vencimento.');
      return;
    }
    setSaving(true);

    const descricao = `Medição #${medicao.numero_medicao || '?'} — Contrato ${contrato?.numero_contrato || '?'}`;

    await base44.entities.ContaReceberObra.create({
      obra_id: medicao.obra_id,
      contrato_id: medicao.contrato_id,
      origem_tipo: 'MedicaoContrato',
      origem_id: medicao.id,
      descricao,
      valor_original: medicao.valor_liquido_calculado || 0,
      data_vencimento: dataVencimento,
      status: 'aberto',
      valor_recebido: 0,
      observacao,
      anexo_boletim_url: medicao.anexo_boletim_url || undefined,
      anexo_nota_fiscal_url: medicao.anexo_nota_fiscal_url || undefined
    });

    toast.success('Conta a Receber gerada com sucesso.');
    setSaving(false);
    onGerada();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Conta a Receber</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Valor Bruto</span>
              <span className="font-medium">{fmt(medicao?.valor_bruto)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>(-) Retenção</span>
              <span>{fmt(medicao?.valor_retencao)}</span>
            </div>
            <div className="flex justify-between text-orange-500">
              <span>(-) Impostos</span>
              <span>{fmt(medicao?.valor_imposto)}</span>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-blue-800">
              <span>Valor a Receber (Líquido)</span>
              <span>{fmt(medicao?.valor_liquido_calculado)}</span>
            </div>
          </div>

          <div>
            <Label>Data de Vencimento *</Label>
            <Input
              type="date"
              value={dataVencimento}
              onChange={e => setDataVencimento(e.target.value)}
            />
          </div>

          <div>
            <Label>Observação</Label>
            <Input
              placeholder="Opcional"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGerar} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Gerando...' : 'Gerar Conta a Receber'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}