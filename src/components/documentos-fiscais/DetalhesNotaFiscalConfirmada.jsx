import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, FileText, Download, CreditCard, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import DialogGerarContaPagar from './DialogGerarContaPagar';
import DialogRateioNotaFiscal from './DialogRateioNotaFiscal';
import PainelHistoricoNF from './PainelHistoricoNF';
import DialogConfirmarNFComEstoque from './DialogConfirmarNFComEstoque';

export default function DetalhesNotaFiscalConfirmada({ nf_id, open, onClose }) {
  const [showGerarConta, setShowGerarConta] = useState(false);
  const [showRateio, setShowRateio] = useState(false);
  const [showConfirmarEstoque, setShowConfirmarEstoque] = useState(false);
  const [historicoExpanded, setHistoricoExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: nf, isLoading, refetch: refetchNF } = useQuery({
    queryKey: ['nf-detalhes', nf_id],
    queryFn: () => nf_id ? base44.entities.NotaFiscal.read(nf_id) : null,
    enabled: !!nf_id && open,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ['nf-vinculos', nf_id],
    queryFn: () => nf_id ? base44.entities.NotaFiscalVinculo.filter({ documento_fiscal_id: nf_id }, null, 10) : [],
    enabled: !!nf_id && open,
  });

  const { data: historicoAuditoria = [] } = useQuery({
    queryKey: ['nf-auditoria', nf_id],
    queryFn: () => nf_id ? base44.entities.NotaFiscalAuditoria.filter({ documento_fiscal_id: nf_id }, '-created_date', 20) : [],
    enabled: !!nf_id && open,
  });

  const { data: rateioExistente = [] } = useQuery({
    queryKey: ['nf-rateio', nf_id],
    queryFn: () => nf_id ? base44.entities.DocumentoFiscalRateio.filter({ documento_fiscal_id: nf_id }, null, 100) : [],
    enabled: !!nf_id && open,
  });

  const temPedidoConsolidado = vinculos.some(v => v.referencia_tipo === 'PEDIDO');

  if (isLoading || !nf) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-500">Carregando...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const valorFinal = nf.valor_final_ajustado || nf.valor_total || 0;
  const podeGerarConta = nf.status === 'CONFIRMADO';
  const podeGerarEntradaEstoque = nf.status === 'CONFIRMADO' && !nf.movimentacao_estoque_id;
  const jaTemEntradaEstoque = !!nf.movimentacao_estoque_id;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>NF {nf.numero}</span>
              <Badge className={
                nf.status === 'CONFIRMADO' ? 'bg-green-100 text-green-800' :
                nf.status === 'ANALISADO_IA' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }>
                {nf.status}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {nf.emissor_nome} • {nf.data_emissao}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Info Principal */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-gray-600">Emitente</p>
                <p className="text-sm text-gray-900">{nf.emissor_nome}</p>
                {nf.emissor_cnpj && <p className="text-xs text-gray-500">{nf.emissor_cnpj}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600">Número/Chave</p>
                <p className="text-sm text-gray-900">{nf.numero}</p>
                {nf.chave_acesso && <p className="text-xs text-gray-500">{nf.chave_acesso}</p>}
              </div>
            </div>

            {/* Valores */}
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Valores</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="font-medium">R$ {nf.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</span>
                </div>
                {nf.valor_desconto > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Desconto:</span>
                    <span className="font-medium text-red-600">-R$ {nf.valor_desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {nf.valor_frete > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frete:</span>
                    <span className="font-medium">+R$ {nf.valor_frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {nf.valor_outros > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Outros:</span>
                    <span className="font-medium">+R$ {nf.valor_outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              <div className="border-t pt-2 mt-3 flex justify-between items-center bg-green-50 p-2 rounded">
                <span className="font-semibold text-gray-900">Valor Final:</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Vínculo estoque */}
            {jaTemEntradaEstoque && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2 items-center text-sm">
                <Warehouse className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Entrada no estoque gerada</p>
                  <p className="text-green-700 text-xs">
                    Movimento: {nf.movimentacao_estoque_id}
                    {nf.almox_destino_id && ' • Almoxarifado vinculado'}
                    {nf.obra_id && ' • Obra vinculada para relatórios'}
                  </p>
                </div>
              </div>
            )}

            {/* Arquivo */}
            {nf.arquivo_url && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                <a href={nf.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex-1">
                  Visualizar documento original
                </a>
                <Download className="w-4 h-4 text-blue-600" />
              </div>
            )}

            {/* Vínculos */}
            {vinculos.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm text-gray-900 mb-3">Vinculado a:</h3>
                <div className="space-y-2">
                  {vinculos.map((v) => (
                    <div key={v.id} className="text-sm p-2 bg-gray-50 rounded border border-gray-200">
                      <p className="font-medium text-gray-900">{v.referencia_tipo}</p>
                      <p className="text-xs text-gray-600">{v.referencia_nome}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Painel de Histórico de Auditoria */}
            <PainelHistoricoNF
              historicoAuditoria={historicoAuditoria}
              isExpanded={historicoExpanded}
              onToggle={() => setHistoricoExpanded(!historicoExpanded)}
            />

            {/* Botões de Ação */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Fechar
              </Button>
              {podeGerarConta && temPedidoConsolidado && (
                <Button
                  onClick={() => setShowRateio(true)}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  {rateioExistente.length > 0 ? 'Editar Rateio' : 'Ratear Valor'}
                </Button>
              )}
              {podeGerarEntradaEstoque && (
                <Button
                  onClick={() => setShowConfirmarEstoque(true)}
                  variant="outline"
                  className="flex-1 gap-2 border-green-500 text-green-700 hover:bg-green-50"
                >
                  <Warehouse className="w-4 h-4" />
                  Entrada no Estoque
                </Button>
              )}
              {podeGerarConta && (
                <Button
                  onClick={() => setShowGerarConta(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Gerar Conta a Pagar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para gerar conta */}
      <DialogGerarContaPagar
        nf={nf}
        open={showGerarConta}
        onClose={() => setShowGerarConta(false)}
        onSuccess={() => {
          setShowGerarConta(false);
          qc.invalidateQueries({ queryKey: ['nf-detalhes', nf_id] });
        }}
      />

      {/* Dialog confirmar NF com entrada estoque */}
      {nf && (
        <DialogConfirmarNFComEstoque
          nf={nf}
          open={showConfirmarEstoque}
          onClose={() => setShowConfirmarEstoque(false)}
          onSuccess={() => {
            setShowConfirmarEstoque(false);
            refetchNF();
            qc.invalidateQueries({ queryKey: ['saldo-estoque'] });
          }}
        />
      )}

      {/* Dialog para rateio */}
      <DialogRateioNotaFiscal
        nf={nf}
        open={showRateio}
        onClose={() => setShowRateio(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['nf-rateio', nf_id] });
        }}
      />
    </>
  );
}