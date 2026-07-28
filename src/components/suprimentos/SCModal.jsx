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
import { Plus, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa', color: 'text-gray-500' },
  { value: 'MEDIA', label: 'Média', color: 'text-blue-500' },
  { value: 'ALTA', label: 'Alta', color: 'text-orange-500' },
  { value: 'URGENTE', label: 'Urgente', color: 'text-red-600' },
];

const EMPTY_ITEM = { material_id: '', material_nome: '', material_unidade: '', quantidade: '', observacao: '' };

export default function SCModal({ open, onClose, sc, obraIdPreset, onSuccess }) {
  const qc = useQueryClient();
  const isEdit = !!sc?.id;
  const isView = sc?.status && sc.status !== 'RASCUNHO';

  const [form, setForm] = useState({ obra_id: '', prioridade: 'MEDIA', observacao: '' });
  const [itens, setItens] = useState([{ ...EMPTY_ITEM }]);
  const [errors, setErrors] = useState({});

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-sc'],
    // todas as obras (exceto encerradas/canceladas) — antes filtrava só em_andamento
    queryFn: async () => {
      const todas = await base44.entities.Obra.list('nome', 1000);
      return todas.filter((o) => !['encerrada', 'cancelada'].includes(String(o.status).toLowerCase()));
    },
    enabled: open,
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['insumos-sc'],
    queryFn: () => base44.entities.Insumo.list('descricao', 5000).catch(() => []),
    enabled: open,
  });

  const { data: itensExistentes = [] } = useQuery({
    queryKey: ['sc-itens', sc?.id],
    queryFn: () => base44.entities.SolicitacaoCompraItem.filter({ solicitacao_id: sc.id }),
    enabled: open && !!sc?.id,
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({ obra_id: sc.obra_id || '', prioridade: sc.prioridade || 'MEDIA', observacao: sc.observacao || '' });
    } else {
      setForm({ obra_id: obraIdPreset || '', prioridade: 'MEDIA', observacao: '' });
      setItens([{ ...EMPTY_ITEM }]);
    }
    setErrors({});
  }, [open, sc?.id, obraIdPreset]);

  useEffect(() => {
    if (itensExistentes.length > 0) {
      setItens(itensExistentes.map(i => ({
        id: i.id,
        material_id: i.material_id,
        material_nome: i.material_nome,
        material_unidade: i.material_unidade,
        quantidade: i.quantidade,
        observacao: i.observacao || '',
      })));
    }
  }, [itensExistentes]);

  const setField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const addItem = () => setItens(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItens(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, k, v) => {
    setItens(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
    setErrors(p => {
      if (!p.itens && !p.linhas?.[i]) return p;
      const linhas = { ...(p.linhas || {}) };
      delete linhas[i];
      return { ...p, itens: null, linhas };
    });
  };

  const onMaterialChange = (idx, materialId) => {
    const insumo = materiais.find(m => m.id === materialId);
    setItem(idx, 'material_id', materialId);
    setItem(idx, 'insumo_id', materialId);
    setItem(idx, 'material_nome', insumo?.descricao || '');
    setItem(idx, 'material_unidade', insumo?.unidade || '');
  };

  const validate = () => {
    const e = {};
    if (!form.obra_id) e.obra_id = 'Obra é obrigatória';

    // Linha preenchida pela metade não pode passar batido: antes era descartada em silêncio.
    const linhas = {};
    itens.forEach((i, idx) => {
      const temMaterial = !!i.material_id;
      const temQtd = Number(i.quantidade) > 0;
      if (temMaterial && !temQtd) linhas[idx] = { quantidade: 'Informe a quantidade' };
      else if (!temMaterial && String(i.quantidade || '').trim()) linhas[idx] = { material: 'Selecione o material' };
    });
    if (Object.keys(linhas).length) {
      e.linhas = linhas;
      e.itens = 'Complete os itens destacados (material e quantidade).';
    }

    const validItens = itens.filter(i => i.material_id && Number(i.quantidade) > 0);
    if (validItens.length === 0) e.itens = 'Adicione pelo menos um item com material e quantidade';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ enviar }) => {
      const user = await base44.auth.me();
      const obra = obras.find(o => o.id === form.obra_id);
      const status = enviar ? 'ENVIADA' : 'RASCUNHO';

      let scId = sc?.id;
      if (isEdit) {
        await base44.entities.SolicitacaoCompra.update(scId, {
          ...form,
          obra_nome: obra?.nome || '',
          status,
        });
        // Apagar itens antigos e recriar
        for (const it of itensExistentes) {
          await base44.entities.SolicitacaoCompraItem.delete(it.id);
        }
      } else {
        const created = await base44.entities.SolicitacaoCompra.create({
          ...form,
          obra_nome: obra?.nome || '',
          status,
          solicitante_user_id: user.email,
          solicitante_nome: user.full_name,
        });
        scId = created.id;
      }

      const validItens = itens.filter(i => i.material_id && i.quantidade > 0);
      await Promise.all(validItens.map(item =>
        base44.entities.SolicitacaoCompraItem.create({
          solicitacao_id: scId,
          material_id: item.material_id,
          insumo_id: item.insumo_id || item.material_id,
          material_nome: item.material_nome,
          material_unidade: item.material_unidade,
          quantidade: Number(item.quantidade),
          observacao: item.observacao || '',
        })
      ));
      return { status };
    },
    onSuccess: ({ status }) => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast.success(status === 'ENVIADA' ? 'Solicitação enviada para aprovação!' : 'Rascunho salvo!');
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSave = (enviar = false) => {
    if (!validate()) { toast.error('Verifique os campos destacados.'); return; }
    saveMutation.mutate({ enviar });
  };

  const disabled = isView || saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isView ? `SC — ${sc.numero || sc.id.slice(0, 8)}` : isEdit ? 'Editar Solicitação' : 'Nova Solicitação de Compra'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Obra + Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Obra *</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                  value={form.obra_id}
                  onSelect={(v) => setField('obra_id', v)}
                  placeholder="Selecionar obra..."
                  searchPlaceholder="Buscar obra..."
                  className={errors.obra_id ? 'border-red-400' : ''}
                />
              </div>
              {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setField('prioridade', v)} disabled={disabled}>
                <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observação */}
          <div>
            <Label>Observação <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Textarea
              value={form.observacao || ''}
              onChange={e => setField('observacao', e.target.value)}
              placeholder="Informações adicionais sobre a solicitação..."
              disabled={disabled}
              rows={2}
            />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens *</Label>
              {!disabled && (
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-3 h-3" /> Adicionar item
                </Button>
              )}
            </div>
            {errors.itens && <p className="text-xs text-red-500 mb-2">{errors.itens}</p>}

            <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
              {itens.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-white border rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <ComboboxBusca
                      options={materiais.filter((i) => i.ativo !== false).map((i) => ({ value: i.id, label: `${i.descricao || '—'} (${i.unidade})` }))}
                      value={item.material_id}
                      onSelect={(v) => onMaterialChange(idx, v)}
                      placeholder="Selecionar material..."
                      searchPlaceholder="Buscar material..."
                      emptyMessage="Nenhum insumo. Cadastre em Insumos."
                      className={(errors.itens && !item.material_id) || errors.linhas?.[idx]?.material ? 'border-red-400' : ''}
                    />
                    {errors.linhas?.[idx]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].material}</p>}
                  </div>
                  <div className="flex gap-2 items-center sm:contents">
                    <div className="w-24 sm:w-28 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={`h-11 text-sm ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                        placeholder={item.material_unidade || 'Qtd'}
                        value={item.quantidade}
                        onChange={e => setItem(idx, 'quantidade', e.target.value)}
                        disabled={disabled}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        className="h-11 text-sm"
                        placeholder="Obs. do item"
                        value={item.observacao}
                        onChange={e => setItem(idx, 'observacao', e.target.value)}
                        disabled={disabled}
                      />
                    </div>
                    {!disabled && (
                      <Button variant="ghost" size="icon" className="h-11 w-9 text-red-400 flex-shrink-0" onClick={() => removeItem(idx)} disabled={itens.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé */}
          {!isView && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={saveMutation.isPending}
                onClick={() => handleSave(true)}
              >
                {saveMutation.isPending ? 'Enviando...' : 'Enviar para Aprovação'}
              </Button>
              <Button variant="outline" className="w-full sm:w-auto" disabled={saveMutation.isPending} onClick={() => handleSave(false)}>
                Salvar Rascunho
              </Button>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}