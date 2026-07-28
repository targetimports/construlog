import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Package, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FormRecebimento from './FormRecebimento';

export default function DetalhesOrdemCompra({ oc_id, open, onClose }) {
  const queryClient = useQueryClient();
  const [modalRecebimento, setModalRecebimento] = useState(false);

  const { data: oc } = useQuery({
    queryKey: ['oc-detalhes', oc_id],
    queryFn: async () => {
      const ocs = await base44.entities.OrdemCompra.filter({ id: oc_id });
      return ocs[0];
    },
    enabled: open && !!oc_id
  });

  const { data: recebimentos = [] } = useQuery({
    queryKey: ['recebimentos-oc', oc_id],
    queryFn: () => base44.entities.RecebimentoMaterial.filter({ ordem_compra_id: oc_id }),
    enabled: open && !!oc_id
  });

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('aprovarOrdemCompraAlcada', { oc_id });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['oc-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      const msg = res.data?.branch === 'DIRECT' ? 'OC aprovada com sucesso!' : 'Enviado para aprovação (alçada)';
      toast.success(msg);
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg);
    }
  });

  const statusConfig = {
    criada: { label: 'Criada', cor: 'bg-gray-100 text-gray-800' },
    em_aprovacao: { label: 'Em Aprovação', cor: 'bg-yellow-100 text-yellow-800' },
    aprovada: { label: 'Aprovada', cor: 'bg-green-100 text-green-800' },
    recebida: { label: 'Recebida', cor: 'bg-blue-100 text-blue-800' },
    parcial: { label: 'Parcial', cor: 'bg-yellow-100 text-yellow-800' },
    finalizada: { label: 'Finalizada', cor: 'bg-emerald-100 text-emerald-800' },
    cancelada: { label: 'Cancelada', cor: 'bg-red-100 text-red-800' }
  };

  if (!oc) return null;

  const config = statusConfig[oc.status] || statusConfig.criada;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Ordem de Compra #{oc.numero}
            <Badge className={config.cor}>{config.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações Gerais */}
          <Card>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Fornecedor</p>
                <p className="font-semibold">{oc.fornecedor_nome || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-gray-500">Data Emissão</p>
                <p className="font-semibold">{new Date(oc.data_emissao).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-gray-500">Valor Total</p>
                <p className="font-semibold text-lg">R$ {(oc.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
              </div>
              <div>
                <p className="text-gray-500">Depósito</p>
                <p className="font-semibold">{oc.almoxarifado_id || 'Não definido'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          <div>
            <p className="font-semibold mb-2">Itens ({oc.itens?.length || 0})</p>
            <div className="space-y-2">
              {oc.itens?.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-3">
                    <div className="grid grid-cols-5 gap-3 text-sm">
                      <div className="col-span-2">
                        <p className="text-gray-500 text-xs">Descrição</p>
                        <p className="font-semibold">{item.descricao}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Solicitado</p>
                        <p className="font-semibold">{item.quantidade_solicitada} {item.unidade}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Recebido</p>
                        <p className="font-semibold text-green-600">{item.quantidade_recebida || 0} {item.unidade}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Valor</p>
                        <p className="font-semibold">R$ {(item.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recebimentos */}
          {recebimentos.length > 0 && (
            <div>
              <p className="font-semibold mb-2">Histórico de Recebimentos</p>
              <div className="space-y-2">
                {recebimentos.map(rec => (
                  <Card key={rec.id} className="bg-green-50 border-green-200">
                    <CardContent className="pt-3 text-sm">
                      <p className="font-semibold">
                        {new Date(rec.data_recebimento).toLocaleString('pt-BR')} - {rec.status_recebimento}
                      </p>
                      <p className="text-gray-600">Por: {rec.responsavel_almoxarife}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-4 border-t">
            {oc.status === 'criada' && (
              <Button onClick={() => aprovarMutation.mutate()} disabled={aprovarMutation.isPending} className="gap-2">
                {aprovarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprovar OC
              </Button>
            )}
            {oc.status === 'aprovada' && (
              <Button onClick={() => setModalRecebimento(true)} className="bg-green-600 hover:bg-green-700 gap-2">
                <Package className="w-4 h-4" />
                Receber Material
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      <FormRecebimento
        oc={oc}
        open={modalRecebimento}
        onClose={() => setModalRecebimento(false)}
        onSuccess={() => {
          setModalRecebimento(false);
          queryClient.invalidateQueries({ queryKey: ['oc-detalhes'] });
          queryClient.invalidateQueries({ queryKey: ['recebimentos-oc'] });
        }}
      />
    </Dialog>
  );
}