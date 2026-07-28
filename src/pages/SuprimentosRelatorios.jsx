import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TableSkeleton } from '@/components/shared/Skeletons';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── KARDEX ───────────────────────────────────────────────
function KardexTab() {
  const [materialId, setMaterialId] = useState('');
  const [localId, setLocalId] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const { data: materiais = [] } = useQuery({ queryKey: ['materiais-rel'], queryFn: () => base44.entities.Material.list('nome', 5000).catch(() => []) });
  const { data: locais = [] } = useQuery({ queryKey: ['locais-rel'], queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []) });
  const { data: movs = [], isLoading } = useQuery({ queryKey: ['kardex-movs'], queryFn: () => base44.entities.EstoqueMovimentacao.list('-data_mov', 10000).catch(() => []) });

  const localMap = useMemo(() => Object.fromEntries(locais.map((l) => [l.id, l.nome])), [locais]);

  const extrato = useMemo(() => movs.filter((m) => {
    if (materialId && m.material_id !== materialId) return false;
    if (localId && m.origem_local_id !== localId && m.destino_local_id !== localId) return false;
    if (de && m.data_mov < de) return false;
    if (ate && m.data_mov > ate + 'T23:59:59') return false;
    return true;
  }), [movs, materialId, localId, de, ate]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(extrato, 20);
  const reset = () => goToPage(1);

  const TIPO_CLS = { ENTRADA: 'bg-green-100 text-green-700', SAIDA: 'bg-red-100 text-red-600', TRANSFERENCIA: 'bg-blue-100 text-blue-700', AJUSTE: 'bg-yellow-100 text-yellow-700' };
  const [showFiltros, setShowFiltros] = useState(false);
  const temFiltro = materialId || localId || de || ate;
  const qtdFiltros = [materialId, localId, de, ate].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowFiltros((v) => !v)} className="gap-2 h-10 border-gray-300 text-gray-700">
              <Filter className="w-4 h-4" /> Filtros
              {qtdFiltros > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 px-1.5">{qtdFiltros}</Badge>}
              {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <span className="text-xs text-gray-500">{extrato.length} registro(s)</span>
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={() => { setMaterialId(''); setLocalId(''); setDe(''); setAte(''); reset(); }} className="gap-1 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" /> Limpar filtros
            </Button>
          )}
        </div>

        {showFiltros && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Material</Label>
                  <ComboboxBusca options={materiais.map((m) => ({ value: m.id, label: `${m.nome} (${m.unidade})` }))} value={materialId} onSelect={(v) => { setMaterialId(v); reset(); }} placeholder="Todos" searchPlaceholder="Buscar material..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Local de Estoque</Label>
                  <ComboboxBusca options={locais.map((l) => ({ value: l.id, label: l.nome }))} value={localId} onSelect={(v) => { setLocalId(v); reset(); }} placeholder="Todos" searchPlaceholder="Buscar local..." />
                </div>
                <div><Label className="text-xs text-gray-600 mb-1 block">De</Label><Input type="date" value={de} onChange={(e) => { setDe(e.target.value); reset(); }} className="h-11" /></div>
                <div><Label className="text-xs text-gray-600 mb-1 block">Até</Label><Input type="date" value={ate} onChange={(e) => { setAte(e.target.value); reset(); }} className="h-11" /></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton bare rows={6} cols={7} /> : extrato.length === 0 ? (
            <p className="text-center py-10 text-gray-400">Nenhuma movimentação encontrada com os filtros selecionados.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Data/Hora</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Tipo</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Material</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Origem</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Destino</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Qtd</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Custo Unit.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="p-3 text-xs text-gray-500">{m.data_mov ? format(new Date(m.data_mov), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</td>
                        <td className="p-3"><Badge className={`border-0 ${TIPO_CLS[m.tipo] || 'bg-gray-100 text-gray-600'}`}>{m.tipo}</Badge></td>
                        <td className="p-3 font-medium text-gray-900">{m.material_nome || '—'}<span className="text-xs text-gray-400 ml-1">({m.material_unidade})</span></td>
                        <td className="p-3 text-xs text-gray-500">{m.origem_local_id ? (localMap[m.origem_local_id] || '—') : '—'}</td>
                        <td className="p-3 text-xs text-gray-500">{m.destino_local_id ? (localMap[m.destino_local_id] || '—') : '—'}</td>
                        <td className="p-3 text-right font-bold text-gray-800">{m.quantidade}</td>
                        <td className="p-3 text-right text-xs text-gray-400">{m.custo_unitario ? fmtBRL(m.custo_unitario) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {paginatedItems.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{m.material_nome || '—'} <span className="text-xs text-gray-400">({m.material_unidade})</span></p>
                        <p className="text-xs text-gray-400 mt-0.5">{m.data_mov ? format(new Date(m.data_mov), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</p>
                      </div>
                      <Badge className={`border-0 shrink-0 ${TIPO_CLS[m.tipo] || 'bg-gray-100 text-gray-600'}`}>{m.tipo}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 break-words">
                      {m.origem_local_id ? (localMap[m.origem_local_id] || '—') : '—'} <span className="text-gray-300">→</span> {m.destino_local_id ? (localMap[m.destino_local_id] || '—') : '—'}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-gray-800">Qtd: {m.quantidade}</span>
                      <span className="text-xs text-gray-400">{m.custo_unitario ? fmtBRL(m.custo_unitario) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PENDÊNCIAS DE RECEBIMENTO ─────────────────────────────
function PendenciasTab() {
  const [busca, setBusca] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const { data: pedidos = [], isLoading: loadP } = useQuery({ queryKey: ['pedidos-compra'], queryFn: () => base44.entities.PedidoCompra.list('-created_date', 1000) });
  const { data: pcItens = [], isLoading: loadI } = useQuery({ queryKey: ['pc-itens-all'], queryFn: () => base44.entities.PedidoCompraItem.list('pedido_id', 5000) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras-rel'], queryFn: () => base44.entities.Obra.list('nome', 1000).catch(() => []) });

  const reset = () => goToPage(1);

  const pendencias = useMemo(() => {
    const q = busca.toLowerCase();
    return pcItens
      .filter((i) => num(i.quantidade_pedida) > num(i.quantidade_recebida))
      .map((i) => {
        const p = pedidos.find((pc) => pc.id === i.pedido_id) || {};
        return { ...i, obra_id: p.obra_id, pedido_numero: p.numero, obra_nome: p.obra_nome, fornecedor_nome: p.fornecedor_nome, pedido_status: p.status, pendente: num(i.quantidade_pedida) - num(i.quantidade_recebida) };
      })
      .filter((i) => ['ENVIADO', 'PARCIAL'].includes(i.pedido_status))
      .filter((i) => !filtroObra || i.obra_id === filtroObra)
      .filter((i) => !q || i.material_nome?.toLowerCase().includes(q) || i.pedido_numero?.toLowerCase().includes(q) || i.fornecedor_nome?.toLowerCase().includes(q));
  }, [pedidos, pcItens, busca, filtroObra]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(pendencias, 20);
  const [showFiltros, setShowFiltros] = useState(false);
  const temFiltro = busca || filtroObra;
  const qtdFiltros = [busca, filtroObra].filter(Boolean).length;

  return (
    <div className="space-y-4">
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFiltros((v) => !v)} className="gap-2 h-10 border-gray-300 text-gray-700">
            <Filter className="w-4 h-4" /> Filtros
            {qtdFiltros > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 px-1.5">{qtdFiltros}</Badge>}
            {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <span className="text-xs text-gray-500">{pendencias.length} pendência(s)</span>
        </div>
        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => { setBusca(''); setFiltroObra(''); reset(); }} className="gap-1 text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" /> Limpar filtros
          </Button>
        )}
      </div>

      {showFiltros && (
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                <Input className="h-11" placeholder="Material, pedido ou fornecedor..." value={busca} onChange={(e) => { setBusca(e.target.value); reset(); }} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                <ComboboxBusca options={obras.map((o) => ({ value: o.id, label: o.nome }))} value={filtroObra} onSelect={(v) => { setFiltroObra(v); reset(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>

    <Card className="bg-white border-gray-200">
      <CardContent className="p-0">
        {(loadP || loadI) ? <TableSkeleton bare rows={6} cols={8} /> : pendencias.length === 0 ? (
          <p className="text-center py-10 text-gray-400">Nenhuma pendência de recebimento.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-600">Pedido</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Fornecedor</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Material</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Pedido</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Recebido</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Pendente</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedItems.map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs text-gray-400">{i.pedido_numero || '—'}</td>
                      <td className="p-3 font-medium text-gray-900">{i.obra_nome || '—'}</td>
                      <td className="p-3 text-gray-500">{i.fornecedor_nome || '—'}</td>
                      <td className="p-3 text-gray-700">{i.material_nome} <span className="text-xs text-gray-400">({i.material_unidade})</span></td>
                      <td className="p-3 text-right text-gray-600">{i.quantidade_pedida}</td>
                      <td className="p-3 text-right text-green-600">{i.quantidade_recebida || 0}</td>
                      <td className="p-3 text-right font-bold text-orange-600">{i.pendente.toFixed(3)}</td>
                      <td className="p-3"><Badge className={`border-0 ${i.pedido_status === 'PARCIAL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{i.pedido_status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cards (mobile) */}
            <div className="md:hidden flex flex-col gap-y-2 p-2">
              {paginatedItems.map((i) => (
                <div key={i.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">{i.obra_nome || '—'}</p>
                      <p className="text-xs text-gray-500 break-words">{i.fornecedor_nome || '—'}</p>
                      <p className="font-mono text-xs text-gray-400 mt-0.5 break-words">{i.pedido_numero || '—'}</p>
                    </div>
                    <Badge className={`border-0 shrink-0 ${i.pedido_status === 'PARCIAL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{i.pedido_status}</Badge>
                  </div>
                  <p className="text-sm text-gray-700 break-words">{i.material_nome} <span className="text-xs text-gray-400">({i.material_unidade})</span></p>
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs">
                    <span className="text-gray-500">Pedido: <span className="text-gray-700 font-medium">{i.quantidade_pedida}</span></span>
                    <span className="text-gray-500">Recebido: <span className="text-green-600 font-medium">{i.quantidade_recebida || 0}</span></span>
                    <span className="text-gray-500">Pendente: <span className="font-bold text-orange-600">{i.pendente.toFixed(3)}</span></span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

// ─── CONSUMO POR OBRA ──────────────────────────────────────
function ConsumoObraTab() {
  const [obraId, setObraId] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const { data: obras = [] } = useQuery({ queryKey: ['obras-rel'], queryFn: () => base44.entities.Obra.list('nome', 1000).catch(() => []) });
  const { data: movs = [], isLoading } = useQuery({ queryKey: ['movs-saida'], queryFn: () => base44.entities.EstoqueMovimentacao.list('-data_mov', 10000).catch(() => []) });

  // Custo médio por material (das ENTRADAs com custo) — usado como fallback
  // quando a SAÍDA não gravou custo_unitario.
  const custoMedio = useMemo(() => {
    const soma = {}; const qtd = {};
    for (const m of movs) {
      if (String(m.tipo).toUpperCase() === 'ENTRADA' && num(m.custo_unitario) > 0) {
        soma[m.material_id] = (soma[m.material_id] || 0) + num(m.quantidade) * num(m.custo_unitario);
        qtd[m.material_id] = (qtd[m.material_id] || 0) + num(m.quantidade);
      }
    }
    const r = {};
    for (const k of Object.keys(soma)) r[k] = qtd[k] ? soma[k] / qtd[k] : 0;
    return r;
  }, [movs]);

  const saidas = useMemo(() => {
    const filtered = movs.filter((m) => {
      if (String(m.tipo).toUpperCase() !== 'SAIDA') return false;
      if (obraId && m.obra_id !== obraId) return false;
      if (de && m.data_mov < de) return false;
      if (ate && m.data_mov > ate + 'T23:59:59') return false;
      return true;
    });
    const grouped = {};
    for (const m of filtered) {
      const k = m.material_id;
      if (!grouped[k]) grouped[k] = { material_nome: m.material_nome, material_unidade: m.material_unidade, total_qtd: 0, total_valor: 0 };
      const custo = num(m.custo_unitario) || num(custoMedio[m.material_id]);
      grouped[k].total_qtd += num(m.quantidade);
      grouped[k].total_valor += num(m.quantidade) * custo;
    }
    return Object.values(grouped).sort((a, b) => b.total_valor - a.total_valor);
  }, [movs, obraId, de, ate, custoMedio]);

  const totalValor = saidas.reduce((acc, s) => acc + s.total_valor, 0);
  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(saidas, 20);
  const reset = () => goToPage(1);
  const [showFiltros, setShowFiltros] = useState(false);
  const temFiltro = obraId || de || ate;
  const qtdFiltros = [obraId, de, ate].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowFiltros((v) => !v)} className="gap-2 h-10 border-gray-300 text-gray-700">
              <Filter className="w-4 h-4" /> Filtros
              {qtdFiltros > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 px-1.5">{qtdFiltros}</Badge>}
              {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <span className="text-xs text-gray-500">{saidas.length} material(is)</span>
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={() => { setObraId(''); setDe(''); setAte(''); reset(); }} className="gap-1 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" /> Limpar filtros
            </Button>
          )}
        </div>

        {showFiltros && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                  <ComboboxBusca options={obras.map((o) => ({ value: o.id, label: o.nome }))} value={obraId} onSelect={(v) => { setObraId(v); reset(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
                </div>
                <div><Label className="text-xs text-gray-600 mb-1 block">De</Label><Input type="date" value={de} onChange={(e) => { setDe(e.target.value); reset(); }} className="h-11" /></div>
                <div><Label className="text-xs text-gray-600 mb-1 block">Até</Label><Input type="date" value={ate} onChange={(e) => { setAte(e.target.value); reset(); }} className="h-11" /></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {saidas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="bg-white border-gray-200 p-3 flex flex-col">
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{saidas.length}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold leading-tight mt-1">Materiais consumidos</p>
          </Card>
          <Card className="bg-white border-gray-200 p-3 flex flex-col">
            <p className="text-lg sm:text-xl font-bold text-red-600 tabular-nums break-words leading-tight">{fmtBRL(totalValor)}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold leading-tight mt-1">Valor Total Consumido</p>
          </Card>
        </div>
      )}

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton bare rows={6} cols={4} /> : saidas.length === 0 ? (
            <p className="text-center py-10 text-gray-400">Nenhuma saída encontrada com os filtros aplicados.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Material</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Unidade</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Qtd Total</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{s.material_nome || '—'}</td>
                        <td className="p-3 text-gray-500">{s.material_unidade}</td>
                        <td className="p-3 text-right font-bold text-gray-700">{s.total_qtd.toFixed(3)}</td>
                        <td className="p-3 text-right text-red-600 font-semibold tabular-nums">{s.total_valor ? fmtBRL(s.total_valor) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {paginatedItems.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">{s.material_nome || '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.material_unidade} · Qtd: {s.total_qtd.toFixed(3)}</p>
                    </div>
                    <span className="text-red-600 font-semibold tabular-nums break-words shrink-0 text-right">{s.total_valor ? fmtBRL(s.total_valor) : '—'}</span>
                  </div>
                ))}
              </div>

              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function SuprimentosRelatorios() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios de Suprimentos</h1>
        <p className="text-sm text-gray-500">Kardex, pendências e consumo por obra</p>
      </div>

      <Tabs defaultValue="kardex">
        <TabsList className="flex w-full overflow-x-auto justify-start md:w-fit md:mx-auto gap-1 rounded-lg bg-gray-100 p-1 h-auto">
          {[['kardex', 'Kardex (Extrato)'], ['pendencias', 'Pendências de Recebimento'], ['consumo', 'Consumo por Obra']].map(([v, label]) => (
            <TabsTrigger key={v} value={v} className="shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">{label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="kardex" className="mt-4"><KardexTab /></TabsContent>
        <TabsContent value="pendencias" className="mt-4"><PendenciasTab /></TabsContent>
        <TabsContent value="consumo" className="mt-4"><ConsumoObraTab /></TabsContent>
      </Tabs>
    </div>
  );
}
