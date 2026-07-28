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
import { Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BaixaContaReceberModal({ open, onClose, conta, onBaixada }) {
  const saldoAberto = (conta?.valor_original || 0) - (conta?.valor_recebido || 0);

  const [valorPago, setValorPago] = useState(saldoAberto.toFixed(2));
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [forma, setForma] = useState('pix');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [comprovanteUrl, setComprovanteUrl] = useState('');
  const [comprovanteNome, setComprovanteNome] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload(file) {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setComprovanteUrl(file_url);
    setComprovanteNome(file.name);
    setUploading(false);
  }

  async function handleSalvar() {
    const pago = Number(valorPago);
    if (!pago || pago <= 0) {
      toast.error('Informe o valor pago.');
      return;
    }
    setSaving(true);

    const novoRecebido = (conta.valor_recebido || 0) + pago;
    let novoStatus = 'parcial';
    let dataRecebimento = undefined;

    if (novoRecebido >= conta.valor_original) {
      novoStatus = 'recebido';
      dataRecebimento = data;
    }

    const update = {
      valor_recebido: novoRecebido,
      status: novoStatus,
      forma_recebimento: forma,
      observacao,
    };
    if (dataRecebimento) update.data_recebimento = dataRecebimento;
    if (comprovanteUrl) { update.comprovante_url = comprovanteUrl; update.comprovante_nome = comprovanteNome; }
    if (motivo) update.motivo_diferenca = motivo;

    await base44.entities.ContaReceberObra.update(conta.id, update);
    toast.success(novoStatus === 'recebido' ? 'Conta totalmente recebida!' : 'Baixa parcial registrada.');
    setSaving(false);
    onBaixada();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dar Baixa — Conta a Receber</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Valor Original</span>
              <span className="font-medium">{fmt(conta?.valor_original)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Já Recebido</span>
              <span className="text-green-600 font-medium">{fmt(conta?.valor_recebido)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
              <span>Saldo em Aberto</span>
              <span className="text-blue-700">{fmt(saldoAberto)}</span>
            </div>
          </div>

          <div>
            <Label>Valor Recebido Agora (R$) *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={valorPago}
              onChange={e => setValorPago(e.target.value)}
            />
            {Number(valorPago) !== saldoAberto && Number(valorPago) > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Diferença: {fmt(Math.abs(saldoAberto - Number(valorPago)))} — informe o motivo abaixo.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do Recebimento</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <Label>Forma</Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={forma}
                onChange={e => setForma(e.target.value)}
              >
                <option value="pix">PIX</option>
                <option value="ted">TED</option>
                <option value="boleto">Boleto</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Motivo de Diferença (se houver)</Label>
            <Input placeholder="Ex: Glosa, taxa bancária..." value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>

          <div>
            <Label>Comprovante (opcional)</Label>
            {comprovanteUrl ? (
              <div className="flex items-center gap-2 mt-1 p-2 border rounded bg-green-50">
                <FileText className="w-4 h-4 text-green-600" />
                <a href={comprovanteUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 truncate flex-1 hover:underline">{comprovanteNome}</a>
                <button onClick={() => { setComprovanteUrl(''); setComprovanteNome(''); }}>
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-500 mt-1">
                <Upload className="w-4 h-4" />
                {uploading ? 'Enviando...' : 'Anexar comprovante'}
                <input type="file" className="hidden" disabled={uploading} onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); }} />
              </label>
            )}
          </div>

          <div>
            <Label>Observação</Label>
            <Input placeholder="Opcional" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? 'Salvando...' : 'Registrar Baixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}