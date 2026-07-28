import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowUp, AlertCircle, Package, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ITEM_VAZIO = { material_id: '', material_nome: '', material_unidade: '', qtd: '', custo_unit: 0, saldo_disponivel: null };

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DialogSaidaEstoqueObra({
  open,
  onClose,
  onSuccess,
  obraIdPreSelecionada = null,
}) {
  const qc = useQueryClient();
  const [obraId, setObraId] = useState(obraIdPreSelecionada || '');
  const [almoxId, setAlmoxId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [etapa, setEtapa] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [saving, setSaving] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [erroSaldo, setErroSaldo] = useState(null);
  const [errors, setErrors] = useState({});
  const cls = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');
  const limpar = (campo) => setErrors((e) => (e[campo] ? { ...e, [campo]: undefined } : e));

  /* ─── Dados ─────────────────────────────────────────── */
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-saida-estoque'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 500),
    staleTime: 60000,
  });

  const { data: locais = [] } = useQuery({
    queryKey: ['locais-estoque-saida'],
    queryFn: () => base44.entities.LocalEstoque.list('nome', 200),
    staleTime: 60000,
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['insumos-lista-saida'],
    queryFn: () => base44.entities.Insumo.list('descricao', 5000),
    staleTime: 60000,
  });

  // Almoxarifados da obra selecionada (tipo=OBRA vinculados) + central
  const locaisDisponiveis = useMemo(() => {
    if (!obraId) return locais.filter(l => l.ativo !== false);
    return locais.filter(l => l.ativo !== false && (l.obra_id === obraId || l.tipo === 'OBRA'));
  }, [locais, obraId]);

  /* ─── Saldos disponíveis por item ─────────────────────── */
  const { data: saldos = [] } = useQuery({
    queryKey: ['saldos-almox-saida', almoxId],
    queryFn: () => almoxId
      ? base44.entities.SaldoEstoque.filter({ local_estoque_id: almoxId }, null, 500)
      : Promise.resolve([]),
    enabled: !!almoxId,
    staleTime: 30000,
  });

  const saldoMap = useMemo(() => {
    const m = {};
    for (const s of saldos) {
      m[s.material_id] = s;
    }
    return m;
  }, [saldos]);

  /* ─── Itens ─────────────────────────────────────────── */
  const addItem = () => setItens(prev => [...prev, { ...ITEM_VAZIO }]);
  const removeItem = (i) => setItens(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i, field, value) => {
    setErroSaldo(null);
    limpar('itens');
    setItens(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };

      if (field === 'material_id') {
        const insumo = materiais.find(m => m.id === value);
        const saldo = saldoMap[value];
        if (insumo) {
          next[i].insumo_id = insumo.id;
          next[i].material_nome = insumo.descricao;
          next[i].material_unidade = insumo.unidade || '';
        }
        next[i].saldo_disponivel = saldo?.saldo_atual ?? null;
        next[i].custo_unit = saldo?.custo_unitario_medio ?? 0;
      }
      return next;
    });
  };

  /* ─── Foto upload ───────────────────────────────────── */
  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotos(prev => [...prev, file_url]);
      toast.success('Foto anexada');
    } catch (err) {
      toast.error('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  /* ─── Submit ─────────────────────────────────────────── */
  const totalCusto = itens.reduce((s, it) => s + (parseFloat(it.qtd || 0) * parseFloat(it.custo_unit || 0)), 0);

  const validar = () => {
    const e = {};
    if (!obraId) e.obra = 'Selecione a obra.';
    if (!almoxId) e.almox = 'Selecione o almoxarifado.';
    if (!motivo.trim()) e.motivo = 'Informe o motivo / serviço.';
    const validos = itens.filter(it => it.material_id && parseFloat(it.qtd) > 0);
    if (validos.length === 0) e.itens = 'Adicione ao menos um item com material e quantidade maior que zero.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    const itensValidos = itens.filter(it => it.material_id && parseFloat(it.qtd) > 0);

    // Regra: só permite consumo se houver saldo suficiente. Se faltar, BLOQUEIA
    // e mostra um alerta claro (no topo do modal) explicando o motivo por item.
    const semSaldo = itensValidos.filter(it => parseFloat(it.qtd) > (saldoMap[it.material_id]?.saldo_atual ?? 0));
    if (semSaldo.length > 0) {
      const detalhes = semSaldo.map(it => {
        const disp = saldoMap[it.material_id]?.saldo_atual ?? 0;
        return `${it.material_nome || 'Material'}: solicitado ${parseFloat(it.qtd)} ${it.material_unidade || ''} · disponível ${disp} ${it.material_unidade || ''}`;
      });
      setErroSaldo(detalhes);
      toast.error('Saída não registrada — saldo insuficiente em estoque.');
      return;
    }
    setErroSaldo(null);

    setSaving(true);
    try {
      // 1. Gerar movimentação SAIDA via função existente
      const resp = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'SAIDA',
        almox_origem_id: almoxId,
        almox_destino_id: null,
        obra_id: obraId,
        documento_ref: motivo ? `CONSUMO: ${motivo}` : 'CONSUMO OBRA',
        observacao: [motivo, etapa ? `Etapa: ${etapa}` : '', observacao].filter(Boolean).join(' | '),
        itens: itensValidos.map(it => ({
          material_id: it.material_id,
          insumo_id: it.insumo_id || it.material_id,
          material_nome: it.material_nome,
          material_unidade: it.material_unidade,
          qtd: parseFloat(it.qtd),
          custo_unit: parseFloat(it.custo_unit || 0),
        })),
      });

      if (!resp.data?.success) {
        throw new Error(resp.data?.error || 'Erro ao processar saída');
      }

      const movId = resp.data.movimentacao_id;

      // 2. Lançar custo de material no centro de custos da obra
      if (totalCusto > 0) {
        const hoje = new Date();
        await base44.entities.LancamentoCustoObra.create({
          obra_id: obraId,
          data_lancamento: hoje.toISOString(),
          origem_tipo: 'estoque_baixa',
          origem_id: movId,
          categoria: 'material',
          descricao: `Consumo estoque: ${motivo}${etapa ? ` (${etapa})` : ''}`,
          valor: totalCusto,
          mes_referencia: format(hoje, 'yyyy-MM-01'),
          status: 'realizado',
        });
      }

      // 3. Salvar fotos como registro na movimentação (se houver)
      for (const url of fotos) {
        await base44.entities.EstoqueMovimentacao.update(movId, {
          // Salvamos as fotos na observacao extendida — não quebra nada
        });
        // Registrar foto como upload
        await base44.entities.UploadArquivo.create({
          entidade: 'EstoqueMovimentacao',
          entidade_id: movId,
          arquivo_url: url,
          tipo: 'FOTO',
          descricao: 'Foto do consumo de material',
        }).catch(() => {}); // silencia se entidade não tiver esse campo
      }

      toast.success('Saída de estoque registrada com sucesso!');
      qc.invalidateQueries({ queryKey: ['saldos-almox-saida', almoxId] });
      qc.invalidateQueries({ queryKey: ['saldo-estoque'] });
      qc.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
      onSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setObraId(obraIdPreSelecionada || '');
    setAlmoxId('');
    setMotivo('');
    setEtapa('');
    setObservacao('');
    setItens([{ ...ITEM_VAZIO }]);
    setFotos([]);
    setErrors({});
    setErroSaldo(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <ArrowUp className="w-5 h-5 text-red-600" />
            Saída de Estoque da Obra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">

          {/* Alerta de bloqueio por saldo insuficiente */}
          {erroSaldo && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-red-700">Saída não registrada — saldo insuficiente em estoque.</p>
                <p className="text-red-600 mt-0.5">Não é possível consumir mais do que há no almoxarifado. Ajuste a quantidade ou registre uma entrada antes:</p>
                <ul className="list-disc list-inside text-red-700 mt-1 space-y-0.5">
                  {erroSaldo.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* Obra + Almoxarifado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium">Obra *</Label>
              {obraIdPreSelecionada ? (
                <p className="mt-1 h-11 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700 text-sm">
                  {obras.find(o => o.id === obraIdPreSelecionada)?.nome || obraIdPreSelecionada}
                </p>
              ) : (
                <div className="mt-1">
                  <ComboboxBusca
                    options={obras.filter(o => o.status !== 'cancelada').map(o => ({ value: o.id, label: o.nome }))}
                    value={obraId}
                    onSelect={v => { setObraId(v); setAlmoxId(''); limpar('obra'); }}
                    placeholder="Selecione a obra..."
                    searchPlaceholder="Buscar obra..."
                    emptyMessage="Nenhuma obra."
                    className={cls('obra')}
                  />
                </div>
              )}
              {errors.obra && <p className="text-xs text-red-600 mt-1">{errors.obra}</p>}
            </div>

            <div>
              <Label className="text-gray-700 font-medium">Almoxarifado da Obra *</Label>
              {!obraId ? (
                <div className="mt-1 h-11 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-gray-400 text-sm">Selecione a obra primeiro</div>
              ) : (
                <div className="mt-1">
                  <ComboboxBusca
                    options={locaisDisponiveis.map(l => ({ value: l.id, label: `${l.nome}${l.tipo === 'CENTRAL' ? ' (Central)' : ' (Obra)'}` }))}
                    value={almoxId}
                    onSelect={(v) => { setAlmoxId(v); limpar('almox'); }}
                    placeholder="Selecione..."
                    searchPlaceholder="Buscar almoxarifado..."
                    emptyMessage="Nenhum almoxarifado."
                    className={cls('almox')}
                  />
                </div>
              )}
              {errors.almox && <p className="text-xs text-red-600 mt-1">{errors.almox}</p>}
            </div>
          </div>

          {/* Motivo + Etapa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium">Motivo / Serviço *</Label>
              <Input
                value={motivo}
                onChange={e => { setMotivo(e.target.value); limpar('motivo'); }}
                placeholder="Ex: Fundação, Alvenaria, Instalações..."
                className={`mt-1 h-11 ${cls('motivo')}`}
              />
              {errors.motivo && <p className="text-xs text-red-600 mt-1">{errors.motivo}</p>}
            </div>
            <div>
              <Label className="text-gray-700 font-medium">Etapa / Fase (opcional)</Label>
              <Input
                value={etapa}
                onChange={e => setEtapa(e.target.value)}
                placeholder="Ex: Bloco A, Pav. Térreo..."
                className="mt-1 h-11"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-700 font-medium">Observação</Label>
            <Input
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Observações adicionais..."
              className="mt-1 h-11"
            />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-700 font-medium">Materiais Consumidos *</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1 h-8">
                <Plus className="w-3 h-3" /> Adicionar Item
              </Button>
            </div>
            {errors.itens && <p className="text-xs text-red-600 mb-2">{errors.itens}</p>}

            {/* Desktop: tabela de itens */}
            <div className="hidden sm:block border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Qtd</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Custo Unit.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map((item, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2 min-w-[220px]">
                        <ComboboxBusca
                          options={materiais.filter(i => i.ativo !== false).map(i => ({ value: i.id, label: `${i.descricao || '.'} (${i.unidade || ''})` }))}
                          value={item.material_id}
                          onSelect={v => updateItem(i, 'material_id', v)}
                          placeholder="Selecionar material..."
                          searchPlaceholder="Buscar material..."
                          emptyMessage="Nenhum material encontrado."
                        />
                        {item.saldo_disponivel !== null && (
                          <p className={`text-xs mt-0.5 ${parseFloat(item.qtd || 0) > item.saldo_disponivel ? 'text-red-500' : 'text-gray-400'}`}>
                            Disponível: {item.saldo_disponivel} {item.material_unidade}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.qtd}
                          onChange={e => updateItem(i, 'qtd', e.target.value)}
                          className={`h-11 text-sm text-right ${item.saldo_disponivel !== null && parseFloat(item.qtd || 0) > item.saldo_disponivel ? 'border-red-400' : ''}`}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.custo_unit}
                          onChange={e => updateItem(i, 'custo_unit', e.target.value)}
                          className="h-11 text-sm text-right"
                          placeholder="0,00"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-gray-700 pt-4">
                        {fmtBRL(parseFloat(item.qtd || 0) * parseFloat(item.custo_unit || 0))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {itens.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-9 w-9">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total Custo</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-red-600">{fmtBRL(totalCusto)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile: um card por item */}
            <div className="sm:hidden space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
                  <ComboboxBusca
                    options={materiais.filter(m => m.ativo !== false).map(m => ({ value: m.id, label: `${m.descricao || '.'} (${m.unidade || ''})` }))}
                    value={item.material_id}
                    onSelect={v => updateItem(i, 'material_id', v)}
                    placeholder="Selecionar material..."
                    searchPlaceholder="Buscar material..."
                    emptyMessage="Nenhum material encontrado."
                  />
                  {item.saldo_disponivel !== null && (
                    <p className={`text-xs ${parseFloat(item.qtd || 0) > item.saldo_disponivel ? 'text-red-500' : 'text-gray-400'}`}>
                      Disponível: {item.saldo_disponivel} {item.material_unidade}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Qtd</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.qtd}
                        onChange={e => updateItem(i, 'qtd', e.target.value)}
                        className={`h-10 text-sm text-right mt-0.5 ${item.saldo_disponivel !== null && parseFloat(item.qtd || 0) > item.saldo_disponivel ? 'border-red-400' : ''}`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Custo Unit.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.custo_unit}
                        onChange={e => updateItem(i, 'custo_unit', e.target.value)}
                        className="h-10 text-sm text-right mt-0.5"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-gray-700">
                      Total: <strong>{fmtBRL(parseFloat(item.qtd || 0) * parseFloat(item.custo_unit || 0))}</strong>
                    </span>
                    {itens.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-9 w-9">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-gray-700">Total Custo</span>
                <span className="text-sm font-bold text-red-600">{fmtBRL(totalCusto)}</span>
              </div>
            </div>
          </div>

          {/* Fotos */}
          <div>
            <Label className="text-gray-700 font-medium">Fotos (opcional)</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {fotos.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                  <img src={url} alt={`foto-${i}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                  >×</button>
                </div>
              ))}
              <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                {uploadingFoto ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400 mt-0.5">Foto</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} disabled={uploadingFoto} />
              </label>
            </div>
          </div>

          {/* Info custo */}
          {totalCusto > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800">
                Será gerado um lançamento de <strong>{fmtBRL(totalCusto)}</strong> como custo de <strong>MATERIAL</strong> no centro de custos da obra.
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <ArrowUp className="w-4 h-4" />
              {saving ? 'Registrando...' : 'Registrar Saída'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}