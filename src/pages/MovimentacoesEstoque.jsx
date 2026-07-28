import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { ArrowRight, ArrowDown, ArrowUp, Plus, Download, Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import DialogMovimentacaoEstoque from '../components/estoque/DialogMovimentacaoEstoque';
import RequireRole from '../components/auth/RequireRole';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const tipoBase = (t) => String(t || '').toUpperCase().replace(/_.*/, ''); // ENTRADA_COMPRA → ENTRADA

const TIPO_CFG = {
  ENTRADA: { label: 'Entrada', cls: 'bg-green-100 text-green-700', icon: ArrowDown },
  SAIDA: { label: 'Saída', cls: 'bg-red-100 text-red-700', icon: ArrowUp },
  TRANSFERENCIA: { label: 'Transferência', cls: 'bg-blue-100 text-blue-700', icon: ArrowRight },
};

// emModal: renderizado dentro de um Dialog (o título vem do DialogTitle).
export default function MovimentacoesEstoque({ emModal = false }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fLocal, setFLocal] = useState('');
  const [fObra, setFObra] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('obra_id')) setFObra(params.get('obra_id'));
    if (params.get('tipo') === 'saida') setFTipo('SAIDA');
  }, []);

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['movimentacoes-estoque-novo'],
    queryFn: () => base44.entities.EstoqueMovimentacao.list('-data_mov', 5000),
  });
  const { data: locais = [] } = useQuery({ queryKey: ['locais-mov'], queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras-mov'], queryFn: () => base44.entities.Obra.list('nome', 1000).catch(() => []) });

  const localMap = useMemo(() => Object.fromEntries(locais.map((l) => [l.id, l.nome])), [locais]);
  const obraMap = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra filtrada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obras.find((o) => o.id === fObra)?.empresa_id);
  const origemDe = (m) => m.origem_local_id || m.almox_origem_id || null;
  const destinoDe = (m) => m.destino_local_id || m.almox_destino_id || null;

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase();
    return movs.filter((m) => {
      const t = tipoBase(m.tipo);
      if (fTipo && t !== fTipo) return false;
      if (fLocal && origemDe(m) !== fLocal && destinoDe(m) !== fLocal) return false;
      if (fObra && m.obra_id !== fObra) return false;
      if (de && m.data_mov && m.data_mov < de) return false;
      if (ate && m.data_mov && m.data_mov > ate + 'T23:59:59') return false;
      if (q && !(m.material_nome?.toLowerCase().includes(q) || m.observacao?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [movs, busca, fTipo, fLocal, fObra, de, ate]);

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtradas, 20);
  const resetPagina = () => goToPage(1);

  const kpis = {
    total: filtradas.length,
    entradas: filtradas.filter((m) => tipoBase(m.tipo) === 'ENTRADA').length,
    saidas: filtradas.filter((m) => tipoBase(m.tipo) === 'SAIDA').length,
    transf: filtradas.filter((m) => tipoBase(m.tipo) === 'TRANSFERENCIA').length,
  };

  const localOptions = locais.map((l) => ({ value: l.id, label: l.nome }));
  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const temFiltro = busca || fTipo || fLocal || fObra || de || ate;
  const qtdFiltros = [busca, fTipo, fLocal, fObra, de, ate].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFTipo(''); setFLocal(''); setFObra(''); setDe(''); setAte(''); resetPagina(); };

  // Exporta EXCEL branded com exatamente o que está filtrado na tela.
  const exportarExcel = () => {
    if (filtradas.length === 0) return toast.error('Nenhum dado para exportar');
    try {
      exportarXLSXBranded(`movimentacoes_estoque_${new Date().toISOString().split('T')[0]}`, [{
        nome: 'Movimentações',
        titulo: 'Movimentações de Estoque',
        subtitulo: `${filtradas.length} movimentação(ões)` + (fObra ? ` · ${obraMap[fObra] || ''}` : ''),
        headers: ['Data', 'Tipo', 'Material', 'Qtd', 'Origem', 'Destino', 'Obra', 'Valor', 'Obs'],
        rows: filtradas.map((m) => [
          m.data_mov ? new Date(m.data_mov).toLocaleDateString('pt-BR') : '',
          TIPO_CFG[tipoBase(m.tipo)]?.label || m.tipo || '',
          m.material_nome || '',
          num(m.quantidade),
          localMap[origemDe(m)] || '-',
          localMap[destinoDe(m)] || '-',
          obraMap[m.obra_id] || '-',
          num(m.valor_total || m.valor_total_movimentacao),
          m.observacao || '',
        ]),
        moeda: [7],
      }], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <RequireRole allowedRoles={['admin', 'programador', 'admin_empresa', 'diretor', 'almoxarife', 'compras']}>
      <div className="space-y-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {!emModal && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Movimentações de Estoque</h1>
              <p className="text-sm text-gray-500 mt-1 hidden sm:block">Entradas, saídas e transferências (fonte única: EstoqueMovimentacao)</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportarExcel} className="gap-2 border-gray-300 text-gray-700 flex-1 sm:flex-none"><Download className="w-4 h-4" /> Exportar Excel</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"><Plus className="w-4 h-4" /> Nova Movimentação</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{kpis.total}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Total</p></Card>
          <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{kpis.entradas}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Entradas</p></Card>
          <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-red-600 tabular-nums">{kpis.saidas}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Saídas</p></Card>
          <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{kpis.transf}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Transferências</p></Card>
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
              <span className="text-xs text-gray-500">{filtradas.length} movimentação(ões)</span>
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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                  <div className="lg:col-span-2">
                    <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-9 h-11" placeholder="Material ou observação..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} /></div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Tipo</Label>
                    <ComboboxBusca
                      options={[{ value: 'ENTRADA', label: 'Entrada' }, { value: 'SAIDA', label: 'Saída' }, { value: 'TRANSFERENCIA', label: 'Transferência' }]}
                      value={fTipo}
                      onSelect={(v) => { setFTipo(v || ''); resetPagina(); }}
                      placeholder="Todos"
                      searchPlaceholder="Buscar tipo..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Local</Label>
                    <ComboboxBusca options={localOptions} value={fLocal} onSelect={(v) => { setFLocal(v); resetPagina(); }} placeholder="Todos" searchPlaceholder="Buscar local..." />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                    <ComboboxBusca options={obraOptions} value={fObra} onSelect={(v) => { setFObra(v); resetPagina(); }} placeholder="Todas" searchPlaceholder="Buscar obra..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2 lg:col-span-1 md:col-span-3">
                    <div><Label className="text-xs text-gray-600 mb-1 block">De</Label><Input type="date" value={de} onChange={(e) => { setDe(e.target.value); resetPagina(); }} className="h-11 text-xs" /></div>
                    <div><Label className="text-xs text-gray-600 mb-1 block">Até</Label><Input type="date" value={ate} onChange={(e) => { setAte(e.target.value); resetPagina(); }} className="h-11 text-xs" /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabela */}
        <Card className="bg-white border-gray-200">
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton bare rows={6} cols={8} />
            ) : filtradas.length === 0 ? (
              <p className="text-center py-12 text-gray-400">Nenhuma movimentação encontrada.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Tipo</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Material</th>
                        <th className="text-right p-3 font-semibold text-gray-600">Qtd</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Origem</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Destino</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                        <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pageItens.map((m) => {
                        const cfg = TIPO_CFG[tipoBase(m.tipo)] || { label: m.tipo, cls: 'bg-gray-100 text-gray-600' };
                        return (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="p-3 text-xs text-gray-500">{m.data_mov ? new Date(m.data_mov).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="p-3"><Badge className={`border-0 ${cfg.cls}`}>{cfg.label}</Badge></td>
                            <td className="p-3 font-medium text-gray-900">{m.material_nome || '—'} <span className="text-xs text-gray-400">{m.material_unidade}</span></td>
                            <td className="p-3 text-right font-semibold text-gray-800">{num(m.quantidade)}</td>
                            <td className="p-3 text-gray-600 text-xs">{localMap[origemDe(m)] || '—'}</td>
                            <td className="p-3 text-gray-600 text-xs">{localMap[destinoDe(m)] || '—'}</td>
                            <td className="p-3 text-gray-600 text-xs">{obraMap[m.obra_id] || '—'}</td>
                            <td className="p-3 text-right text-gray-700 text-xs">{(m.valor_total || m.valor_total_movimentacao) ? fmtBRL(m.valor_total || m.valor_total_movimentacao) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cards (mobile) */}
                <div className="md:hidden flex flex-col gap-y-2 p-2">
                  {pageItens.map((m) => {
                    const cfg = TIPO_CFG[tipoBase(m.tipo)] || { label: m.tipo, cls: 'bg-gray-100 text-gray-600' };
                    const valor = m.valor_total || m.valor_total_movimentacao;
                    return (
                      <div key={m.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 break-words">{m.material_nome || '—'} <span className="text-xs text-gray-400">{m.material_unidade}</span></p>
                            <p className="text-xs text-gray-400 mt-0.5">{m.data_mov ? new Date(m.data_mov).toLocaleDateString('pt-BR') : '—'}</p>
                          </div>
                          <Badge className={`border-0 shrink-0 ${cfg.cls}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 break-words">
                          {localMap[origemDe(m)] || '—'} <span className="text-gray-300">→</span> {localMap[destinoDe(m)] || '—'}
                          {obraMap[m.obra_id] ? <span className="text-gray-400"> · {obraMap[m.obra_id]}</span> : null}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm"><span className="text-gray-500">Qtd:</span> <span className="font-semibold text-gray-800">{num(m.quantidade)}</span></span>
                          <span className="text-xs text-gray-700 break-words">{valor ? fmtBRL(valor) : '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
              </>
            )}
          </CardContent>
        </Card>

        {dialogOpen && (
          <DialogMovimentacaoEstoque
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSuccess={() => { setDialogOpen(false); qc.invalidateQueries({ queryKey: ['movimentacoes-estoque-novo'] }); qc.invalidateQueries({ queryKey: ['saldos-estoque-calc'] }); }}
            locais={locais}
            almoxPreSelecionado={fLocal || null}
          />
        )}
      </div>
    </RequireRole>
  );
}
