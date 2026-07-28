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
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';

const EMPTY_ITEM = { material_id: '', material_nome: '', material_unidade: '', quantidade_solicitada: '', quantidade_baixada: 0 };

const STATUS_LABEL = { RASCUNHO: 'Rascunho', ENVIADA: 'Enviada', APROVADA: 'Aprovada', BAIXADA: 'Baixada', CANCELADA: 'Cancelada' };
const STATUS_CLS   = { RASCUNHO: 'bg-gray-100 text-gray-600', ENVIADA: 'bg-blue-100 text-blue-700', APROVADA: 'bg-yellow-100 text-yellow-700', BAIXADA: 'bg-green-100 text-green-700', CANCELADA: 'bg-red-100 text-red-500' };

export default function RequisicaoModal({ open, onClose, requisicao, obraFixaId = null }) {
  const qc = useQueryClient();
  const editable = !requisicao?.id || requisicao?.status === 'RASCUNHO';
  const isView = !!requisicao?.id;

  const [form, setForm] = useState({ obra_id: '', local_estoque_id: '', data_requisicao: new Date().toISOString().split('T')[0], observacao: '' });
  const [itens, setItens] = useState([{ ...EMPTY_ITEM }]);
  const [errors, setErrors] = useState({});

  const { data: user } = useQuery({ queryKey: ['user-me'], queryFn: () => base44.auth.me(), staleTime: 300000 });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-req'],
    queryFn: async () => {
      const todas = await base44.entities.Obra.list('nome', 1000);
      return todas.filter((o) => !['encerrada', 'cancelada'].includes(String(o.status).toLowerCase()));
    },
    enabled: open,
  });
  const { data: locais = [] } = useQuery({ queryKey: ['locais-req'], queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []), enabled: open });
  const { data: materiais = [] } = useQuery({ queryKey: ['insumos-req'], queryFn: () => base44.entities.Insumo.list('descricao', 5000).catch(() => []), enabled: open });
  const { data: itensExistentes = [] } = useQuery({
    queryKey: ['req-itens', requisicao?.id],
    queryFn: () => base44.entities.RequisicaoObraItem.filter({ requisicao_id: requisicao.id }),
    enabled: open && !!requisicao?.id,
  });

  // Saldo da FONTE real do material = estoque CENTRAL (a requisição puxa do Central
  // para a obra). Antes o modal mostrava o saldo do almoxarifado da obra (destino),
  // que é 0 e aparecia como alerta vermelho falso.
  const { data: locaisCentral = [] } = useQuery({
    queryKey: ['locais-central-reqmodal'],
    queryFn: () => base44.entities.LocalEstoque.filter({ tipo: 'CENTRAL' }).catch(() => []),
    enabled: open,
  });
  const centralId = locaisCentral[0]?.id;
  const { data: saldosCentral = [] } = useQuery({
    queryKey: ['saldos-central-reqmodal', centralId],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: centralId }),
    enabled: open && !!centralId,
  });

  // Saldo do almoxarifado da EMPRESA da obra (fonte primária; Central é o fallback).
  const empresaIdObra = obras.find((o) => o.id === form.obra_id)?.empresa_id;
  const empresaLocal = locais.find((l) => l.empresa_id === empresaIdObra && ((l.nivel || l.tipo) === 'EMPRESA'));
  const { data: saldosEmpresa = [] } = useQuery({
    queryKey: ['saldos-empresa-reqmodal', empresaLocal?.id],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: empresaLocal.id }),
    enabled: open && !!empresaLocal?.id,
  });

  useEffect(() => {
    if (!open) return;
    if (requisicao?.id) {
      setForm({ obra_id: requisicao.obra_id || '', local_estoque_id: requisicao.local_estoque_id || '', data_requisicao: requisicao.data_requisicao || '', observacao: requisicao.observacao || '' });
    } else {
      setForm({ obra_id: '', local_estoque_id: '', data_requisicao: new Date().toISOString().split('T')[0], observacao: '' });
      setItens([{ ...EMPTY_ITEM }]);
    }
    setErrors({});
  }, [open, requisicao?.id]);

  useEffect(() => { if (itensExistentes.length > 0) setItens(itensExistentes.map(i => ({ ...i }))); }, [itensExistentes]);

  // Obra fixa (aberto de dentro de uma obra): pré-seleciona a obra + o almoxarifado dela.
  useEffect(() => {
    if (!open || requisicao?.id || !obraFixaId || locais.length === 0) return;
    const localObra = locais.find((l) => l.obra_id === obraFixaId && (l.tipo === 'OBRA' || l.nivel === 'OBRA'))
      || locais.find((l) => l.obra_id === obraFixaId);
    setForm((p) => ({ ...p, obra_id: obraFixaId, local_estoque_id: localObra?.id || p.local_estoque_id }));
  }, [open, obraFixaId, requisicao?.id, locais]);

  const setField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const limparErroLinha = (i) => setErrors(p => {
    if (!p.itens && !p.linhas?.[i]) return p;
    const linhas = { ...(p.linhas || {}) };
    delete linhas[i];
    return { ...p, itens: null, linhas };
  });

  const setItem = (i, k, v) => {
    setItens(p => p.map((item, idx) => idx !== i ? item : { ...item, [k]: v }));
    limparErroLinha(i);
  };

  const onMaterialChange = (idx, materialId) => {
    const insumo = materiais.find(m => m.id === materialId);
    setItens(p => p.map((item, i) => i === idx ? { ...item, material_id: materialId, insumo_id: materialId, material_nome: insumo?.descricao || '', material_unidade: insumo?.unidade || '' } : item));
    limparErroLinha(idx);
  };

  const saldoCentralMap = {};
  for (const s of saldosCentral) saldoCentralMap[s.material_id ?? s.insumo_id] = s.saldo_atual || 0;
  const saldoEmpresaMap = {};
  for (const s of saldosEmpresa) saldoEmpresaMap[s.material_id ?? s.insumo_id] = s.saldo_atual || 0;
  const getSaldoCentral = (materialId) => materialId ? (saldoCentralMap[materialId] || 0) : null;
  const getSaldoEmpresa = (materialId) => materialId ? (saldoEmpresaMap[materialId] || 0) : null;
  // Disponível total (empresa + central) — usado para sinalizar item sem saldo suficiente.
  const getSaldo = (materialId) => materialId ? ((saldoEmpresaMap[materialId] || 0) + (saldoCentralMap[materialId] || 0)) : null;

  const validate = () => {
    const e = {};
    if (!form.obra_id) e.obra_id = 'Obra é obrigatória';
    if (!form.local_estoque_id) e.local_estoque_id = 'Local de origem é obrigatório';
    if (!form.data_requisicao) e.data_requisicao = 'Informe a data';

    // Linha pela metade era descartada em silêncio ao salvar.
    const linhas = {};
    itens.forEach((i, idx) => {
      const temMaterial = !!i.material_id;
      const qtd = Number(i.quantidade_solicitada);
      const l = {};
      if (temMaterial && !(qtd > 0)) l.quantidade = 'Informe a quantidade';
      if (!temMaterial && String(i.quantidade_solicitada || '').trim()) l.material = 'Selecione o material';
      if (Object.keys(l).length) linhas[idx] = l;
    });
    if (Object.keys(linhas).length) {
      e.linhas = linhas;
      e.itens = 'Complete os itens destacados.';
    }

    const valid = itens.filter(i => i.material_id && Number(i.quantidade_solicitada) > 0);
    if (valid.length === 0) e.itens = 'Adicione pelo menos um item com quantidade';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ enviar }) => {
      const obra = obras.find(o => o.id === form.obra_id);
      const local = locais.find(l => l.id === form.local_estoque_id);
      const validItens = itens.filter(i => i.material_id && Number(i.quantidade_solicitada) > 0);
      const status = enviar ? 'ENVIADA' : 'RASCUNHO';

      let reqId = requisicao?.id;
      const payload = { ...form, obra_nome: obra?.nome || '', local_estoque_nome: local?.nome || '', status, solicitante_user_id: user?.email || '', solicitante_nome: user?.full_name || '' };

      if (reqId) {
        await base44.entities.RequisicaoObra.update(reqId, payload);
        for (const it of itensExistentes) await base44.entities.RequisicaoObraItem.delete(it.id);
      } else {
        const created = await base44.entities.RequisicaoObra.create(payload);
        reqId = created.id;
      }
      await Promise.all(validItens.map(item => base44.entities.RequisicaoObraItem.create({
        requisicao_id: reqId, material_id: item.material_id, insumo_id: item.insumo_id || item.material_id, material_nome: item.material_nome,
        material_unidade: item.material_unidade, quantidade_solicitada: Number(item.quantidade_solicitada), quantidade_baixada: 0,
      })));
    },
    onSuccess: () => { qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('requisic') }); toast.success('Requisição salva!'); onClose(); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const cancelarMutation = useMutation({
    mutationFn: () => base44.entities.RequisicaoObra.update(requisicao.id, { status: 'CANCELADA' }),
    onSuccess: () => { qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('requisic') }); toast.success('Requisição cancelada.'); onClose(); },
  });

  const disabled = !editable || saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isView ? 'Requisição de Consumo' : 'Nova Requisição'}
            {requisicao?.status && <Badge className={STATUS_CLS[requisicao.status]}>{STATUS_LABEL[requisicao.status]}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Obra + Local */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Obra *</Label>
              <div className="mt-1">
                {obraFixaId ? (
                  <Input value={obras.find((o) => o.id === form.obra_id)?.nome || requisicao?.obra_nome || 'Obra atual'} disabled className="h-11" />
                ) : (
                  <ComboboxBusca
                    options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                    value={form.obra_id}
                    onSelect={(v) => setField('obra_id', v)}
                    placeholder="Selecionar obra..."
                    searchPlaceholder="Buscar obra..."
                    className={errors.obra_id ? 'border-red-400' : ''}
                  />
                )}
              </div>
              {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
            </div>
            <div>
              <Label>Local de Estoque (Destino) *</Label>
              <div className="mt-1">
                {obraFixaId ? (
                  <Input value={locais.find((l) => l.id === form.local_estoque_id)?.nome || requisicao?.local_estoque_nome || '—'} disabled className="h-11" />
                ) : (
                  <ComboboxBusca
                    options={locais.map((l) => ({ value: l.id, label: `${l.nome}${l.tipo ? ` (${l.tipo})` : ''}` }))}
                    value={form.local_estoque_id}
                    onSelect={(v) => setField('local_estoque_id', v)}
                    placeholder="Selecionar local..."
                    searchPlaceholder="Buscar local..."
                    className={errors.local_estoque_id ? 'border-red-400' : ''}
                  />
                )}
              </div>
              {errors.local_estoque_id && <p className="text-xs text-red-500 mt-1">{errors.local_estoque_id}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Data da Requisição *</Label>
              <Input type="date" value={form.data_requisicao} onChange={e => setField('data_requisicao', e.target.value)} disabled={!editable}
                className={`h-11 ${errors.data_requisicao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
              {errors.data_requisicao && <p className="text-xs text-red-500 mt-1">{errors.data_requisicao}</p>}
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

            <div className="hidden md:block border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-500">Material</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Qtd Solicitada</th>
                    {empresaLocal && <th className="text-right p-2 font-semibold text-gray-500 w-24">Saldo Empresa</th>}
                    {centralId && <th className="text-right p-2 font-semibold text-gray-500 w-24">Saldo Central</th>}
                    <th className="text-right p-2 font-semibold text-gray-500 w-24">Atendido</th>
                    {editable && <th className="w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map((item, idx) => {
                    const saldo = getSaldo(item.material_id);
                    const qtd = Number(item.quantidade_solicitada) || 0;
                    const semSaldo = saldo !== null && qtd > saldo;
                    return (
                      <tr key={idx} className={`align-middle ${semSaldo ? 'bg-red-50' : 'bg-white'}`}>
                        <td className="p-1 min-w-[180px]">
                          <ComboboxBusca
                            options={materiais.filter((i) => i.ativo !== false).map((i) => ({ value: i.id, label: `${i.descricao || '—'} (${i.unidade})` }))}
                            value={item.material_id}
                            onSelect={(v) => onMaterialChange(idx, v)}
                            placeholder="Selecionar..."
                            searchPlaceholder="Buscar insumo..."
                            className={(errors.itens && !item.material_id) || errors.linhas?.[idx]?.material ? 'border-red-400' : ''}
                          />
                          {errors.linhas?.[idx]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].material}</p>}
                        </td>
                        <td className="p-1">
                          <Input type="number" min="0" step="0.001" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : semSaldo ? 'border-red-300' : ''}`}
                            value={item.quantidade_solicitada} onChange={e => setItem(idx, 'quantidade_solicitada', e.target.value)} disabled={!editable} placeholder="0" />
                          {errors.linhas?.[idx]?.quantidade && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].quantidade}</p>}
                        </td>
                        {empresaLocal && (
                          <td className="p-2 text-right">
                            {item.material_id ? (
                              <span className={`text-xs font-semibold ${getSaldoEmpresa(item.material_id) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {getSaldoEmpresa(item.material_id).toFixed(2)}
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        )}
                        {centralId && (
                          <td className="p-2 text-right">
                            {item.material_id ? (
                              <span className={`text-xs font-semibold ${getSaldoCentral(item.material_id) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {getSaldoCentral(item.material_id).toFixed(2)}
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        )}
                        <td className="p-2 text-right text-gray-400 text-xs">{item.quantidade_atendida ?? item.quantidade_baixada ?? 0}</td>
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

            {/* Itens (mobile) */}
            <div className="md:hidden space-y-3">
              {itens.map((item, idx) => {
                const saldo = getSaldo(item.material_id);
                const qtd = Number(item.quantidade_solicitada) || 0;
                const semSaldo = saldo !== null && qtd > saldo;
                return (
                  <div key={idx} className={`border rounded-lg p-3 space-y-2 ${semSaldo ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
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
                      {editable && (
                        <Button variant="ghost" size="icon" className="h-11 w-9 text-red-400 shrink-0 mt-5" onClick={() => setItens(p => p.filter((_, i) => i !== idx))} disabled={itens.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Qtd Solicitada</Label>
                      <Input type="number" min="0" step="0.001" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : semSaldo ? 'border-red-300' : ''}`}
                        value={item.quantidade_solicitada} onChange={e => setItem(idx, 'quantidade_solicitada', e.target.value)} disabled={!editable} placeholder="0" />
                      {errors.linhas?.[idx]?.quantidade && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].quantidade}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-3">
                        {empresaLocal && item.material_id && (
                          <span className="text-gray-500">Empresa: <span className={`font-semibold ${getSaldoEmpresa(item.material_id) > 0 ? 'text-green-600' : 'text-gray-400'}`}>{getSaldoEmpresa(item.material_id).toFixed(2)}</span></span>
                        )}
                        {centralId && item.material_id && (
                          <span className="text-gray-500">Central: <span className={`font-semibold ${getSaldoCentral(item.material_id) > 0 ? 'text-green-600' : 'text-gray-400'}`}>{getSaldoCentral(item.material_id).toFixed(2)}</span></span>
                        )}
                      </div>
                      <span className="text-gray-400">Atendido: {item.quantidade_atendida ?? item.quantidade_baixada ?? 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2">
            {editable && (
              <>
                <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700" disabled={saveMutation.isPending} onClick={() => { if (!validate()) { toast.error('Verifique os campos destacados.'); return; } saveMutation.mutate({ enviar: true }); }}>
                  {saveMutation.isPending ? 'Salvando...' : 'Enviar Requisição'}
                </Button>
                <Button variant="outline" className="w-full sm:w-auto" disabled={saveMutation.isPending} onClick={() => { if (!validate()) { toast.error('Verifique os campos destacados.'); return; } saveMutation.mutate({ enviar: false }); }}>Rascunho</Button>
              </>
            )}
            {isView && requisicao?.status === 'ENVIADA' && (
              <p className="w-full sm:flex-1 text-xs text-gray-500 self-center">
                <b>Aprove</b> a requisição na lista para liberar o atendimento.
              </p>
            )}
            {isView && requisicao?.status === 'APROVADA' && (
              <p className="w-full sm:flex-1 text-xs text-gray-500 self-center">
                Para entregar o material, use o botão <b>Atender</b> na lista (transfere do Central para a obra).
              </p>
            )}
            {['ENVIADA', 'APROVADA', 'RASCUNHO'].includes(requisicao?.status) && (
              <Button variant="ghost" className="w-full sm:w-auto text-red-400" disabled={cancelarMutation.isPending} onClick={async () => {
                if (await confirmar({ titulo: 'Cancelar requisição', descricao: 'Cancelar esta requisição de material?', destrutivo: true, confirmar: 'Cancelar requisição', cancelar: 'Voltar' })) cancelarMutation.mutate();
              }}>Cancelar</Button>
            )}
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}