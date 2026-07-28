import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_ITEM = { material_id: '', material_nome: '', material_unidade: '', quantidade: '' };

const STATUS_CLS = { RASCUNHO: 'bg-gray-100 text-gray-600', ENVIADA: 'bg-blue-100 text-blue-700', CONFIRMADA: 'bg-green-100 text-green-700', CANCELADA: 'bg-red-100 text-red-500' };

export default function TransferenciaModal({ open, onClose, transferencia }) {
  const qc = useQueryClient();
  const editable = !transferencia?.id || transferencia?.status === 'RASCUNHO';
  const isView = !!transferencia?.id;

  const [form, setForm] = useState({ origem_local_id: '', destino_local_id: '', data_transferencia: new Date().toISOString().split('T')[0], observacao: '' });
  const [itens, setItens] = useState([{ ...EMPTY_ITEM }]);
  const [saldos, setSaldos] = useState({});
  const [saldoLoading, setSaldoLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmacao, setConfirmacao] = useState(null); // 'confirmar' | 'cancelar'
  const [erroAcao, setErroAcao] = useState(null);

  const { data: user } = useQuery({ queryKey: ['user-me'], queryFn: () => base44.auth.me(), staleTime: 300000 });
  const { data: locais = [] } = useQuery({ queryKey: ['locais-transf'], queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []), enabled: open });
  const { data: materiais = [] } = useQuery({ queryKey: ['insumos-transf'], queryFn: () => base44.entities.Insumo.list('descricao', 5000).catch(() => []), enabled: open });
  const { data: itensExistentes = [] } = useQuery({
    queryKey: ['transf-itens', transferencia?.id],
    queryFn: () => base44.entities.TransferenciaEstoqueItem.filter({ transferencia_id: transferencia.id }),
    enabled: open && !!transferencia?.id,
  });

  useEffect(() => {
    if (!open) return;
    if (transferencia?.id) {
      setForm({ origem_local_id: transferencia.origem_local_id || '', destino_local_id: transferencia.destino_local_id || '', data_transferencia: transferencia.data_transferencia || '', observacao: transferencia.observacao || '' });
    } else {
      setForm({ origem_local_id: '', destino_local_id: '', data_transferencia: new Date().toISOString().split('T')[0], observacao: '' });
      setItens([{ ...EMPTY_ITEM }]);
      setSaldos({});
    }
    setErrors({});
    setErroAcao(null);
  }, [open, transferencia?.id]);

  useEffect(() => { if (itensExistentes.length > 0) setItens(itensExistentes.map(i => ({ ...i }))); }, [itensExistentes]);

  const carregarSaldos = async (localId) => {
    if (!localId) { setSaldos({}); return; }
    setSaldoLoading(true);
    try {
      const res = await base44.functions.invoke('getSaldoEstoque', { local_estoque_id: localId });
      setSaldos(res.data?.saldos || {});
    } catch { setSaldos({}); }
    setSaldoLoading(false);
  };

  const setField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (k === 'origem_local_id') carregarSaldos(v);
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const limparErroLinha = (i) => setErrors(p => {
    if (!p.itens && !p.linhas?.[i]) return p;
    const linhas = { ...(p.linhas || {}) };
    delete linhas[i];
    return { ...p, itens: null, linhas };
  });

  const onMaterialChange = (idx, materialId) => {
    const insumo = materiais.find(m => m.id === materialId);
    setItens(p => p.map((item, i) => i === idx ? { ...item, material_id: materialId, insumo_id: materialId, material_nome: insumo?.descricao || '', material_unidade: insumo?.unidade || '' } : item));
    limparErroLinha(idx);
  };

  const setItemQtd = (idx, v) => {
    setItens(p => p.map((item, i) => i === idx ? { ...item, quantidade: v } : item));
    limparErroLinha(idx);
  };

  const getSaldo = (materialId) => materialId ? (saldos[materialId] || 0) : null;

  // enviar=true aplica também a trava de saldo; o rascunho fica leniente.
  const validate = (enviar = false) => {
    const e = {};
    if (!form.origem_local_id) e.origem_local_id = 'Origem obrigatória';
    if (!form.destino_local_id) e.destino_local_id = 'Destino obrigatório';
    if (form.origem_local_id && form.destino_local_id && form.origem_local_id === form.destino_local_id) e.destino_local_id = 'Origem e destino não podem ser iguais';
    if (!form.data_transferencia) e.data_transferencia = 'Informe a data';

    const linhas = {};
    itens.forEach((i, idx) => {
      const temMaterial = !!i.material_id;
      const qtd = Number(i.quantidade);
      const l = {};
      if (temMaterial && !(qtd > 0)) l.quantidade = 'Informe a quantidade';
      if (!temMaterial && String(i.quantidade || '').trim()) l.material = 'Selecione o material';
      // Saldo insuficiente só barra no envio — no rascunho é apenas o alerta visual.
      if (enviar && temMaterial && qtd > 0) {
        const saldo = getSaldo(i.material_id);
        if (saldo !== null && qtd > saldo) l.quantidade = `Saldo insuficiente (disponível: ${saldo.toFixed(2)})`;
      }
      if (Object.keys(l).length) linhas[idx] = l;
    });
    if (Object.keys(linhas).length) {
      e.linhas = linhas;
      e.itens = 'Corrija os itens destacados.';
    }

    const valid = itens.filter(i => i.material_id && Number(i.quantidade) > 0);
    if (valid.length === 0) e.itens = 'Adicione pelo menos um item com quantidade';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const tentarSalvar = (enviar) => {
    if (!validate(enviar)) { toast.error('Verifique os campos destacados.'); return; }
    saveMutation.mutate({ enviar });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ enviar }) => {
      const origem = locais.find(l => l.id === form.origem_local_id);
      const destino = locais.find(l => l.id === form.destino_local_id);
      const validItens = itens.filter(i => i.material_id && Number(i.quantidade) > 0);
      const status = enviar ? 'ENVIADA' : 'RASCUNHO';

      let transfId = transferencia?.id;
      const payload = { ...form, origem_local_nome: origem?.nome || '', destino_local_nome: destino?.nome || '', status, solicitado_por_user_id: user?.email || '' };

      if (transfId) {
        await base44.entities.TransferenciaEstoqueSuprimentos.update(transfId, payload);
        for (const it of itensExistentes) await base44.entities.TransferenciaEstoqueItem.delete(it.id);
      } else {
        const created = await base44.entities.TransferenciaEstoqueSuprimentos.create(payload);
        transfId = created.id;
      }

      await Promise.all(validItens.map(item => base44.entities.TransferenciaEstoqueItem.create({
        transferencia_id: transfId, material_id: item.material_id, insumo_id: item.insumo_id || item.material_id, material_nome: item.material_nome,
        material_unidade: item.material_unidade, quantidade: Number(item.quantidade),
      })));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transferencias-estoque'] }); toast.success('Transferência salva!'); onClose(); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      // Roteia pelo motor ÚNICO de estoque (mesmo do Atender/recebimento): faz
      // saída+entrada, atualiza AS DUAS fontes de saldo e aplica o guard de saldo
      // negativo. Antes criava EstoqueMovimentacao direto → gravava só o event-source
      // e o Atender/materializada não enxergavam.
      const itensMov = itensExistentes.map((item) => ({
        insumo_id: item.insumo_id || item.material_id,
        insumo_nome: item.material_nome,
        insumo_unidade: item.material_unidade,
        qtd: Number(item.quantidade),
      }));
      const resp = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'TRANSFERENCIA',
        origem_local_id: transferencia.origem_local_id,
        destino_local_id: transferencia.destino_local_id,
        documento_ref: `TRANSF ${String(transferencia.id).slice(0, 8)}`,
        observacao: `Transferência ${transferencia.origem_local_nome || ''} → ${transferencia.destino_local_nome || ''}`.trim(),
        itens: itensMov,
      });
      if (resp.data?.success === false) throw new Error(resp.data.error || 'Falha ao transferir');

      await base44.entities.TransferenciaEstoqueSuprimentos.update(transferencia.id, { status: 'CONFIRMADA', confirmado_por_user_id: user?.email, confirmado_em: new Date().toISOString() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias-estoque'] });
      qc.invalidateQueries({ predicate: (q) => { const k = String(q.queryKey?.[0] || ''); return k.includes('saldo') || k.includes('estoque'); } });
      toast.success('Transferência confirmada e estoque atualizado!'); onClose();
    },
    onError: (e) => { setErroAcao(e.message); toast.error(e.message); },
  });

  const cancelarMutation = useMutation({
    mutationFn: () => base44.entities.TransferenciaEstoqueSuprimentos.update(transferencia.id, { status: 'CANCELADA' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transferencias-estoque'] }); toast.success('Transferência cancelada.'); onClose(); },
  });

  const disabled = !editable || saveMutation.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isView ? 'Transferência de Estoque' : 'Nova Transferência'}
            {transferencia?.status && <Badge className={STATUS_CLS[transferencia.status]}>{transferencia.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Origem → Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:items-end">
            <div>
              <Label>Local de Origem *</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={locais.map((l) => ({ value: l.id, label: `${l.nome}${l.tipo ? ` (${l.tipo})` : ''}` }))}
                  value={form.origem_local_id}
                  onSelect={(v) => setField('origem_local_id', v)}
                  placeholder="Selecionar..."
                  searchPlaceholder="Buscar local..."
                  className={errors.origem_local_id ? 'border-red-400' : ''}
                />
              </div>
              {errors.origem_local_id && <p className="text-xs text-red-500 mt-1">{errors.origem_local_id}</p>}
            </div>
            <div className="hidden sm:block pb-3"><ArrowRight className="w-5 h-5 text-gray-400" /></div>
            <div>
              <Label>Local de Destino *</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={locais.filter((l) => l.id !== form.origem_local_id).map((l) => ({ value: l.id, label: `${l.nome}${l.tipo ? ` (${l.tipo})` : ''}` }))}
                  value={form.destino_local_id}
                  onSelect={(v) => setField('destino_local_id', v)}
                  placeholder="Selecionar..."
                  searchPlaceholder="Buscar local..."
                  className={errors.destino_local_id ? 'border-red-400' : ''}
                />
              </div>
              {errors.destino_local_id && <p className="text-xs text-red-500 mt-1">{errors.destino_local_id}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.data_transferencia} onChange={e => setField('data_transferencia', e.target.value)} disabled={!editable}
                className={`h-11 ${errors.data_transferencia ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
              {errors.data_transferencia && <p className="text-xs text-red-500 mt-1">{errors.data_transferencia}</p>}
            </div>
            <div>
              <Label>Observação</Label>
              <Input value={form.observacao} onChange={e => setField('observacao', e.target.value)} disabled={!editable} placeholder="Opcional..." className="h-11" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens *</Label>
              {editable && <Button variant="outline" size="sm" onClick={() => setItens(p => [...p, { ...EMPTY_ITEM }])} className="gap-1"><Plus className="w-3 h-3" /> Adicionar</Button>}
            </div>
            {errors.itens && <p className="text-xs text-red-500 flex items-center gap-1 mb-2"><AlertTriangle className="w-3 h-3" />{errors.itens}</p>}
            {saldoLoading && <p className="text-xs text-blue-500 mb-1">Carregando saldos...</p>}

            {/* Itens — tabela (desktop) */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-500">Material</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Quantidade</th>
                    {form.origem_local_id && <th className="text-right p-2 font-semibold text-gray-500 w-24">Saldo Origem</th>}
                    {editable && <th className="w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map((item, idx) => {
                    const saldo = getSaldo(item.material_id);
                    const semSaldo = saldo !== null && Number(item.quantidade) > saldo;
                    return (
                      <tr key={idx} className={`align-middle ${semSaldo ? 'bg-red-50' : 'bg-white'}`}>
                        <td className="p-1 min-w-[180px]">
                          <ComboboxBusca
                            options={materiais.filter((i) => i.ativo !== false).map((i) => ({ value: i.id, label: `${i.descricao || '—'} (${i.unidade})` }))}
                            value={item.material_id}
                            onSelect={(v) => onMaterialChange(idx, v)}
                            placeholder="Selecionar..."
                            searchPlaceholder="Buscar insumo..."
                            className={errors.linhas?.[idx]?.material ? 'border-red-400' : ''}
                          />
                          {errors.linhas?.[idx]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].material}</p>}
                        </td>
                        <td className="p-1">
                          <Input type="number" min="0" step="0.001" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : semSaldo ? 'border-red-300' : ''}`}
                            value={item.quantidade} onChange={e => setItemQtd(idx, e.target.value)} disabled={!editable} placeholder="0" />
                          {errors.linhas?.[idx]?.quantidade && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].quantidade}</p>}
                        </td>
                        {form.origem_local_id && (
                          <td className="p-2 text-right">
                            {saldo !== null
                              ? <span className={`text-xs font-semibold ${semSaldo ? 'text-red-600' : 'text-green-600'}`}>{semSaldo && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}{saldo.toFixed(2)}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        )}
                        {editable && (
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
              </table>
            </div>

            {/* Itens — cards (mobile) */}
            <div className="md:hidden space-y-3">
              {itens.map((item, idx) => {
                const saldo = getSaldo(item.material_id);
                const semSaldo = saldo !== null && Number(item.quantidade) > saldo;
                return (
                  <div key={idx} className={`border rounded-lg p-3 space-y-2 ${semSaldo ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Material</Label>
                      <ComboboxBusca
                        options={materiais.filter((i) => i.ativo !== false).map((i) => ({ value: i.id, label: `${i.descricao || '—'} (${i.unidade})` }))}
                        value={item.material_id}
                        onSelect={(v) => onMaterialChange(idx, v)}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar insumo..."
                        className={errors.linhas?.[idx]?.material ? 'border-red-400' : ''}
                      />
                      {errors.linhas?.[idx]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].material}</p>}
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-gray-500 mb-1 block">Quantidade</Label>
                        <Input type="number" min="0" step="0.001" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : semSaldo ? 'border-red-300' : ''}`}
                          value={item.quantidade} onChange={e => setItemQtd(idx, e.target.value)} disabled={!editable} placeholder="0" />
                        {errors.linhas?.[idx]?.quantidade && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].quantidade}</p>}
                      </div>
                      {form.origem_local_id && (
                        <div className="shrink-0 text-right pb-2">
                          <span className="text-xs text-gray-500 block">Saldo</span>
                          {saldo !== null
                            ? <span className={`text-xs font-semibold ${semSaldo ? 'text-red-600' : 'text-green-600'}`}>{semSaldo && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}{saldo.toFixed(2)}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      )}
                      {editable && (
                        <Button variant="ghost" size="icon" className="h-11 w-9 text-red-400 shrink-0" onClick={() => setItens(p => p.filter((_, i) => i !== idx))} disabled={itens.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Erro de ação (ex.: saldo insuficiente) */}
          {erroAcao && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{erroAcao}</span>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2">
            {editable && (
              <>
                <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700" disabled={saveMutation.isPending} onClick={() => tentarSalvar(true)}>
                  {saveMutation.isPending ? 'Salvando...' : 'Enviar Transferência'}
                </Button>
                <Button variant="outline" className="w-full sm:w-auto" disabled={saveMutation.isPending} onClick={() => tentarSalvar(false)}>Rascunho</Button>
              </>
            )}
            {transferencia?.status === 'ENVIADA' && (
              <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700" disabled={confirmarMutation.isPending} onClick={() => setConfirmacao('confirmar')}>
                {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar Transferência'}
              </Button>
            )}
            {['RASCUNHO', 'ENVIADA'].includes(transferencia?.status) && (
              <Button variant="ghost" className="w-full sm:w-auto text-red-400" disabled={cancelarMutation.isPending} onClick={() => setConfirmacao('cancelar')}>Cancelar</Button>
            )}
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirmação (substitui o confirm() do navegador) */}
    <Dialog open={!!confirmacao} onOpenChange={() => setConfirmacao(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{confirmacao === 'cancelar' ? 'Cancelar transferência' : 'Confirmar transferência'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          {confirmacao === 'cancelar'
            ? 'Tem certeza que deseja cancelar esta transferência? Esta ação não pode ser desfeita.'
            : 'Ao confirmar, o estoque será movido agora (saída da origem e entrada no destino). Esta ação não pode ser desfeita.'}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmacao(null)} className="border-gray-300 text-gray-700">Voltar</Button>
          {confirmacao === 'cancelar' ? (
            <Button className="bg-red-600 hover:bg-red-700" disabled={cancelarMutation.isPending} onClick={() => { setConfirmacao(null); cancelarMutation.mutate(); }}>
              {cancelarMutation.isPending ? 'Cancelando...' : 'Cancelar transferência'}
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700" disabled={confirmarMutation.isPending} onClick={() => { setErroAcao(null); setConfirmacao(null); confirmarMutation.mutate(); }}>
              {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}