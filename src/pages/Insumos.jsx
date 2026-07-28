import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit2, Eye, Trash2, Building2, Filter, ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { PageSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';
import ImportadorPrecosInsumos from '@/components/insumos/ImportadorPrecosInsumos';
import InsumoModal from '@/components/insumos/InsumoModal';

const POR_PAGINA = 12;

const unidadeLabels = {
  m: 'Metro', m2: 'Metro Quadrado', m3: 'Metro Cúbico', un: 'Unidade', kg: 'Quilograma',
  l: 'Litro', sc: 'Saco', cx: 'Caixa', h: 'Hora', dia: 'Dia', mes: 'Mês', t: 'Tonelada', vb: 'Viagem',
};
const grupoLabels = { material: 'Material', mao_obra: 'Mão de Obra', equipamento: 'Equipamento', servico: 'Serviço', outros: 'Outros' };
const baseLabels = { sinapi: 'SINAPI', propria: 'Base Própria', fornecedor: 'Fornecedor' };

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InsumosList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterBase, setFilterBase] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const [selectedInsumo, setSelectedInsumo] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [formModal, setFormModal] = useState({ open: false, insumo: null });
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: insumos = [], isLoading } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list('-created_date', 5000),
  });
  const { data: demandas = [], isLoading: isLoadingDemandas } = useQuery({
    queryKey: ['demandas-estoque'],
    queryFn: () => base44.entities.DemandaEstoqueObra.list().catch(() => []),
    staleTime: Infinity,
  });
  const { data: obras = [], isLoading: isLoadingObras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list().catch(() => []),
    staleTime: Infinity,
  });

  const { mutate: deleteInsumo } = useMutation({
    mutationFn: (id) => base44.entities.Insumo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast.success('Insumo deletado com sucesso');
    },
    onError: () => toast.error('Erro ao deletar insumo'),
  });

  const obrasById = useMemo(() => obras.reduce((acc, o) => { acc[o.id] = o; return acc; }, {}), [obras]);

  const insumoUsageMap = useMemo(() => {
    const map = {};
    for (const d of demandas) {
      const obra = obrasById[d.obra_id];
      if (!obra) continue;
      (map[d.insumo_id] = map[d.insumo_id] || []).push({
        obraId: obra.id, obraNome: obra.nome,
        quantidade: d.quantidade_prevista || 0, quantidadeRecebida: d.quantidade_recebida || 0,
        quantidadeConsumida: d.quantidade_consumida || 0, unidade: d.unidade,
      });
    }
    return map;
  }, [demandas, obrasById]);

  const filteredInsumos = useMemo(() => insumos.filter((insumo) => {
    const termo = searchTerm.toLowerCase();
    const matchSearch = !termo
      || (insumo.descricao || '').toLowerCase().includes(termo)
      || (insumo.codigo || '').toLowerCase().includes(termo);
    const matchGrupo = !filterGrupo || insumo.grupo === filterGrupo;
    const matchBase = !filterBase || insumo.base === filterBase;
    const matchStatus = !filterStatus || (filterStatus === 'ativo' ? insumo.ativo : !insumo.ativo);
    return matchSearch && matchGrupo && matchBase && matchStatus;
  }), [insumos, searchTerm, filterGrupo, filterBase, filterStatus]);

  // Volta p/ a 1ª página sempre que um filtro muda.
  useEffect(() => { setPagina(1); }, [searchTerm, filterGrupo, filterBase, filterStatus]);

  const totalPaginas = Math.max(1, Math.ceil(filteredInsumos.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const startIndex = (pagAtual - 1) * POR_PAGINA;
  const endIndex = Math.min(startIndex + POR_PAGINA, filteredInsumos.length);
  const pageInsumos = filteredInsumos.slice(startIndex, endIndex);

  const temFiltro = searchTerm || filterGrupo || filterBase || filterStatus;
  const qtdFiltros = [searchTerm, filterGrupo, filterBase, filterStatus].filter(Boolean).length;
  const limpar = () => { setSearchTerm(''); setFilterGrupo(''); setFilterBase(''); setFilterStatus(''); };

  const handleDelete = async (id) => {
    if (await confirmar({ titulo: 'Excluir insumo', descricao: 'Tem certeza que deseja deletar este insumo?', destrutivo: true })) {
      deleteInsumo(id);
    }
  };
  const verDetalhe = (insumo, usage) => {
    setSelectedInsumo(usage ? { ...insumo, usageDetails: usage } : insumo);
    setShowDetailModal(true);
  };

  if (isLoading || isLoadingDemandas || isLoadingObras) {
    return <PageSkeleton kpis={4} rows={6} cols={9} />;
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insumos</h1>
          <p className="text-gray-500 text-sm mt-1">Base mestre de custos da sua empresa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportadorPrecosInsumos />
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setFormModal({ open: true, insumo: null })}>
            <Plus className="w-4 h-4" /> Novo Insumo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-sm font-medium">Total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{insumos.length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-sm font-medium">Ativos</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{insumos.filter((i) => i.ativo).length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-sm font-medium">Inativos</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600">{insumos.filter((i) => !i.ativo).length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-sm font-medium">Valor Total</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 break-words">{fmtBRL(insumos.reduce((acc, i) => acc + (i.preco_unitario || 0), 0))}</p>
        </CardContent></Card>
      </div>

      {/* Filtros (colapsáveis) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowFiltros((v) => !v)} className="gap-2 h-10 border-gray-300 text-gray-700">
              <Filter className="w-4 h-4" /> Filtros
              {qtdFiltros > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 px-1.5">{qtdFiltros}</Badge>}
              {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <span className="text-xs text-gray-500">{filteredInsumos.length} insumo(s)</span>
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={limpar} className="gap-1 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" /> Limpar filtros
            </Button>
          )}
        </div>

        {showFiltros && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Código ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-11" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Grupo</label>
                  <ComboboxBusca
                    options={Object.entries(grupoLabels).map(([value, label]) => ({ value, label }))}
                    value={filterGrupo}
                    onSelect={(v) => setFilterGrupo(v || '')}
                    placeholder="Todos"
                    searchPlaceholder="Buscar grupo..."
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Base</label>
                  <ComboboxBusca
                    options={Object.entries(baseLabels).map(([value, label]) => ({ value, label }))}
                    value={filterBase}
                    onSelect={(v) => setFilterBase(v || '')}
                    placeholder="Todos"
                    searchPlaceholder="Buscar base..."
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Status</label>
                  <ComboboxBusca
                    options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]}
                    value={filterStatus}
                    onSelect={(v) => setFilterStatus(v || '')}
                    placeholder="Todos"
                    searchPlaceholder="Buscar status..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Código</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Descrição</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Unid.</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Grupo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Base</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Custo Unit.</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Obras Utilizando</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageInsumos.length === 0 ? (
                  <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-400">Nenhum insumo encontrado</td></tr>
                ) : (
                  pageInsumos.map((insumo) => {
                    const usage = insumoUsageMap[insumo.id] || [];
                    const obrasCount = usage.length;
                    const obrasPreview = usage.slice(0, 2).map((u) => u.obraNome).join(', ');
                    const additionalObras = obrasCount > 2 ? ` +${obrasCount - 2}` : '';
                    return (
                      <tr key={insumo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{insumo.codigo || '—'}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{insumo.descricao}</td>
                        <td className="px-4 py-3 text-gray-600">{unidadeLabels[insumo.unidade] || insumo.unidade || '—'}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="border-gray-300 text-gray-600">{grupoLabels[insumo.grupo] || insumo.grupo || '—'}</Badge></td>
                        <td className="px-4 py-3"><Badge variant="secondary">{baseLabels[insumo.base] || insumo.base || '—'}</Badge></td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtBRL(insumo.preco_unitario)}</td>
                        <td className="px-4 py-3">
                          {obrasCount > 0 ? (
                            <Button variant="ghost" size="sm" onClick={() => verDetalhe(insumo, usage)} className="flex items-center gap-1 hover:bg-blue-50">
                              <Building2 className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-600 font-medium">{obrasCount} obra{obrasCount > 1 ? 's' : ''}</span>
                              {obrasPreview && <span className="ml-1 text-xs text-gray-500">({obrasPreview}{additionalObras})</span>}
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Disponível para uso</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={insumo.ativo ? 'bg-green-100 text-green-800 border-0' : 'bg-gray-100 text-gray-600 border-0'}>{insumo.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => verDetalhe(insumo)} title="Ver detalhes"><Eye className="w-4 h-4 text-blue-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setFormModal({ open: true, insumo })} title="Editar"><Edit2 className="w-4 h-4 text-amber-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(insumo.id)} title="Deletar"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden flex flex-col gap-y-2 p-2">
            {pageInsumos.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">Nenhum insumo encontrado</div>
            ) : (
              pageInsumos.map((insumo) => {
                const usage = insumoUsageMap[insumo.id] || [];
                const obrasCount = usage.length;
                const obrasPreview = usage.slice(0, 2).map((u) => u.obraNome).join(', ');
                const additionalObras = obrasCount > 2 ? ` +${obrasCount - 2}` : '';
                return (
                  <div key={insumo.id} className="p-3 space-y-2 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{insumo.descricao}</p>
                        <p className="font-mono text-xs text-gray-500 mt-0.5">{insumo.codigo || '—'}</p>
                      </div>
                      <Badge className={`shrink-0 border-0 ${insumo.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{insumo.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="border-gray-300 text-gray-600">{grupoLabels[insumo.grupo] || insumo.grupo || '—'}</Badge>
                      <Badge variant="secondary">{baseLabels[insumo.base] || insumo.base || '—'}</Badge>
                      <span className="text-xs text-gray-500">{unidadeLabels[insumo.unidade] || insumo.unidade || '—'}</span>
                    </div>
                    {obrasCount > 0 ? (
                      <button onClick={() => verDetalhe(insumo, usage)} className="flex items-center gap-1 text-xs text-blue-600 font-medium text-left">
                        <Building2 className="w-3.5 h-3.5 shrink-0" /> {obrasCount} obra{obrasCount > 1 ? 's' : ''}
                        {obrasPreview && <span className="text-gray-500 font-normal break-words">({obrasPreview}{additionalObras})</span>}
                      </button>
                    ) : (
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Disponível para uso</Badge>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-base font-semibold text-gray-900 tabular-nums break-words">{fmtBRL(insumo.preco_unitario)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => verDetalhe(insumo)} title="Ver detalhes"><Eye className="w-4 h-4 text-blue-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setFormModal({ open: true, insumo })} title="Editar"><Edit2 className="w-4 h-4 text-amber-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(insumo.id)} title="Deletar"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Pagination currentPage={pagAtual} totalPages={totalPaginas} onPageChange={setPagina} startIndex={startIndex} endIndex={endIndex} totalItems={filteredInsumos.length} />
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader><DialogTitle>Detalhes do Insumo</DialogTitle></DialogHeader>
          {selectedInsumo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div><label className="text-sm font-semibold text-gray-700">Código</label><p className="text-gray-900">{selectedInsumo.codigo || '—'}</p></div>
              <div><label className="text-sm font-semibold text-gray-700">Descrição</label><p className="text-gray-900">{selectedInsumo.descricao}</p></div>
              <div><label className="text-sm font-semibold text-gray-700">Grupo</label><p className="text-gray-900">{grupoLabels[selectedInsumo.grupo] || '—'}</p></div>
              <div><label className="text-sm font-semibold text-gray-700">Base</label><p className="text-gray-900">{baseLabels[selectedInsumo.base] || '—'}</p></div>
              <div><label className="text-sm font-semibold text-gray-700">Unidade</label><p className="text-gray-900">{unidadeLabels[selectedInsumo.unidade] || '—'}</p></div>
              <div><label className="text-sm font-semibold text-gray-700">Custo Unitário</label><p className="text-gray-900">{fmtBRL(selectedInsumo.preco_unitario)}</p></div>

              {selectedInsumo.usageDetails?.length > 0 && (
                <div className="sm:col-span-2 mt-2">
                  <label className="text-sm font-semibold text-gray-700 mb-3 block"><Building2 className="w-4 h-4 inline mr-1" /> Obras Utilizando Este Insumo ({selectedInsumo.usageDetails.length})</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedInsumo.usageDetails.map((usage, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{usage.obraNome}</p>
                          <div className="flex gap-4 mt-1 text-xs text-gray-600">
                            <span>Previsto: {usage.quantidade} {usage.unidade}</span>
                            {usage.quantidadeRecebida > 0 && <span className="text-green-600">Recebido: {usage.quantidadeRecebida}</span>}
                            {usage.quantidadeConsumida > 0 && <span className="text-amber-600">Consumido: {usage.quantidadeConsumida}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInsumo.observacoes && (
                <div className="sm:col-span-2"><label className="text-sm font-semibold text-gray-700">Observações</label><p className="text-gray-900">{selectedInsumo.observacoes}</p></div>
              )}
              {selectedInsumo.historico_precos?.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Histórico de Preços</label>
                  <div className="mt-2 space-y-1">
                    {selectedInsumo.historico_precos.map((h, i) => (
                      <div key={i} className="text-sm text-gray-600">{fmtBRL(h.preco)} — {h.data} ({h.usuario})</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de cadastro/edição */}
      <InsumoModal open={formModal.open} onClose={() => setFormModal({ open: false, insumo: null })} insumo={formModal.insumo} />
    </div>
  );
}
