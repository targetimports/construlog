import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function PCRecebimentoModal({ open, onClose, pc }) {
  const qc = useQueryClient();
  const [qtds, setQtds] = useState({});

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['pc-itens-recv', pc?.id],
    queryFn: () => base44.entities.PedidoCompraItem.filter({ pedido_id: pc.id }),
    enabled: open && !!pc?.id,
  });

  const receberMutation = useMutation({
    mutationFn: async () => {
      const recebidosAgora = itens
        .map((item) => ({ item, qtd: Number(qtds[item.id] || 0) }))
        .filter((r) => r.qtd > 0);
      if (!recebidosAgora.length) throw new Error('Informe pelo menos uma quantidade a receber');

      // Roteia pela função ÚNICA de backend (mesma da tela Recebimentos): dá entrada
      // via processarMovimentacaoEstoque (atualiza AS DUAS fontes de saldo), atualiza
      // qtd recebida + status do pedido e gera a Conta a Pagar. Antes este modal fazia
      // tudo no cliente e gravava só a fonte event-source → material sumia do Atender.
      const resp = await base44.functions.invoke('registrarRecebimentoCompra', {
        pedido_id: pc.id,
        itens: recebidosAgora.map(({ item, qtd }) => ({
          pedido_item_id: item.id,
          quantidade_recebida: qtd,
          preco_unitario: Number(item.preco_unitario) || 0,
        })),
      });
      if (resp.data?.ok === false) throw new Error(resp.data.error || 'Falha ao registrar recebimento');
      return resp.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] || '');
        return k.includes('pedido') || k.includes('pc-itens') || k.includes('recebiment')
          || k.includes('saldo') || k.includes('estoque') || k.includes('conta') || k.includes('transito');
      } });
      const d = data?.data || data;
      toast.success(d?.direto
        ? 'Compra confirmada e enviada à obra. A obra recebe com vistoria em Materiais & Estoque → Receber.'
        : 'Recebimento registrado no Central e conta a pagar gerada.');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const pendente = (item) => Math.max(0, item.quantidade_pedida - (item.quantidade_recebida || 0));

  const handleReceber = () => {
    const algum = itens.some(i => Number(qtds[i.id] || 0) > 0);
    if (!algum) { toast.error('Informe pelo menos uma quantidade a receber'); return; }
    const excede = itens.find(i => Number(qtds[i.id] || 0) > pendente(i));
    if (excede) { toast.error(`Quantidade para "${excede.material_nome}" excede o pendente`); return; }
    receberMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar compra e enviar à obra — {pc?.numero || pc?.id?.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">Informe as quantidades recebidas nesta entrega. Você pode receber parcialmente.</p>

        {isLoading ? <p className="py-8 text-center text-gray-400">Carregando itens...</p> : (
          <>
            {/* Tabela — desktop */}
            <div className="hidden md:block border rounded-lg overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-600">Material</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Pedido</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Recebido</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Pendente</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Receber agora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map(item => {
                    const pend = pendente(item);
                    return (
                      <tr key={item.id} className={pend === 0 ? 'bg-green-50' : ''}>
                        <td className="p-3 font-medium text-gray-900">
                          {item.material_nome}
                          <span className="ml-1 text-xs text-gray-400">({item.material_unidade})</span>
                        </td>
                        <td className="p-3 text-right text-gray-600">{item.quantidade_pedida}</td>
                        <td className="p-3 text-right text-green-600 font-medium">{item.quantidade_recebida || 0}</td>
                        <td className="p-3 text-right">
                          <Badge className={pend === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                            {pend === 0 ? '✓ Completo' : pend}
                          </Badge>
                        </td>
                        <td className="p-3 text-right w-32">
                          {pend > 0 ? (
                            <Input
                              type="number" min="0" max={pend} step="0.001"
                              className="h-8 text-sm text-right w-28 ml-auto"
                              placeholder={`máx. ${pend}`}
                              value={qtds[item.id] || ''}
                              onChange={e => setQtds(p => ({ ...p, [item.id]: e.target.value }))}
                            />
                          ) : <span className="text-green-500 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile */}
            <div className="md:hidden space-y-3 mt-2">
              {itens.map(item => {
                const pend = pendente(item);
                return (
                  <div key={item.id} className={`border rounded-lg p-3 space-y-3 ${pend === 0 ? 'bg-green-50 border-green-200' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 min-w-0 font-medium text-gray-900 break-words">
                        {item.material_nome}
                        <span className="ml-1 text-xs text-gray-400">({item.material_unidade})</span>
                      </p>
                      <Badge className={`shrink-0 ${pend === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {pend === 0 ? '✓ Completo' : `Pend. ${pend}`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>Pedido: <span className="font-medium text-gray-700">{item.quantidade_pedida}</span></span>
                      <span>Recebido: <span className="font-medium text-green-600">{item.quantidade_recebida || 0}</span></span>
                    </div>
                    {pend > 0 ? (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Receber agora</label>
                        <Input
                          type="number" min="0" max={pend} step="0.001"
                          className="h-9 text-sm text-right w-full"
                          placeholder={`máx. ${pend}`}
                          value={qtds[item.id] || ''}
                          onChange={e => setQtds(p => ({ ...p, [item.id]: e.target.value }))}
                        />
                      </div>
                    ) : <p className="text-green-500 text-xs">Item totalmente recebido</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={receberMutation.isPending} onClick={handleReceber}>
            {receberMutation.isPending ? 'Registrando...' : 'Confirmar Recebimento'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}