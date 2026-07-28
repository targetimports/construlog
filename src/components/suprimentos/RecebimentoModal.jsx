import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertCircle, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import BotaoAnexarNF from '../documentos-fiscais/BotaoAnexarNF';

const EMPTY_ITEM = { material_id: '', material_nome: '', material_unidade: '', quantidade_recebida: '', preco_unitario: '', total_item: 0, pedido_item_id: '' };

export default function RecebimentoModal({ open, onClose, recebimento }) {
  const qc = useQueryClient();
  const isView = recebimento?.status === 'CONFIRMADO' || recebimento?.status === 'CANCELADO';

  const [form, setForm] = useState({
    pedido_id: '', local_estoque_id: '',
    numero_nf: '', chave_nf: '',
    data_recebimento: new Date().toISOString().split('T')[0],
    observacao: '',
  });
  const [itens, setItens] = useState([{ ...EMPTY_ITEM }]);
  const [pedidoItens, setPedidoItens] = useState([]);
  const [errors, setErrors] = useState({});

  const { data: user } = useQuery({ queryKey: ['user-me'], queryFn: () => base44.auth.me(), staleTime: 300000 });
  const isAdmin = user?.role === 'admin';

  // filtro por array no shim não funciona como "IN" — busca todos e filtra no cliente
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-receber'],
    queryFn: async () => {
      const todos = await base44.entities.PedidoCompra.list('-created_date', 1000).catch(() => []);
      return todos.filter((p) => ['ENVIADO', 'PARCIAL'].includes(p.status));
    },
    enabled: open,
  });

  const { data: locaisEstoque = [] } = useQuery({
    queryKey: ['locais-estoque'],
    queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []),
    enabled: open,
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['insumos-receb'],
    queryFn: () => base44.entities.Insumo.list('descricao', 5000).catch(() => []),
    enabled: open,
  });

  // Carregar itens existentes do recebimento em edição
  const { data: itensExistentes = [] } = useQuery({
    queryKey: ['recv-itens', recebimento?.id],
    queryFn: () => base44.entities.RecebimentoItem.filter({ recebimento_id: recebimento.id }),
    enabled: open && !!recebimento?.id,
  });

  useEffect(() => {
    if (!open) return;
    if (recebimento?.id) {
      setForm({
        pedido_id: recebimento.pedido_id || '',
        local_estoque_id: recebimento.local_estoque_id || '',
        numero_nf: recebimento.numero_nf || '',
        chave_nf: recebimento.chave_nf || '',
        data_recebimento: recebimento.data_recebimento || new Date().toISOString().split('T')[0],
        observacao: recebimento.observacao || '',
      });
    } else {
      setForm({ pedido_id: '', local_estoque_id: '', numero_nf: '', chave_nf: '', data_recebimento: new Date().toISOString().split('T')[0], observacao: '' });
      setItens([{ ...EMPTY_ITEM }]);
      setPedidoItens([]);
    }
    setErrors({});
  }, [open, recebimento?.id]);

  useEffect(() => {
    if (itensExistentes.length > 0) setItens(itensExistentes.map(i => ({ ...i })));
  }, [itensExistentes]);

  // Ao selecionar pedido, carrega itens pendentes
  const onPedidoChange = async (pedidoId) => {
    setField('pedido_id', pedidoId);
    if (!pedidoId) { setPedidoItens([]); setItens([{ ...EMPTY_ITEM }]); return; }

    const pedido = pedidos.find(p => p.id === pedidoId);
    if (pedido) {
      setField('obra_id', pedido.obra_id);
      setField('fornecedor_id', pedido.fornecedor_id);
    }
    const pcItens = await base44.entities.PedidoCompraItem.filter({ pedido_id: pedidoId });
    setPedidoItens(pcItens);

    // Pré-preencher com itens pendentes
    const pendentes = pcItens.filter(i => i.quantidade_pedida > (i.quantidade_recebida || 0));
    if (pendentes.length > 0) {
      setItens(pendentes.map(i => ({
        pedido_item_id: i.id,
        material_id: i.material_id,
        material_nome: i.material_nome,
        material_unidade: i.material_unidade,
        quantidade_recebida: Math.max(0, i.quantidade_pedida - (i.quantidade_recebida || 0)),
        preco_unitario: i.preco_unitario || 0,
        total_item: 0,
      })));
    }
  };

  const setField = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: null })); };

  const setItem = (i, k, v) => {
    setItens(p => p.map((item, idx) => {
      if (idx !== i) return item;
      const upd = { ...item, [k]: v };
      upd.total_item = Number(upd.quantidade_recebida) * Number(upd.preco_unitario) || 0;
      return upd;
    }));
  };

  const onMaterialChange = (idx, materialId) => {
    const insumo = materiais.find(m => m.id === materialId);
    setItens(p => p.map((item, i) => i === idx ? { ...item, material_id: materialId, insumo_id: insumo?.id || materialId, material_nome: insumo?.descricao || '', material_unidade: insumo?.unidade || '' } : item));
  };

  const getPendente = (item) => {
    if (!item.pedido_item_id) return null;
    const pc = pedidoItens.find(pi => pi.id === item.pedido_item_id);
    if (!pc) return null;
    return Math.max(0, pc.quantidade_pedida - (pc.quantidade_recebida || 0));
  };

  const validate = (confirmar = false) => {
    const e = {};
    // Com pedido vinculado, a mercadoria entra sempre no Estoque Central (backend) —
    // o local não é escolhido. Sem pedido (avulso), o destino é obrigatório.
    if (!form.pedido_id && !form.local_estoque_id) e.local_estoque_id = 'Local de destino é obrigatório';
    if (!form.data_recebimento) e.data_recebimento = 'Data é obrigatória';
    const validItens = itens.filter(i => i.material_id && Number(i.quantidade_recebida) > 0);
    if (confirmar && validItens.length === 0) e.itens = 'Adicione pelo menos um item com quantidade';
    if (!isAdmin) {
      for (const item of validItens) {
        const pend = getPendente(item);
        if (pend !== null && Number(item.quantidade_recebida) > pend) {
          e.itens = `Quantidade de "${item.material_nome}" excede o pendente do pedido (${pend})`;
          break;
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ confirmar }) => {
      const pedido = pedidos.find(p => p.id === form.pedido_id);
      const local = locaisEstoque.find(l => l.id === form.local_estoque_id);
      const validItens = itens.filter(i => i.material_id && Number(i.quantidade_recebida) > 0);

      // Fluxo de COMPRA (pedido vinculado + CONFIRMAÇÃO): sempre pelo backend
      // transacional → cria recebimento/itens, dá ENTRADA no Estoque Central da
      // Matriz, atualiza qtd recebida e status do pedido.
      //
      // Vale inclusive quando se confirma um RASCUNHO já salvo (recebimento.id):
      // antes, confirmar um rascunho caía no caminho manual abaixo, que lançava a
      // ENTRADA direto sem atualizar o saldo materializado. Aqui o rascunho é
      // descartado e o recebimento definitivo nasce pelo backend — porta única.
      if (confirmar && form.pedido_id) {
        const linhas = validItens
          .filter(i => i.pedido_item_id)
          .map(i => ({
            pedido_item_id: i.pedido_item_id,
            quantidade_recebida: Number(i.quantidade_recebida),
            preco_unitario: Number(i.preco_unitario) || 0,
          }));
        if (linhas.length === 0) throw new Error('Nenhum item do pedido para receber.');

        // Confirmando um rascunho existente: apaga o rascunho (e seus itens) antes,
        // senão sobraria um Recebimento órfão duplicando o definitivo.
        if (recebimento?.id) {
          const itensRascunho = await base44.entities.RecebimentoItem.filter({ recebimento_id: recebimento.id }).catch(() => []);
          for (const it of itensRascunho) await base44.entities.RecebimentoItem.delete(it.id).catch(() => {});
          await base44.entities.Recebimento.delete(recebimento.id).catch(() => {});
        }

        await base44.functions.invoke('registrarRecebimentoCompra', {
          pedido_id: form.pedido_id,
          numero_nf: form.numero_nf || '',
          observacao: form.observacao || '',
          data_recebimento: form.data_recebimento,
          itens: linhas,
        });
        return { confirmar };
      }

      // TRAVA: recebimento só existe com documento por trás. Sem pedido de compra
      // (ou sem passar pelo backend transacional acima), não se cria recebimento
      // avulso — que entraria estoque fora do fluxo. Requisição de transferência tem
      // a própria tela de recebimento (aba Receber do ObraDetalhes).
      if (!form.pedido_id) {
        throw new Error('Recebimento precisa de um pedido de compra. Confirme a compra em Pedidos, ou receba a transferência na obra.');
      }

      const valor_total = validItens.reduce((acc, i) => acc + (Number(i.quantidade_recebida) * Number(i.preco_unitario) || 0), 0);
      const status = confirmar ? 'CONFIRMADO' : 'RASCUNHO';

      let recvId = recebimento?.id;
      const payload = {
        ...form,
        pedido_numero: pedido?.numero || '',
        fornecedor_id: pedido?.fornecedor_id || '',
        fornecedor_nome: pedido?.fornecedor_nome || '',
        obra_id: pedido?.obra_id || '',
        obra_nome: pedido?.obra_nome || '',
        local_estoque_nome: local?.nome || '',
        status,
        valor_total,
        criado_por: user?.email || '',
      };

      if (recvId) {
        await base44.entities.Recebimento.update(recvId, payload);
        // Remove itens antigos
        for (const it of itensExistentes) await base44.entities.RecebimentoItem.delete(it.id);
      } else {
        const created = await base44.entities.Recebimento.create(payload);
        recvId = created.id;
      }

      // Salvar itens
      for (const item of validItens) {
        await base44.entities.RecebimentoItem.create({
          recebimento_id: recvId,
          pedido_item_id: item.pedido_item_id || '',
          material_id: item.material_id,
          material_nome: item.material_nome,
          material_unidade: item.material_unidade,
          quantidade_recebida: Number(item.quantidade_recebida),
          preco_unitario: Number(item.preco_unitario) || 0,
          total_item: item.total_item || 0,
        });
      }

      if (confirmar) {
        // GUARDA DEFENSIVA: hoje isto é inalcançável — toda confirmação com pedido
        // vai pelo backend (registrarRecebimentoCompra) lá em cima, e sem pedido a
        // TRAVA já lançou. Este caminho antigo dava ENTRADA direto, sem atualizar o
        // saldo materializado. Se um refactor reabrir a porta, falhe alto em vez de
        // corromper o estoque em silêncio.
        throw new Error('Confirmação de recebimento deve passar pelo backend (registrarRecebimentoCompra). Reabra pela tela de Pedidos.');
        // eslint-disable-next-line no-unreachable
        // 1. Gerar movimentações de ENTRADA no estoque
        for (const item of validItens) {
          await base44.entities.EstoqueMovimentacao.create({
            data_mov: new Date().toISOString(),
            tipo: 'ENTRADA',
            destino_local_id: form.local_estoque_id,
            obra_id: pedido?.obra_id || '',
            material_id: item.material_id,
            material_nome: item.material_nome,
            material_unidade: item.material_unidade,
            quantidade: Number(item.quantidade_recebida),
            custo_unitario: Number(item.preco_unitario) || 0,
            referencia_tipo: 'RECEBIMENTO',
            referencia_id: recvId,
            user_id: user?.email || '',
            observacao: `Recebimento ${form.numero_nf ? `NF ${form.numero_nf}` : recvId.slice(0, 8)}`,
          });
        }

        // 2. Atualizar quantidade_recebida dos PedidoCompraItens
        if (form.pedido_id) {
          const pcItensAtual = await base44.entities.PedidoCompraItem.filter({ pedido_id: form.pedido_id });
          for (const item of validItens) {
            if (!item.pedido_item_id) continue;
            const pcItem = pcItensAtual.find(pi => pi.id === item.pedido_item_id);
            if (pcItem) {
              await base44.entities.PedidoCompraItem.update(pcItem.id, {
                quantidade_recebida: (pcItem.quantidade_recebida || 0) + Number(item.quantidade_recebida),
              });
            }
          }

          // 3. Atualizar status do pedido
          const pcItensAtualizados = await base44.entities.PedidoCompraItem.filter({ pedido_id: form.pedido_id });
          const tudoRecebido = pcItensAtualizados.every(i => (i.quantidade_recebida || 0) >= i.quantidade_pedida);
          const algumRecebido = pcItensAtualizados.some(i => (i.quantidade_recebida || 0) > 0);
          const novoStatus = tudoRecebido ? 'RECEBIDO' : algumRecebido ? 'PARCIAL' : 'ENVIADO';
          await base44.entities.PedidoCompra.update(form.pedido_id, { status: novoStatus });
        }
      }
    },
    onSuccess: (_, { confirmar }) => {
      qc.invalidateQueries({ queryKey: ['recebimentos'] });
      qc.invalidateQueries({ queryKey: ['pedidos-compra'] });
      qc.invalidateQueries({ queryKey: ['pedidos-receber'] });
      qc.invalidateQueries({ queryKey: ['saldo-estoque'] });
      qc.invalidateQueries({ queryKey: ['saldos-estoque'] });
      toast.success(confirmar ? 'Recebimento confirmado — entrada no Estoque Central!' : 'Rascunho salvo!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSave = (confirmar) => { if (!validate(confirmar)) return; saveMutation.mutate({ confirmar }); };

  const totalGeral = itens.reduce((acc, i) => acc + (Number(i.quantidade_recebida) * Number(i.preco_unitario) || 0), 0);
  const disabled = isView || saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isView ? `Recebimento — ${recebimento?.id?.slice(0, 8)}` : recebimento?.id ? 'Editar Recebimento' : 'Novo Recebimento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pedido + Local Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Pedido de Compra <span className="text-gray-400 font-normal">(opcional, recomendado)</span></Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={[{ value: '__none', label: '— Sem pedido vinculado —' }, ...pedidos.map((p) => ({ value: p.id, label: `${p.numero || p.id.slice(0, 8)} — ${p.obra_nome || ''} / ${p.fornecedor_nome || ''}` }))]}
                  value={form.pedido_id || '__none'}
                  onSelect={(v) => onPedidoChange(v === '__none' ? '' : v)}
                  placeholder="Sem pedido vinculado"
                  searchPlaceholder="Buscar pedido..."
                />
              </div>
            </div>
            <div>
              <Label>Local de Destino (Estoque){form.pedido_id ? '' : ' *'}</Label>
              {form.pedido_id ? (
                <div className="mt-1 h-11 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-700">
                  <Warehouse className="w-4 h-4 flex-shrink-0" />
                  Entra no Estoque Central (Matriz)
                </div>
              ) : (
                <div className="mt-1">
                  <ComboboxBusca
                    options={locaisEstoque.map((l) => ({ value: l.id, label: `${l.nome}${l.nivel || l.tipo ? ` (${l.nivel || l.tipo})` : ''}` }))}
                    value={form.local_estoque_id}
                    onSelect={(v) => setField('local_estoque_id', v)}
                    placeholder="Selecionar local..."
                    searchPlaceholder="Buscar local..."
                  />
                </div>
              )}
              {errors.local_estoque_id && !form.pedido_id && <p className="text-xs text-red-500 mt-1">{errors.local_estoque_id}</p>}
            </div>
          </div>

          {/* Data + NF */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Data de Recebimento *</Label>
              <Input type="date" value={form.data_recebimento} onChange={e => setField('data_recebimento', e.target.value)} disabled={disabled} className={`h-11 ${errors.data_recebimento ? 'border-red-400' : ''}`} />
            </div>
            <div>
              <Label>Número da NF <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input value={form.numero_nf} onChange={e => setField('numero_nf', e.target.value)} placeholder="Ex: 001234" disabled={disabled} className="h-11" />
            </div>
            <div>
              <Label>Chave NF-e <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input value={form.chave_nf} onChange={e => setField('chave_nf', e.target.value)} placeholder="44 dígitos" maxLength={44} disabled={disabled} className="h-11" />
            </div>
          </div>

          {/* Observação */}
          <div>
            <Label>Observação</Label>
            <Textarea value={form.observacao} onChange={e => setField('observacao', e.target.value)} rows={2} disabled={disabled} />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens Recebidos *</Label>
              {!disabled && <Button variant="outline" size="sm" onClick={() => setItens(p => [...p, { ...EMPTY_ITEM }])} className="gap-1"><Plus className="w-3 h-3" /> Adicionar</Button>}
            </div>
            {errors.itens && <p className="text-xs text-red-500 flex items-center gap-1 mb-2"><AlertCircle className="w-3 h-3" />{errors.itens}</p>}

            {/* Desktop: tabela */}
            <div className="hidden md:block border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-500">Material</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Qtd Recebida</th>
                    {form.pedido_id && <th className="text-right p-2 font-semibold text-gray-500 w-20">Pendente</th>}
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Preço Unit.</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Total</th>
                    {!disabled && <th className="w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map((item, idx) => {
                    const pend = getPendente(item);
                    return (
                      <tr key={idx} className="bg-white align-middle">
                        <td className="p-1 min-w-[180px]">
                          <ComboboxBusca
                            options={materiais.filter((m) => m.ativo !== false).map((m) => ({ value: m.id, label: `${m.descricao || '—'} (${m.unidade})` }))}
                            value={item.material_id}
                            onSelect={(v) => onMaterialChange(idx, v)}
                            placeholder="Selecionar..."
                            searchPlaceholder="Buscar material..."
                          />
                        </td>
                        <td className="p-1">
                          <Input type="number" min="0" step="0.001" className="h-11 text-sm text-right" value={item.quantidade_recebida}
                            onChange={e => setItem(idx, 'quantidade_recebida', e.target.value)} disabled={disabled} placeholder="0" />
                        </td>
                        {form.pedido_id && (
                          <td className="p-2 text-right">
                            {pend !== null ? (
                              <Badge className={pend === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}>{pend === 0 ? '✓' : pend}</Badge>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )}
                        <td className="p-1">
                          <Input type="number" min="0" step="0.01" className="h-11 text-sm text-right" value={item.preco_unitario}
                            onChange={e => setItem(idx, 'preco_unitario', e.target.value)} disabled={disabled} placeholder="0,00" />
                        </td>
                        <td className="p-2 text-right text-gray-700 font-medium text-xs">
                          {item.total_item ? `R$ ${Number(item.total_item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        {!disabled && (
                          <td className="p-1">
                            <Button variant="ghost" size="icon" className="h-11 w-9 text-red-400 flex-shrink-0" onClick={() => setItens(p => p.filter((_, i) => i !== idx))} disabled={itens.length === 1}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={form.pedido_id ? (disabled ? 4 : 4) : (disabled ? 3 : 3)} className="p-2 text-right font-semibold text-gray-700">Total</td>
                    <td className="p-2 text-right font-bold text-blue-700">
                      R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    {!disabled && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {itens.map((item, idx) => {
                const pend = getPendente(item);
                return (
                  <div key={idx} className="border rounded-lg p-3 space-y-2 bg-white">
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Material</Label>
                      <ComboboxBusca
                        options={materiais.filter((m) => m.ativo !== false).map((m) => ({ value: m.id, label: `${m.descricao || '—'} (${m.unidade})` }))}
                        value={item.material_id}
                        onSelect={(v) => onMaterialChange(idx, v)}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar material..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Qtd Recebida</Label>
                        <Input type="number" min="0" step="0.001" className="h-11 text-sm" value={item.quantidade_recebida}
                          onChange={e => setItem(idx, 'quantidade_recebida', e.target.value)} disabled={disabled} placeholder="0" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Preço Unit.</Label>
                        <Input type="number" min="0" step="0.01" className="h-11 text-sm" value={item.preco_unitario}
                          onChange={e => setItem(idx, 'preco_unitario', e.target.value)} disabled={disabled} placeholder="0,00" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 text-xs">
                        {form.pedido_id && (
                          <span className="text-gray-500">
                            Pendente: {pend !== null ? (pend === 0 ? '✓' : pend) : '—'}
                          </span>
                        )}
                        <span className="text-gray-700 font-medium">
                          Total: {item.total_item ? `R$ ${Number(item.total_item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                      {!disabled && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 shrink-0" onClick={() => setItens(p => p.filter((_, i) => i !== idx))} disabled={itens.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-1 pt-1 border-t">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-sm font-bold text-blue-700">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Ações */}
          {!isView && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={saveMutation.isPending} onClick={() => handleSave(true)}>
                {saveMutation.isPending ? 'Confirmando...' : 'Confirmar Recebimento'}
              </Button>
              <Button variant="outline" className="w-full sm:w-auto" disabled={saveMutation.isPending} onClick={() => handleSave(false)}>Salvar Rascunho</Button>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button>
            </div>
          )}

          {/* Ações View */}
          {isView && (
            <div className="border-t pt-3 mt-3">
              <BotaoAnexarNF
                referencia_tipo="RECEBIMENTO"
                referencia_id={recebimento?.id}
                onAnexado={() => qc.invalidateQueries({ queryKey: ['nf-vinculos'] })}
                variant="outline"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}