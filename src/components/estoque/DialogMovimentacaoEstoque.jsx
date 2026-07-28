import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';

const TIPO_CONFIG = {
  ENTRADA: { label: 'Entrada', icon: ArrowDown, color: 'text-green-600', desc: 'Recebimento de materiais no almoxarifado destino' },
  SAIDA: { label: 'Saída', icon: ArrowUp, color: 'text-red-600', desc: 'Consumo/saída do almoxarifado origem' },
  TRANSFERENCIA: { label: 'Transferência', icon: ArrowRight, color: 'text-blue-600', desc: 'Mover materiais entre almoxarifados' }
};

const ITEM_VAZIO = { material_id: '', insumo_id: '', material_nome: '', material_unidade: '', qtd: '', custo_unit: '' };

// Rótulo do almoxarifado por nível (3 valores: Central / Empresa / Obra).
const rotuloLocal = (l) => ({ CENTRAL: ' (Central)', EMPRESA: ' (Empresa)', OBRA: ' (Obra)' }[l.nivel || l.tipo] || '');

export default function DialogMovimentacaoEstoque({ open, onClose, onSuccess, locais = [], almoxPreSelecionado = null }) {
  const [tipo, setTipo] = useState('ENTRADA');
  const [almoxOrigem, setAlmoxOrigem] = useState('');
  const [almoxDestino, setAlmoxDestino] = useState(almoxPreSelecionado || '');
  const [obraId, setObraId] = useState('');
  const [documentoRef, setDocumentoRef] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const limparErro = (k) => setErrors(p => (p[k] ? { ...p, [k]: null } : p));
  const limparErroLinha = (i) => setErrors(p => {
    if (!p.itens && !p.linhas?.[i]) return p;
    const linhas = { ...(p.linhas || {}) };
    delete linhas[i];
    return { ...p, itens: null, linhas };
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-mov'],
    queryFn: () => base44.entities.Insumo.list('descricao', 5000)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-almox'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000)
  });

  const locaisAtivos = useMemo(() => locais.filter(l => l.ativo !== false), [locais]);
  const obraIds = useMemo(() => new Set(obras.map(o => o.id)), [obras]);
  // Defesa: esconde almoxarifados de OBRA órfãos (obra_id inexistente — resquício de reseed),
  // que apareciam com nome idêntico ao válido e faziam o material "sumir" na obra errada.
  const locaisSelecionaveis = useMemo(
    () => (obras.length
      ? locaisAtivos.filter(l => ((l.nivel || l.tipo) === 'OBRA' ? (l.obra_id && obraIds.has(l.obra_id)) : true))
      : locaisAtivos),
    [locaisAtivos, obraIds, obras.length]
  );
  const tipoConfig = TIPO_CONFIG[tipo];
  const TipoIcon = tipoConfig.icon;

  const addItem = () => setItens(prev => [...prev, { ...ITEM_VAZIO }]);
  const removeItem = (i) => setItens(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    setItens(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };

      // Auto-preencher nome/unidade ao selecionar insumo (catálogo único = Insumo)
      if (field === 'material_id') {
        const insumo = insumos.find(m => m.id === value);
        if (insumo) {
          next[i].insumo_id = insumo.id;
          next[i].material_nome = insumo.descricao;
          next[i].material_unidade = insumo.unidade || '';
        }
      }
      return next;
    });
    limparErroLinha(i);
  };

  const validar = () => {
    const e = {};
    if ((tipo === 'SAIDA' || tipo === 'TRANSFERENCIA') && !almoxOrigem) e.origem = 'Selecione o almoxarifado de origem';
    if ((tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA') && !almoxDestino) e.destino = 'Selecione o almoxarifado de destino';
    if (tipo === 'TRANSFERENCIA' && almoxOrigem && almoxOrigem === almoxDestino) e.destino = 'Origem e destino devem ser diferentes';

    // Linha pela metade era descartada em silêncio ao salvar.
    const linhas = {};
    itens.forEach((it, i) => {
      const temMaterial = !!it.material_id;
      const qtd = parseFloat(it.qtd);
      const l = {};
      if (temMaterial && !(qtd > 0)) l.qtd = 'Informe a quantidade';
      if (!temMaterial && String(it.qtd || '').trim()) l.material = 'Selecione o material';
      // Entrada sem custo zera o valor do estoque; o custo médio fica errado daí em diante.
      if (tipo === 'ENTRADA' && temMaterial && !(parseFloat(it.custo_unit) > 0)) l.custo = 'Informe o custo unitário';
      if (Object.keys(l).length) linhas[i] = l;
    });
    if (Object.keys(linhas).length) {
      e.linhas = linhas;
      e.itens = 'Complete os itens destacados.';
    }

    if (itens.filter(it => it.material_id && parseFloat(it.qtd) > 0).length === 0) {
      e.itens = 'Adicione pelo menos um item com quantidade maior que zero';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    const itensValidos = itens.filter(it => it.material_id && parseFloat(it.qtd) > 0);

    setSaving(true);
    try {
      const response = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo,
        almox_origem_id: almoxOrigem || null,
        almox_destino_id: almoxDestino || null,
        obra_id: obraId || null,
        documento_ref: documentoRef || null,
        observacao,
        itens: itensValidos.map(it => ({
          material_id: it.material_id,
          insumo_id: it.insumo_id || it.material_id,
          material_nome: it.material_nome,
          material_unidade: it.material_unidade,
          qtd: parseFloat(it.qtd),
          custo_unit: parseFloat(it.custo_unit || 0)
        }))
      });

      if (response.data?.success) {
        toast.success(`${tipoConfig.label} registrada com sucesso!`);
        onSuccess();
      } else {
        toast.error(response.data?.error || 'Erro ao processar movimentação');
      }
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Tipo */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de Movimentação *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TIPO_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => { setTipo(key); setErrors({}); }}
                    className={`border rounded-lg p-3 text-center transition-all ${tipo === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${cfg.color}`} />
                    <div className={`text-sm font-semibold ${tipo === key ? 'text-blue-700' : 'text-gray-700'}`}>
                      {cfg.label}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">{tipoConfig.desc}</p>
          </div>

          {/* Almoxarifados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(tipo === 'SAIDA' || tipo === 'TRANSFERENCIA') && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Almoxarifado Origem *</label>
                <ComboboxBusca
                  options={locaisSelecionaveis.filter(l => l.id !== almoxDestino).map(l => ({ value: l.id, label: `${l.nome}${rotuloLocal(l)}` }))}
                  value={almoxOrigem}
                  onSelect={(v) => { setAlmoxOrigem(v); limparErro('origem'); limparErro('destino'); }}
                  placeholder="Selecionar..."
                  searchPlaceholder="Buscar almoxarifado..."
                  emptyMessage="Nenhum almoxarifado."
                  className={errors.origem ? 'border-red-400' : ''}
                />
                {errors.origem && <p className="text-xs text-red-500 mt-1">{errors.origem}</p>}
              </div>
            )}

            {(tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA') && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Almoxarifado Destino *</label>
                <ComboboxBusca
                  options={locaisSelecionaveis.filter(l => l.id !== almoxOrigem).map(l => ({ value: l.id, label: `${l.nome}${rotuloLocal(l)}` }))}
                  value={almoxDestino}
                  onSelect={(v) => { setAlmoxDestino(v); limparErro('destino'); }}
                  placeholder="Selecionar..."
                  searchPlaceholder="Buscar almoxarifado..."
                  emptyMessage="Nenhum almoxarifado."
                  className={errors.destino ? 'border-red-400' : ''}
                />
                {errors.destino && <p className="text-xs text-red-500 mt-1">{errors.destino}</p>}
              </div>
            )}
          </div>

          {/* Dados opcionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Documento Ref. (NF/OC)</label>
              <Input
                value={documentoRef}
                onChange={e => setDocumentoRef(e.target.value)}
                placeholder="Ex: NF-12345, OC-89..."
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Obra (custo/consumo)</label>
              <ComboboxBusca
                options={[{ value: '__none', label: '— Nenhuma —' }, ...obras.filter(o => o.status !== 'cancelada').map(o => ({ value: o.id, label: o.nome }))]}
                value={obraId}
                onSelect={(v) => setObraId(v === '__none' ? '' : v)}
                placeholder="Opcional..."
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra."
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observação</label>
            <Input
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Observações..."
              className="h-11"
            />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Itens *</label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            </div>
            {errors.itens && <p className="text-xs text-red-500 mb-2">{errors.itens}</p>}

            {/* Desktop: tabela */}
            <div className="hidden sm:block border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Material</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Qtd</th>
                    {tipo === 'ENTRADA' && (
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Custo Unit.</th>
                    )}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 align-middle">
                        <ComboboxBusca
                          options={insumos.map(m => ({ value: m.id, label: `${m.descricao} (${m.unidade})` }))}
                          value={item.material_id}
                          onSelect={v => updateItem(i, 'material_id', v)}
                          placeholder="Selecionar..."
                          searchPlaceholder="Buscar insumo..."
                          emptyMessage="Nenhum insumo."
                          className={errors.linhas?.[i]?.material ? 'border-red-400' : ''}
                        />
                        {errors.linhas?.[i]?.material && <p className="text-xs text-red-500 mt-1">{errors.linhas[i].material}</p>}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.qtd}
                          onChange={e => updateItem(i, 'qtd', e.target.value)}
                          className={`h-11 text-sm text-right ${errors.linhas?.[i]?.qtd ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                          placeholder="0"
                        />
                        {errors.linhas?.[i]?.qtd && <p className="text-xs text-red-500 mt-1">{errors.linhas[i].qtd}</p>}
                      </td>
                      {tipo === 'ENTRADA' && (
                        <td className="px-3 py-2 align-middle">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.custo_unit}
                            onChange={e => updateItem(i, 'custo_unit', e.target.value)}
                            className={`h-11 text-sm text-right ${errors.linhas?.[i]?.custo ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                            placeholder="R$ 0,00"
                          />
                          {errors.linhas?.[i]?.custo && <p className="text-xs text-red-500 mt-1">{errors.linhas[i].custo}</p>}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center align-middle">
                        {itens.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-9 w-9">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="sm:hidden space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-white">
                  <ComboboxBusca
                    options={insumos.map(m => ({ value: m.id, label: `${m.descricao} (${m.unidade})` }))}
                    value={item.material_id}
                    onSelect={v => updateItem(i, 'material_id', v)}
                    placeholder="Selecionar..."
                    searchPlaceholder="Buscar insumo..."
                    emptyMessage="Nenhum insumo."
                    className={errors.linhas?.[i]?.material ? 'border-red-400' : ''}
                  />
                  {errors.linhas?.[i]?.material && <p className="text-xs text-red-500">{errors.linhas[i].material}</p>}
                  {tipo === 'ENTRADA' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Qtd</label>
                        <Input type="number" min="0" step="0.001" value={item.qtd} onChange={e => updateItem(i, 'qtd', e.target.value)} className={`h-10 text-sm text-right mt-0.5 ${errors.linhas?.[i]?.qtd ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="0" />
                        {errors.linhas?.[i]?.qtd && <p className="text-xs text-red-500 mt-1">{errors.linhas[i].qtd}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Custo Unit.</label>
                        <Input type="number" min="0" step="0.01" value={item.custo_unit} onChange={e => updateItem(i, 'custo_unit', e.target.value)} className={`h-10 text-sm text-right mt-0.5 ${errors.linhas?.[i]?.custo ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="R$ 0,00" />
                        {errors.linhas?.[i]?.custo && <p className="text-xs text-red-500 mt-1">{errors.linhas[i].custo}</p>}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-500">Qtd</label>
                      <Input type="number" min="0" step="0.001" value={item.qtd} onChange={e => updateItem(i, 'qtd', e.target.value)} className={`h-10 text-sm text-right mt-0.5 ${errors.linhas?.[i]?.qtd ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="0" />
                      {errors.linhas?.[i]?.qtd && <p className="text-xs text-red-500 mt-1">{errors.linhas[i].qtd}</p>}
                    </div>
                  )}
                  {itens.length > 1 && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => removeItem(i)} className="h-8 gap-1 text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" /> Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="w-full sm:flex-1">Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className={`w-full sm:flex-1 ${tipoConfig.color === 'text-green-600' ? 'bg-green-600 hover:bg-green-700' : tipoConfig.color === 'text-red-600' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
            >
              {saving ? 'Salvando...' : `Registrar ${tipoConfig.label}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}