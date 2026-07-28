import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Building2, ChevronDown, ChevronUp, AlertCircle, FileText, Truck } from 'lucide-react';
import { toast } from 'sonner';
import PCRateioModal from './PCRateioModal';
import BotaoAnexarNF from '../documentos-fiscais/BotaoAnexarNF';
import FornecedorSelectComCadastro from './FornecedorSelectComCadastro';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import PCNotaFiscalAnexos from './PCNotaFiscalAnexos';
import PCMultiobraResumo from './PCMultiobraResumo';
import { validarRateioPedido } from './PCValidadorRateio';

const EMPTY_ITEM = {
  material_id: '', material_nome: '', material_unidade: '',
  quantidade_pedida: '', preco_unitario: '', total_item: 0,
  rateio_obras: [], // [{ obra_id, obra_nome, quantidade }]
  _showRateio: false,
};

function calcTotal(itens) {
  return itens.reduce((acc, i) => acc + (Number(i.quantidade_pedida) * Number(i.preco_unitario) || 0), 0);
}

// Subcomponente: rateio de obras de um item
function RateioObraPanel({ item, idx, obras, consolidado, onChange, obrasMultiSelecionadas }) {
  if (!consolidado) return null;

  const rateio = item.rateio_obras || [];
  const totalRateio = rateio.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);
  const qtdPedida = Number(item.quantidade_pedida) || 0;
  const diff = Math.abs(qtdPedida - totalRateio);
  const valid = diff < 0.001;

  const obrasDisponiveis = obrasMultiSelecionadas.length > 0 
    ? obrasMultiSelecionadas 
    : obras;

  const addRateio = () => {
    if (obrasDisponiveis.length === 0) return;
    const newRateio = [...rateio, { obra_id: '', obra_nome: '', quantidade: '' }];
    onChange(idx, 'rateio_obras', newRateio);
  };

  const removeRateio = (ri) => {
    onChange(idx, 'rateio_obras', rateio.filter((_, i) => i !== ri));
  };

  const setRateioField = (ri, field, value) => {
    const updated = rateio.map((r, i) => {
      if (i !== ri) return r;
      if (field === 'obra_id') {
        const obra = obras.find(o => o.id === value);
        return { ...r, obra_id: value, obra_nome: obra?.nome || '' };
      }
      return { ...r, [field]: value };
    });
    onChange(idx, 'rateio_obras', updated);
  };

  return (
    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700">Rateio por obra</span>
        <div className="flex items-center gap-2">
          {!valid && qtdPedida > 0 && (
            <span className="text-xs text-orange-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Soma: {totalRateio} ≠ {qtdPedida}
            </span>
          )}
          {valid && qtdPedida > 0 && (
            <span className="text-xs text-green-600">✓ Rateio OK</span>
          )}
          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={addRateio} disabled={obrasDisponiveis.length === 0}>
            <Plus className="w-3 h-3 mr-1" /> Obra
          </Button>
        </div>
      </div>

      {obrasDisponiveis.length === 0 && (
        <p className="text-xs text-orange-500 italic">Selecione ao menos uma obra no topo para distribuir os itens</p>
      )}

      {rateio.length === 0 && obrasDisponiveis.length > 0 && (
        <p className="text-xs text-blue-400 italic">Clique em "+ Obra" para distribuir a quantidade</p>
      )}

      {rateio.map((r, ri) => (
      <div key={ri} className="flex gap-2 items-center">
      <Select value={r.obra_id} onValueChange={v => setRateioField(ri, 'obra_id', v)}>
      <SelectTrigger className="h-7 text-xs flex-1 bg-white">
      <SelectValue placeholder="Selecionar obra..." />
      </SelectTrigger>
      <SelectContent>
      {obrasDisponiveis.map(o => (
        <SelectItem key={o.id} value={o.id}>
          {o.nome} — {o.cidade}/{o.estado}
        </SelectItem>
      ))}
            </SelectContent>
          </Select>
          <Input
            type="number" min="0" step="0.001"
            className="h-7 text-xs w-24 text-right bg-white"
            value={r.quantidade}
            onChange={e => setRateioField(ri, 'quantidade', e.target.value)}
            placeholder="Qtd"
          />
          <span className="text-xs text-gray-400">{item.material_unidade}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => removeRateio(ri)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function PCModal({ open, onClose, pc }) {
  const qc = useQueryClient();
  const isEdit = !!pc?.id;
  const isView = pc?.status && !['RASCUNHO'].includes(pc.status);

  const [form, setForm] = useState({
    obra_id: '', fornecedor_id: '', data_pedido: '',
    previsao_entrega: '', condicao_pagamento: '', observacao: '',
    consolidado: false,
  });
  const [obrasMulti, setObrasMulti] = useState([]);
  const [itens, setItens] = useState([{ ...EMPTY_ITEM }]);
  const [errors, setErrors] = useState({});
  const [rateioModalOpen, setRateioModalOpen] = useState(false);
  const [rateioItemIdx, setRateioItemIdx] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [anexosPC, setAnexosPC] = useState([]);
  const [novoMatModal, setNovoMatModal] = useState(false);
  const [novoMatForm, setNovoMatForm] = useState({ nome: '', unidade: 'UN' });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-pc'],
    // Carrega todas as obras (exceto encerradas/canceladas) — antes filtrava só
    // status específicos e escondia obras 'a_iniciar', deixando o dropdown vazio.
    queryFn: async () => {
      const todas = await base44.entities.Obra.list('nome', 1000);
      return todas
        .filter((o) => !['encerrada', 'cancelada'].includes(String(o.status).toLowerCase()))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    },
    enabled: open,
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-pc'],
    queryFn: () => base44.entities.Fornecedor.list('razao_social', 2000).catch(() => []),
    enabled: open,
  });
  const { data: materiais = [] } = useQuery({
    queryKey: ['insumos-todos'],
    queryFn: async () => {
      try {
        const result = await base44.entities.Insumo.list('descricao', 5000);
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('[PCModal] Erro ao carregar insumos:', err);
        return [];
      }
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const { data: itensExistentes = [] } = useQuery({
    queryKey: ['pc-itens', pc?.id],
    queryFn: () => base44.entities.PedidoCompraItem.filter({ pedido_id: pc.id }),
    enabled: open && !!pc?.id,
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        obra_id: pc.obra_id || '', fornecedor_id: pc.fornecedor_id || '',
        data_pedido: pc.data_pedido || '', previsao_entrega: pc.previsao_entrega || '',
        condicao_pagamento: pc.condicao_pagamento || '', observacao: pc.observacao || '',
        consolidado: pc.consolidado || false,
      });
      setObrasMulti(pc.obras_multi || []);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setForm({ obra_id: '', fornecedor_id: '', data_pedido: today, previsao_entrega: '', condicao_pagamento: '', observacao: '', consolidado: false });
      setItens([{ ...EMPTY_ITEM }]);
      setObrasMulti([]);
      setAnexosPC([]);
    }
    setErrors({});
  }, [open, pc?.id]);

  useEffect(() => {
    if (itensExistentes.length > 0) {
      setItens(itensExistentes.map(i => ({
        ...i,
        total_item: i.quantidade_pedida * i.preco_unitario,
        rateio_obras: i.rateio_obras || [],
        _showRateio: (i.rateio_obras || []).length > 0,
      })));
    }
  }, [itensExistentes]);

  const setField = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: null })); };
  const addItem = () => setItens(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItens(p => p.filter((_, idx) => idx !== i));

  const setItem = (i, k, v) => {
    setItens(p => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [k]: v };
      if (k !== 'rateio_obras' && k !== '_showRateio') {
        updated.total_item = Number(updated.quantidade_pedida) * Number(updated.preco_unitario) || 0;
      }
      return updated;
    }));
    limparErroLinha(i);
  };

  // Ao mexer numa linha, some o destaque dela (e o resumo de itens).
  const limparErroLinha = (i) => setErrors(p => {
    if (!p.itens && !p.linhas?.[i]) return p;
    const linhas = { ...(p.linhas || {}) };
    delete linhas[i];
    return { ...p, itens: null, linhas };
  });

  const onMaterialChange = (idx, materialId) => {
    const insumo = materiais.find(m => m.id === materialId);
    setItens(p => p.map((item, i) => i === idx
      ? { ...item, material_id: materialId, insumo_id: materialId, material_nome: insumo?.descricao || '', material_unidade: insumo?.unidade || '' }
      : item));
    limparErroLinha(idx);
  };

  const handleCriarMaterial = async () => {
    if (!novoMatForm.nome.trim()) {
      toast.error('Nome do insumo é obrigatório');
      return;
    }
    try {
      const novoMat = await base44.entities.Insumo.create({
        descricao: novoMatForm.nome.trim(),
        unidade: novoMatForm.unidade,
        ativo: true,
      });
      await qc.invalidateQueries({ queryKey: ['insumos-todos'] });
      // Seleciona o insumo recém-criado no último item da lista
      setItens(p => {
        if (p.length === 0) return p;
        const lastIdx = p.length - 1;
        return p.map((item, i) => i === lastIdx
          ? { ...item, material_id: novoMat.id, insumo_id: novoMat.id, material_nome: novoMat.descricao || '', material_unidade: novoMat.unidade || '' }
          : item);
      });
      toast.success('Insumo criado e selecionado no item!');
      setNovoMatModal(false);
      setNovoMatForm({ nome: '', unidade: 'UN' });
    } catch (err) {
      toast.error('Erro ao criar insumo: ' + err.message);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.fornecedor_id) e.fornecedor_id = 'Fornecedor é obrigatório';

    if (!form.consolidado) {
      if (!form.obra_id) e.obra_id = 'Obra é obrigatória';
    }

    if (form.consolidado && obrasMulti.length === 0) {
      e.obrasMulti = 'Selecione ao menos uma obra para o pedido consolidado';
    }

    if (!form.data_pedido) e.data_pedido = 'Informe a data do pedido';
    if (form.previsao_entrega && form.data_pedido && form.previsao_entrega < form.data_pedido) {
      e.previsao_entrega = 'A previsão não pode ser anterior à data do pedido';
    }

    // Linha pela metade era descartada em silêncio; preço vazio virava R$ 0 no pedido.
    const linhas = {};
    itens.forEach((i, idx) => {
      const temMaterial = !!i.material_id;
      const temQtd = Number(i.quantidade_pedida) > 0;
      const temPreco = Number(i.preco_unitario) > 0;
      const l = {};
      if (temMaterial && !temQtd) l.quantidade = 'Informe a quantidade';
      if (temMaterial && !temPreco) l.preco = 'Informe o preço';
      if (!temMaterial && (temQtd || String(i.preco_unitario || '').trim())) l.material = 'Selecione o material';
      if (Object.keys(l).length) linhas[idx] = l;
    });
    if (Object.keys(linhas).length) {
      e.linhas = linhas;
      e.itens = 'Complete os itens destacados (material, quantidade e preço).';
    }

    const valid = itens.filter(i => i.material_id && Number(i.quantidade_pedida) > 0);
    if (valid.length === 0) e.itens = 'Adicione pelo menos um item com material e quantidade';

    // Validar rateio se consolidado (usando validador dedicado)
    if (form.consolidado && valid.length > 0) {
      const resultadoRateio = validarRateioPedido(valid);
      if (!resultadoRateio.valido) {
        e.rateio = resultadoRateio.erros[0] || 'Rateio inválido';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ enviar }) => {
      const user = await base44.auth.me();
      const forn = fornecedores.find(f => f.id === form.fornecedor_id);
      const validItens = itens.filter(i => i.material_id && Number(i.quantidade_pedida) > 0);
      const valor_total = calcTotal(validItens);

      // obra_id: se consolidado, pega a 1a obra do rateio do 1o item, ou mantém form.obra_id
      let obraId = form.obra_id;
      let obraNome = obras.find(o => o.id === obraId)?.nome || '';
      if (form.consolidado && !obraId) {
        const primeiroRateio = validItens[0]?.rateio_obras?.[0];
        obraId = primeiroRateio?.obra_id || '';
        obraNome = primeiroRateio?.obra_nome || '';
      }

      // Preparar payload para backend
      const pedidoData = {
        id: pc?.id || null,
        consolidado: form.consolidado,
        fornecedor_id: form.fornecedor_id,
        fornecedor_nome: forn?.razao_social || '',
        obra_id: obraId,
        obra_nome: obraNome,
        obras_multi: form.consolidado ? obrasMulti : [],
        data_pedido: form.data_pedido,
        previsao_entrega: form.previsao_entrega,
        condicao_pagamento: form.condicao_pagamento,
        observacao: form.observacao,
      };

      const itensData = validItens.map(item => ({
        id: item.id || null,
        material_id: item.material_id,
        material_nome: item.material_nome,
        material_unidade: item.material_unidade,
        quantidade_pedida: Number(item.quantidade_pedida),
        preco_unitario: Number(item.preco_unitario) || 0,
        total_item: item.total_item || 0,
        rateio_obras: form.consolidado ? (item.rateio_obras || []).map(r => ({
          obra_id: r.obra_id,
          obra_nome: r.obra_nome,
          quantidade: Number(r.quantidade) || 0,
          local_estoque_id: r.local_estoque_id || null,
          local_estoque_nome: r.local_estoque_nome || null,
          observacao: r.observacao || null,
        })) : [],
      }));

      // Chamar backend
      const response = await base44.functions.invoke('salvarPedidoCompraConsolidado', {
        pedido: pedidoData,
        itens: itensData,
        enviar,
      });

      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos-compra'] });
      toast.success('Pedido salvo!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSave = (enviar = false) => {
    if (!validate()) { toast.error('Verifique os campos destacados.'); return; }
    saveMutation.mutate({ enviar });
  };

  const handleOpenRateio = (idx) => {
    setRateioItemIdx(idx);
    setRateioModalOpen(true);
  };

  const handleSaveRateio = (rateios) => {
    if (rateioItemIdx !== null) {
      setItem(rateioItemIdx, 'rateio_obras', rateios);
    }
  };

  const handleGerarViagem = async () => {
    // Validar se pedido está ENVIADO e tem rateios
    if (pc?.status !== 'ENVIADO') {
      toast.error('Pedido deve estar em status ENVIADO');
      return;
    }

    if (!form.consolidado) {
      toast.error('Viagem só pode ser gerada de pedidos consolidados');
      return;
    }

    setGerando(true);
    try {
      const response = await base44.functions.invoke('gerarViagemDePedidoConsolidado', {
        pedido_id: pc.id,
      });
      
      if (response.data?.success) {
        toast.success(`${response.data.message}`);
        qc.invalidateQueries({ queryKey: ['viagens-entregas'] });
      } else {
        toast.error(response.data?.error || 'Erro ao gerar viagem');
      }
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setGerando(false);
    }
  };

  const getRateioSummary = (item) => {
    if (!item.rateio_obras || item.rateio_obras.length === 0) return null;
    return item.rateio_obras
      .map(r => `${r.obra_nome} (${Number(r.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: item.material_unidade === 'UN' ? 0 : 3 })})`)
      .join(', ');
  };

  const totalGeral = calcTotal(itens);
  const disabled = isView || saveMutation.isPending;
  const consolidado = form.consolidado;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isView ? `Pedido ${pc?.numero || '—'}` : isEdit ? 'Editar Pedido' : 'Novo Pedido de Compra'}
            {(consolidado || pc?.consolidado) && <Badge className="bg-blue-100 text-blue-700">Multi-obra</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle Consolidado */}
          {!isView && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">Pedido Consolidado (Multi-obra)</p>
                <p className="text-xs text-blue-600">Distribui os itens entre várias obras com rateio de quantidade</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setField('consolidado', !consolidado);
                  if (!consolidado) setObrasMulti([]);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${consolidado ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${consolidado ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Multi-Obra Selection */}
          {consolidado && !isView && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div>
                <Label className="text-amber-900 font-semibold">Obras do Pedido *</Label>
                <p className="text-xs text-amber-700 mb-2">Selecione as obras que receberão este pedido</p>
                {errors.obrasMulti && <p className="text-xs text-red-500 mb-2">{errors.obrasMulti}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-2 bg-white">
                {obras.map(o => (
                  <label key={o.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={obrasMulti.some(om => om.id === o.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setObrasMulti(p => [...p, { id: o.id, nome: o.nome, cidade: o.cidade, estado: o.estado }]);
                        } else {
                          setObrasMulti(p => p.filter(om => om.id !== o.id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-gray-700">{o.nome} — {o.cidade}/{o.estado}</span>
                  </label>
                ))}
              </div>

              {obrasMulti.length > 0 && (
                <div className="flex items-center flex-wrap gap-2 pt-2">
                  <span className="text-xs font-semibold text-amber-800">{obrasMulti.length} obra(s) selecionada(s):</span>
                  {obrasMulti.map(om => (
                    <div key={om.id} className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <span>{om.nome}</span>
                      <button
                        type="button"
                        onClick={() => setObrasMulti(p => p.filter(o => o.id !== om.id))}
                        className="ml-1 font-bold hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Obra principal (só exibido se não consolidado) + Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!consolidado ? (
              <div>
                <Label>Obra *</Label>
                <div className="mt-1">
                  <ComboboxBusca
                    options={obras.map((o) => ({ value: o.id, label: `${o.nome}${o.cidade ? ` — ${o.cidade}/${o.estado || ''}` : ''}` }))}
                    value={form.obra_id}
                    onSelect={(v) => setField('obra_id', v)}
                    placeholder="Selecionar obra..."
                    searchPlaceholder="Buscar obra..."
                    className={errors.obra_id ? 'border-red-400' : ''}
                  />
                </div>
                {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-700">Obras definidas no rateio de cada item</span>
              </div>
            )}
            <FornecedorSelectComCadastro
              value={form.fornecedor_id}
              onChange={v => setField('fornecedor_id', v)}
              disabled={disabled}
              error={errors.fornecedor_id}
              showLabel={true}
              label="Fornecedor *"
            />
          </div>

          {/* Datas + Condição */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Data do Pedido *</Label>
              <Input type="date" value={form.data_pedido} onChange={e => setField('data_pedido', e.target.value)} disabled={disabled}
                className={errors.data_pedido ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {errors.data_pedido && <p className="text-xs text-red-500 mt-1">{errors.data_pedido}</p>}
            </div>
            <div>
              <Label>Previsão de Entrega</Label>
              <Input type="date" value={form.previsao_entrega} onChange={e => setField('previsao_entrega', e.target.value)} disabled={disabled}
                className={errors.previsao_entrega ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {errors.previsao_entrega && <p className="text-xs text-red-500 mt-1">{errors.previsao_entrega}</p>}
            </div>
            <div>
              <Label>Condição de Pagamento</Label>
              <Input value={form.condicao_pagamento} onChange={e => setField('condicao_pagamento', e.target.value)} placeholder="Ex: 30/60/90 dias" disabled={disabled} />
            </div>
          </div>

          {/* Observação */}
          <div>
            <Label>Observação</Label>
            <Textarea value={form.observacao} onChange={e => setField('observacao', e.target.value)} rows={2} disabled={disabled} />
          </div>

          {/* Resumo Multi-Obra (apenas em modo consolidado) */}
          {consolidado && (
            <PCMultiobraResumo
              obras={obrasMulti}
              itens={itens}
              consolidado={consolidado}
              statusNF={pc?.status_nf || null}
            />
          )}

          {/* Nota Fiscal / Anexos */}
           {!isView && (
             <PCNotaFiscalAnexos
               pedidoId={pc?.id}
               pedidoData={form}
               anexosExistentes={anexosPC}
               onAnexoAdicionado={(anexo) => setAnexosPC(prev => [...prev, anexo])}
               onAplicarNF={(resultado) => {
                 const { pedidoAtualizado, mudancas } = resultado;
                 if (pedidoAtualizado?.itens) {
                   setItens(pedidoAtualizado.itens);
                 }
                 if (pedidoAtualizado?.fornecedor_id) {
                   setField('fornecedor_id', pedidoAtualizado.fornecedor_id);
                   setField('fornecedor_nome', pedidoAtualizado.fornecedor_nome);
                 }
                 toast.success(`✓ Dados da NF aplicados (${mudancas?.length || 0} mudança(s))`);
               }}
               disabled={disabled}
             />
           )}

          {/* Itens */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <Label>Itens *</Label>
              {!disabled && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setNovoMatModal(true)} className="gap-1 border-gray-300 text-gray-700"><Plus className="w-3 h-3" /> Novo material</Button>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="w-3 h-3" /> Adicionar Item</Button>
                </div>
              )}
            </div>
            {errors.itens && <p className="text-xs text-red-500 mb-2">{errors.itens}</p>}
            {errors.rateio && (
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 mb-2">
                <AlertCircle className="w-3 h-3" /> {errors.rateio}
              </div>
            )}

            {/* Itens — tabela (desktop) */}
            <div className="hidden md:block border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold text-gray-500">Material</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-24">Qtd Total</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Preço Unit.</th>
                    <th className="text-right p-2 font-semibold text-gray-500 w-28">Total</th>
                    {!consolidado && !disabled && <th className="w-8"></th>}
                    {consolidado && !disabled && <th className="w-32"></th>}
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <tr className={`bg-white border-b border-gray-100 ${consolidado && item.material_id ? 'border-b-0' : ''}`}>
                        <td className="p-1">
                          <ComboboxBusca
                            options={materiais.filter((i) => i.ativo !== false).map((i) => ({ value: i.id, label: `${i.descricao || '.'} (${i.unidade})` }))}
                            value={item.material_id}
                            onSelect={(v) => onMaterialChange(idx, v)}
                            placeholder="Selecionar insumo..."
                            searchPlaceholder="Buscar insumo..."
                            emptyMessage="Nenhum insumo. Use 'Novo material' acima."
                            className={errors.linhas?.[idx]?.material ? 'border-red-400' : ''}
                          />
                          {errors.linhas?.[idx]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].material}</p>}
                        </td>
                        <td className="p-1 align-top">
                          <Input type="number" min="0" step="0.001" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={item.quantidade_pedida}
                            onChange={e => setItem(idx, 'quantidade_pedida', e.target.value)} disabled={disabled} placeholder="0" />
                        </td>
                        <td className="p-1 align-top">
                          <Input type="number" min="0" step="0.01" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.preco ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={item.preco_unitario}
                            onChange={e => setItem(idx, 'preco_unitario', e.target.value)} disabled={disabled} placeholder="R$ 0,00" />
                        </td>
                        <td className="p-2 text-right text-gray-700 font-medium whitespace-nowrap align-middle">
                          {item.total_item ? `R$ ${item.total_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        {!disabled && !consolidado && (
                          <td className="p-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeItem(idx)} disabled={itens.length === 1}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        )}
                        {!disabled && consolidado && (
                          <td className="p-1 text-right">
                            <Button variant="outline" size="sm" onClick={() => handleOpenRateio(idx)} className="gap-1 h-7 text-xs">
                              <FileText className="w-3 h-3" /> Ratear
                            </Button>
                          </td>
                        )}
                      </tr>
                      {/* Resumo de Rateio */}
                      {consolidado && item.material_id && getRateioSummary(item) && (
                        <tr className="bg-blue-50 border-b border-gray-100">
                          <td colSpan={5} className="px-2 py-1 text-xs text-blue-700">
                            <span className="font-semibold">Rateio:</span> {getRateioSummary(item)}
                            {item.rateio_obras && !disabled && (
                              <Button variant="link" size="sm" onClick={() => handleOpenRateio(idx)} className="ml-2 p-0 h-auto text-xs text-blue-600">
                                Editar
                              </Button>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={disabled ? 3 : 4} className="p-2 text-right font-semibold text-gray-700">Total Geral</td>
                    <td className="p-2 text-right font-bold text-blue-700 whitespace-nowrap">
                      R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Itens — cards (mobile) */}
            <div className="md:hidden space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-white">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Material</Label>
                    <ComboboxBusca
                      options={materiais.filter((i) => i.ativo !== false).map((i) => ({ value: i.id, label: `${i.descricao || '.'} (${i.unidade})` }))}
                      value={item.material_id}
                      onSelect={(v) => onMaterialChange(idx, v)}
                      placeholder="Selecionar insumo..."
                      searchPlaceholder="Buscar insumo..."
                      emptyMessage="Nenhum insumo. Use 'Novo material' acima."
                      className={errors.linhas?.[idx]?.material ? 'border-red-400' : ''}
                    />
                    {errors.linhas?.[idx]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].material}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Qtd Total</Label>
                      <Input type="number" min="0" step="0.001" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.quantidade ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={item.quantidade_pedida}
                        onChange={e => setItem(idx, 'quantidade_pedida', e.target.value)} disabled={disabled} placeholder="0" />
                      {errors.linhas?.[idx]?.quantidade && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].quantidade}</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Preço Unit.</Label>
                      <Input type="number" min="0" step="0.01" className={`h-11 text-sm text-right ${errors.linhas?.[idx]?.preco ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={item.preco_unitario}
                        onChange={e => setItem(idx, 'preco_unitario', e.target.value)} disabled={disabled} placeholder="R$ 0,00" />
                      {errors.linhas?.[idx]?.preco && <p className="text-xs text-red-500 mt-1">{errors.linhas[idx].preco}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">Total: <span className="font-semibold text-gray-700">{item.total_item ? `R$ ${item.total_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</span></span>
                    <div className="flex items-center gap-1 shrink-0">
                      {!disabled && consolidado && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenRateio(idx)} className="gap-1 h-8 text-xs">
                          <FileText className="w-3 h-3" /> Ratear
                        </Button>
                      )}
                      {!disabled && !consolidado && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeItem(idx)} disabled={itens.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {consolidado && item.material_id && getRateioSummary(item) && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-700">
                      <span className="font-semibold">Rateio:</span> {getRateioSummary(item)}
                      {item.rateio_obras && !disabled && (
                        <Button variant="link" size="sm" onClick={() => handleOpenRateio(idx)} className="ml-2 p-0 h-auto text-xs text-blue-600">Editar</Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between px-1 pt-1 border-t">
                <span className="text-sm font-semibold text-gray-700">Total Geral</span>
                <span className="text-sm font-bold text-blue-700">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Ações */}
           {!isView && (
             <div className="flex flex-col sm:flex-row gap-2 pt-2">
               <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={saveMutation.isPending} onClick={() => handleSave(true)}>
                 {saveMutation.isPending ? 'Salvando...' : 'Enviar Pedido'}
               </Button>
               <Button variant="outline" disabled={saveMutation.isPending} onClick={() => handleSave(false)}>Salvar Rascunho</Button>
               <Button variant="ghost" onClick={onClose}>Cancelar</Button>
             </div>
           )}

          {/* Ações View */}
           {isView && (
             <div className="border-t pt-3 mt-3 space-y-3">
               <div className="flex flex-col sm:flex-row gap-2">
                 <BotaoAnexarNF
                   referencia_tipo="PEDIDO"
                   referencia_id={pc?.id}
                   onAnexado={() => qc.invalidateQueries({ queryKey: ['nf-vinculos'] })}
                   variant="outline"
                 />

                 {pc?.status === 'ENVIADO' && pc?.consolidado && (
                   <Button 
                     className="gap-2 bg-green-600 hover:bg-green-700"
                     onClick={handleGerarViagem}
                     disabled={gerando}
                   >
                     <Truck className="w-4 h-4" />
                     {gerando ? 'Gerando viagem...' : 'Gerar Romaneio/Viagem'}
                   </Button>
                 )}
               </div>
             </div>
           )}
        </div>

        {/* Modal de Rateio */}
         <PCRateioModal
           open={rateioModalOpen}
           onClose={() => setRateioModalOpen(false)}
           item={rateioItemIdx !== null ? itens[rateioItemIdx] : null}
           obras={obrasMulti.length > 0 ? obrasMulti : obras}
           onSave={handleSaveRateio}
         />

         {/* Modal Criar Novo Material */}
         <Dialog open={novoMatModal} onOpenChange={setNovoMatModal}>
           <DialogContent className="max-w-sm">
             <DialogHeader>
               <DialogTitle>Criar Novo Insumo</DialogTitle>
             </DialogHeader>
             <div className="space-y-4">
               <div>
                 <Label>Nome do Insumo *</Label>
                 <Input
                   placeholder="Ex: Cimento CP V ARI 50kg"
                   value={novoMatForm.nome}
                   onChange={e => setNovoMatForm(p => ({ ...p, nome: e.target.value }))}
                   autoFocus
                 />
               </div>
               <div>
                 <Label>Unidade de Medida *</Label>
                 <Select value={novoMatForm.unidade} onValueChange={u => setNovoMatForm(p => ({ ...p, unidade: u }))}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {['UN', 'KG', 'M', 'M2', 'M3', 'L', 'SC', 'CX', 'T', 'PC', 'GL', 'ROL'].map(u => (
                       <SelectItem key={u} value={u}>{u}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex gap-2 pt-2">
                 <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleCriarMaterial}>
                   Criar Insumo
                 </Button>
                 <Button variant="outline" className="flex-1" onClick={() => setNovoMatModal(false)}>
                   Cancelar
                 </Button>
               </div>
             </div>
           </DialogContent>
         </Dialog>
        </DialogContent>
        </Dialog>
        );
        }