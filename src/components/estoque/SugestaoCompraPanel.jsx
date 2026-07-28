import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ShoppingCart, Loader2, RefreshCw, AlertTriangle,
  FileText, Send, Check, PackageSearch, Zap
} from 'lucide-react';
import { format } from 'date-fns';
import SugestaoCompraItensTable from './SugestaoCompraItensTable';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusCfg = {
  gerada: { label: 'Gerada', cls: 'bg-blue-100 text-blue-700' },
  parcial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700' },
  convertida: { label: 'Convertida', cls: 'bg-green-100 text-green-700' },
  descartada: { label: 'Descartada', cls: 'bg-gray-100 text-gray-500' },
};

export default function SugestaoCompraPanel() {
  const queryClient = useQueryClient();
  const [selectedAlmox, setSelectedAlmox] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showConverter, setShowConverter] = useState(null);
  const [infoGeracao, setInfoGeracao] = useState(null);

  const { data: locais = [] } = useQuery({
    queryKey: ['local-estoque-sugestao'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
    staleTime: 60000
  });

  const { data: sugestoes = [], isLoading: loadSug } = useQuery({
    queryKey: ['sugestoes-compra'],
    queryFn: () => base44.entities.SugestaoCompra.list('-created_date', 100),
    staleTime: 30000
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-sugestao'],
    queryFn: () => base44.entities.Obra.list('-created_date', 500),
    staleTime: 60000
  });

  // Lista todos os almoxarifados ativos (central primeiro). A sugestão funciona
  // para qualquer local — nem todo cliente opera com almoxarifado central.
  const locaisDisponiveis = [...locais.filter(l => l.ativo !== false)]
    .sort((a, b) => (b.tipo === 'CENTRAL' ? 1 : 0) - (a.tipo === 'CENTRAL' ? 1 : 0));

  // Gerar sugestão
  const gerarMutation = useMutation({
    mutationFn: (almoxId) => base44.functions.invoke('gerarSugestaoCompraAutomatica', {
      almoxarifado_id: almoxId
    }),
    onSuccess: (res) => {
      const data = res.data;
      if (data?.success) {
        toast.success(data.message);
        // Quando não há itens a sugerir, fixa a mensagem na tela (o toast some rápido).
        setInfoGeracao(data.qtd_itens > 0 ? null : (data.message || 'Nenhum item precisa de reposição.'));
        queryClient.invalidateQueries({ queryKey: ['sugestoes-compra'] });
      } else {
        setInfoGeracao(null);
        toast.error(data?.error || 'Erro ao gerar sugestão');
      }
    },
    onError: (err) => { setInfoGeracao(null); toast.error('Erro: ' + (err?.message || 'Falha ao gerar')); }
  });

  const handleGerar = () => {
    if (!selectedAlmox) {
      toast.error('Selecione um almoxarifado');
      return;
    }
    gerarMutation.mutate(selectedAlmox);
  };

  // Descarte
  const descartarMutation = useMutation({
    mutationFn: (id) => base44.entities.SugestaoCompra.update(id, { status: 'descartada' }),
    onSuccess: () => {
      toast.success('Sugestão descartada');
      queryClient.invalidateQueries({ queryKey: ['sugestoes-compra'] });
    }
  });

  const sugestoesAtivas = sugestoes.filter(s => s.status === 'gerada' || s.status === 'parcial');
  const sugestoesHistorico = sugestoes.filter(s => s.status === 'convertida' || s.status === 'descartada');

  return (
    <div className="space-y-4">
      {/* Gerador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Gerar Sugestão de Compra Automática
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Analisa saldos, consumo médio, lead time e ponto de reposição para sugerir itens que precisam ser comprados.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap sm:items-end">
            <div className="w-full sm:flex-1 sm:min-w-[200px]">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Almoxarifado</label>
              <ComboboxBusca
                options={locaisDisponiveis.map(l => ({ value: l.id, label: `${l.nome}${l.tipo === 'CENTRAL' ? ' (Central)' : ' (Obra)'}` }))}
                value={selectedAlmox}
                onSelect={(v) => { setSelectedAlmox(v); setInfoGeracao(null); }}
                placeholder="Selecionar almoxarifado..."
                searchPlaceholder="Buscar almoxarifado..."
                emptyMessage="Nenhum almoxarifado ativo."
              />
            </div>
            <Button
              onClick={handleGerar}
              disabled={gerarMutation.isPending || !selectedAlmox}
              className="gap-2 bg-blue-600 hover:bg-blue-700 h-9 w-full sm:w-auto"
            >
              {gerarMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Gerar Sugestão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sugestões Ativas */}
      {loadSug ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
      ) : sugestoesAtivas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <PackageSearch className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">{infoGeracao || 'Nenhuma sugestão ativa. Gere uma análise acima.'}</p>
            {infoGeracao && (
              <p className="text-xs text-gray-400 mt-2">
                Defina o mínimo e o ponto de reposição em <strong>Estoque → Políticas de Estoque</strong> para gerar sugestões.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        sugestoesAtivas.map(sug => (
          <SugestaoCard
            key={sug.id}
            sugestao={sug}
            isExpanded={expandedId === sug.id}
            onToggle={() => setExpandedId(expandedId === sug.id ? null : sug.id)}
            onConverter={() => setShowConverter(sug)}
            onDescartar={() => descartarMutation.mutate(sug.id)}
          />
        ))
      )}

      {/* Histórico */}
      {sugestoesHistorico.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Histórico de Sugestões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sugestoesHistorico.slice(0, 10).map(sug => {
                const st = statusCfg[sug.status] || statusCfg.gerada;
                return (
                  <div key={sug.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center flex-wrap gap-2 sm:gap-3 min-w-0">
                      <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
                      <span className="text-sm break-words">{sug.almoxarifado_nome || 'Almoxarifado'}</span>
                      <span className="text-xs text-gray-400">{sug.qtd_itens} itens · {fmt(sug.valor_total_estimado)}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {sug.gerado_em ? format(new Date(sug.gerado_em), 'dd/MM/yy HH:mm') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Converter */}
      {showConverter && (
        <ConverterDialog
          sugestao={showConverter}
          obras={obras}
          onClose={() => setShowConverter(null)}
          onSuccess={() => {
            setShowConverter(null);
            queryClient.invalidateQueries({ queryKey: ['sugestoes-compra'] });
          }}
        />
      )}
    </div>
  );
}

function SugestaoCard({ sugestao, isExpanded, onToggle, onConverter, onDescartar }) {
  const st = statusCfg[sugestao.status] || statusCfg.gerada;
  const itens = sugestao.itens || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-sm">{sugestao.almoxarifado_nome || 'Almoxarifado'}</p>
              <p className="text-xs text-gray-400">
                {sugestao.gerado_em ? format(new Date(sugestao.gerado_em), 'dd/MM/yy HH:mm') : '—'}
                {' · '}{sugestao.gerado_por || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
            <Badge variant="outline" className="text-xs">{itens.length} itens</Badge>
            <Badge variant="outline" className="text-xs font-semibold">{fmt(sugestao.valor_total_estimado)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="outline" size="sm" onClick={onToggle} className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            {isExpanded ? 'Ocultar Itens' : 'Ver Itens'}
          </Button>
          <Button size="sm" onClick={onConverter} className="gap-1.5 text-xs bg-green-600 hover:bg-green-700">
            <Send className="w-3.5 h-3.5" />
            Converter em Compra
          </Button>
          <Button variant="ghost" size="sm" onClick={onDescartar} className="gap-1.5 text-xs text-red-500 hover:text-red-700">
            Descartar
          </Button>
        </div>

        {isExpanded && <SugestaoCompraItensTable itens={itens} />}
      </CardContent>
    </Card>
  );
}

function ConverterDialog({ sugestao, obras, onClose, onSuccess }) {
  const [tipo, setTipo] = useState('solicitacao_compra');
  const [obraId, setObraId] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState(
    () => (sugestao.itens || []).filter(i => i.selecionado !== false).map(i => i.material_id)
  );
  const [loading, setLoading] = useState(false);

  const itens = sugestao.itens || [];

  const toggleItem = (materialId) => {
    setSelectedMaterials(prev =>
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const toggleAll = () => {
    if (selectedMaterials.length === itens.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(itens.map(i => i.material_id));
    }
  };

  const obraSel = obras.find(o => o.id === obraId);
  const valorSelecionado = itens
    .filter(i => selectedMaterials.includes(i.material_id))
    .reduce((s, i) => s + (i.valor_estimado || 0), 0);

  const handleConverter = async () => {
    if (selectedMaterials.length === 0) {
      toast.error('Selecione ao menos um item');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('converterSugestaoCompra', {
        sugestao_id: sugestao.id,
        tipo,
        obra_id: obraId,
        obra_nome: obraSel?.nome || '',
        itens_selecionados: selectedMaterials
      });
      if (res.data?.success) {
        toast.success(res.data.message);
        onSuccess();
      } else {
        toast.error(res.data?.error || 'Erro na conversão');
      }
    } catch (err) {
      toast.error('Erro: ' + (err?.message || 'Falha'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            Converter Sugestão em Compra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo de Documento</label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solicitacao_compra">Solicitação de Compra (SC)</SelectItem>
                <SelectItem value="ordem_compra">Pré-Aprovada para OC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Obra */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Obra Destino (opcional)</label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Sem obra (estoque central)</SelectItem>
                {obras.filter(o => o.status !== 'cancelada' && o.status !== 'concluida').map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">
                Itens ({selectedMaterials.length} de {itens.length} selecionados)
              </label>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                {selectedMaterials.length === itens.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>
            <div className="border rounded-lg overflow-y-auto max-h-[300px]">
              {/* Desktop: tabela */}
              <div className="hidden md:block">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b">
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 text-left font-semibold">Material</th>
                      <th className="px-2 py-2 text-right font-semibold">Qtd Sugerida</th>
                      <th className="px-2 py-2 text-right font-semibold">Valor Est.</th>
                      <th className="px-2 py-2 text-left font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(item => (
                      <tr
                        key={item.material_id}
                        className={`border-b hover:bg-gray-50 ${!selectedMaterials.includes(item.material_id) ? 'opacity-40' : ''}`}
                      >
                        <td className="px-2 py-2">
                          <Checkbox
                            checked={selectedMaterials.includes(item.material_id)}
                            onCheckedChange={() => toggleItem(item.material_id)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <p className="font-medium">{item.material_nome}</p>
                          <p className="text-gray-400">{item.unidade}</p>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">
                          {(item.sugerido || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-2 text-right">{fmt(item.valor_estimado)}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className="text-[10px]">{item.motivo}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile: cards */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {itens.map(item => {
                  const checked = selectedMaterials.includes(item.material_id);
                  return (
                    <div
                      key={item.material_id}
                      className={`p-3 rounded-lg border border-gray-200 ${!checked ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleItem(item.material_id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm break-words">{item.material_nome}</p>
                          <p className="text-xs text-gray-400">{item.unidade}</p>
                          <div className="flex items-end justify-between gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px]">{item.motivo}</Badge>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold tabular-nums">
                                {(item.sugerido || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {item.unidade}
                              </p>
                              <p className="text-xs text-gray-500 tabular-nums">{fmt(item.valor_estimado)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              Valor selecionado: <strong>{fmt(valorSelecionado)}</strong>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
          <Button
            onClick={handleConverter}
            disabled={loading || selectedMaterials.length === 0}
            className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {tipo === 'solicitacao_compra' ? 'Criar Solicitação' : 'Criar SC Pré-Aprovada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}