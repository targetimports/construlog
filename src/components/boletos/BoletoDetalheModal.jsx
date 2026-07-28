import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';

const STATUS_MAP = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-gray-100 text-gray-600' },
  ABERTO: { label: 'Aberto', className: 'bg-amber-100 text-amber-700' },
  PAGO: { label: 'Pago', className: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-700' }
};

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

export default function BoletoDetalheModal({ open, onClose, boleto }) {
  if (!boleto) return null;
  const status = STATUS_MAP[boleto.status] || STATUS_MAP.ABERTO;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            Detalhes do Boleto
            <Badge className={`${status.className} border-0`}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Descrição:</span><p className="font-medium">{boleto.descricao}</p></div>
            <div><span className="text-gray-500">Fornecedor:</span><p className="font-medium">{boleto.fornecedor_nome || '-'}</p></div>
            <div><span className="text-gray-500">Obra:</span><p className="font-medium">{boleto.obra_nome || '-'}</p></div>
            <div><span className="text-gray-500">Responsável:</span><p className="font-medium">{boleto.responsavel_nome || '-'}</p></div>
            <div><span className="text-gray-500">Valor:</span><p className="font-bold text-lg">{fmt(boleto.valor)}</p></div>
            <div><span className="text-gray-500">Vencimento:</span><p className="font-medium">{fmtDate(boleto.data_vencimento)}</p></div>
            <div><span className="text-gray-500">Emissão:</span><p className="font-medium">{fmtDate(boleto.data_emissao)}</p></div>
            <div><span className="text-gray-500">Forma Pagamento:</span><p className="font-medium capitalize">{boleto.forma_pagamento || '-'}</p></div>
          </div>

          {boleto.linha_digitavel && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Linha Digitável</p>
              <p className="font-mono text-sm select-all">{boleto.linha_digitavel}</p>
            </div>
          )}

          {boleto.status === 'PAGO' && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-800 mb-2">Dados do Pagamento</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Data:</span><p>{fmtDate(boleto.data_pagamento)}</p></div>
                <div><span className="text-gray-500">Valor Pago:</span><p className="font-bold">{fmt(boleto.valor_pago)}</p></div>
                <div className="col-span-2"><span className="text-gray-500">Conta:</span><p>{boleto.conta_financeira_nome || '-'}</p></div>
              </div>
            </div>
          )}

          {/* Anexos */}
          <div className="flex gap-3">
            {boleto.anexo_boleto_url && (
              <a href={boleto.anexo_boleto_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="w-4 h-4" /> PDF do Boleto <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            )}
            {boleto.comprovante_pagamento_url && (
              <a href={boleto.comprovante_pagamento_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="w-4 h-4" /> Comprovante <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            )}
          </div>

          {boleto.observacoes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Observações</p>
              <p className="text-sm">{boleto.observacoes}</p>
            </div>
          )}

          {/* Histórico */}
          {boleto.log_eventos?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-semibold">Histórico de Eventos</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {boleto.log_eventos.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-gray-200 pl-3 py-1">
                    <span className="text-gray-400 whitespace-nowrap">{ev.data ? new Date(ev.data).toLocaleString('pt-BR') : ''}</span>
                    <Badge variant="outline" className="text-[10px]">{ev.acao}</Badge>
                    <span className="text-gray-600">{ev.detalhes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}