import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { Warehouse, Package, ArrowLeftRight, ArrowUp, Search } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import DialogMovimentacaoEstoque from '../components/estoque/DialogMovimentacaoEstoque';
import DialogSaidaEstoqueObra from '../components/estoque/DialogSaidaEstoqueObra';

const POR_PAGINA = 20;
const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');
const fmtBRL = (n) => `R$ ${fmtNum(Number(n) || 0)}`;

// Nível do almoxarifado (3 valores: Central / Empresa / Obra).
const nivelDe = (l) => l?.nivel || l?.tipo || null;
const NIVEL_SUFIXO = { CENTRAL: ' (Central)', EMPRESA: ' (Empresa)', OBRA: ' (Obra)' };
const NIVEL_CURTO = { CENTRAL: 'Central', EMPRESA: 'Empresa', OBRA: 'Obra' };
const NIVEL_ALMOX = { CENTRAL: 'Almoxarifado Central', EMPRESA: 'Almoxarifado da Empresa', OBRA: 'Almoxarifado de Obra' };

export default function SaldoEstoque() {
  const urlParams = new URLSearchParams(window.location.search);
  const [almoxFiltro, setAlmoxFiltro] = useState(urlParams.get('almox_id') || urlParams.get('local_id') || '');
  const [busca, setBusca] = useState('');
  const [dialogMovOpen, setDialogMovOpen] = useState(false);
  const [dialogSaidaOpen, setDialogSaidaOpen] = useState(false);

  const { data: locais = [] } = useQuery({
    queryKey: ['local-estoque'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
  });

  // Saldo calculado de EstoqueMovimentacao (fonte única — reflete Compras + Estoque)
  const { data: saldoResp, isLoading, refetch } = useQuery({
    queryKey: ['saldos-estoque-calc'],
    queryFn: () => base44.functions.invoke('getSaldosEstoque', {}).then((r) => r.data),
  });
  const saldos = saldoResp?.saldos || [];

  const localMap = useMemo(() => Object.fromEntries(locais.map((l) => [l.id, l])), [locais]);

  const saldosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return saldos
      .filter((s) => !almoxFiltro || s.local_estoque_id === almoxFiltro)
      .filter((s) => !q || (s.material_nome || '').toLowerCase().includes(q))
      .sort((a, b) => (b.saldo || 0) - (a.saldo || 0));
  }, [saldos, almoxFiltro, busca]);

  const {
    paginatedItems: pageItens,
    currentPage, totalPages, goToPage, startIndex, endIndex, totalItems,
  } = usePagination(saldosFiltrados, POR_PAGINA);
  const resetPagina = () => goToPage(1);

  const localSelecionado = almoxFiltro ? localMap[almoxFiltro] : null;
  const localOptions = locais.filter((l) => l.ativo !== false).map((l) => ({ value: l.id, label: `${l.nome}${NIVEL_SUFIXO[nivelDe(l)] || ''}` }));
  const qtdFiltros = [almoxFiltro, busca].filter(Boolean).length;

  const onMov = () => { setDialogMovOpen(false); refetch(); };
  const onSaida = () => { setDialogSaidaOpen(false); refetch(); };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{localSelecionado ? `Saldo — ${localSelecionado.nome}` : 'Saldo de Estoque'}</h1>
          <p className="text-gray-500 text-sm mt-1">{localSelecionado ? (NIVEL_ALMOX[nivelDe(localSelecionado)] || 'Almoxarifado') : 'Saldo consolidado (calculado das movimentações)'}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Link to={createPageUrl('Almoxarifados')} className="w-full sm:w-auto"><Button variant="outline" className="w-full gap-2 border-gray-300 text-gray-700"><Warehouse className="w-4 h-4" /> Almoxarifados</Button></Link>
          <Button onClick={() => setDialogSaidaOpen(true)} variant="outline" className="w-full sm:w-auto gap-2 border-red-300 text-red-700 hover:bg-red-50"><ArrowUp className="w-4 h-4" /> Saída de Obra</Button>
          <Button onClick={() => setDialogMovOpen(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2"><ArrowLeftRight className="w-4 h-4" /> Nova Movimentação</Button>
        </div>
      </div>

      {/* Filtros (colapsáveis) — componente compartilhado (padrão do sistema) */}
      <FiltrosColapsaveis
        ativos={qtdFiltros}
        onLimpar={() => { setAlmoxFiltro(''); setBusca(''); resetPagina(); }}
        rodape={<span className="text-xs text-gray-500">{saldosFiltrados.length} item(ns) com saldo</span>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Almoxarifado</Label>
            <ComboboxBusca options={localOptions} value={almoxFiltro} onSelect={(v) => { setAlmoxFiltro(v); resetPagina(); }} placeholder="Todos os almoxarifados" searchPlaceholder="Buscar almoxarifado..." />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Buscar Material</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} placeholder="Nome do material..." />
            </div>
          </div>
        </div>
      </FiltrosColapsaveis>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={7} />
          ) : saldosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum saldo encontrado.</p>
              <p className="text-sm mt-1">Saldos aparecem após entradas/recebimentos. (Calculado das movimentações.)</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {!almoxFiltro && <th className="px-4 py-3 text-left text-gray-600 font-semibold text-xs">Almoxarifado</th>}
                      <th className="px-4 py-3 text-left text-gray-600 font-semibold text-xs">Material</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-semibold text-xs">Saldo</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-semibold text-xs">Unid.</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-semibold text-xs">Custo Médio</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-semibold text-xs">Valor Total</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-semibold text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((s, i) => {
                      const local = localMap[s.local_estoque_id];
                      const zerado = (s.saldo || 0) <= 0;
                      return (
                        <tr key={`${s.local_estoque_id}|${s.material_id}|${i}`} className="hover:bg-gray-50">
                          {!almoxFiltro && (
                            <td className="px-4 py-3">
                              <span className="text-gray-700 text-xs">{local?.nome || '—'}</span>
                              <span className="text-[10px] text-gray-400 ml-1">{NIVEL_CURTO[nivelDe(local)] || ''}</span>
                            </td>
                          )}
                          <td className="px-4 py-3"><span className="font-medium text-gray-900">{s.material_nome || s.material_id}</span></td>
                          <td className="px-4 py-3 text-right"><span className={`font-semibold ${zerado ? 'text-red-500' : 'text-gray-900'}`}>{fmtNum(s.saldo)}</span></td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{s.material_unidade || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs">{s.custo_medio ? fmtBRL(s.custo_medio) : '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs font-medium">{s.valor ? fmtBRL(s.valor) : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {zerado ? <Badge className="bg-red-100 text-red-700 border-0 text-xs">Zerado</Badge> : <Badge className="bg-green-100 text-green-700 border-0 text-xs">OK</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {pageItens.map((s, i) => {
                  const local = localMap[s.local_estoque_id];
                  const zerado = (s.saldo || 0) <= 0;
                  return (
                    <div key={`m-${s.local_estoque_id}|${s.material_id}|${i}`} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 break-words">{s.material_nome || s.material_id}</p>
                          {!almoxFiltro && <p className="text-xs text-gray-400 mt-0.5 break-words">{local?.nome || '—'}{NIVEL_CURTO[nivelDe(local)] ? ` · ${NIVEL_CURTO[nivelDe(local)]}` : ''}</p>}
                        </div>
                        {zerado
                          ? <Badge className="bg-red-100 text-red-700 border-0 text-xs shrink-0">Zerado</Badge>
                          : <Badge className="bg-green-100 text-green-700 border-0 text-xs shrink-0">OK</Badge>}
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-500">Saldo</p>
                          <p className={`text-lg font-semibold ${zerado ? 'text-red-500' : 'text-gray-900'}`}>{fmtNum(s.saldo)} <span className="text-xs font-normal text-gray-500">{s.material_unidade || ''}</span></p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-sm font-medium text-gray-700 break-words">{s.valor ? fmtBRL(s.valor) : '—'}</p>
                          <p className="text-[11px] text-gray-400">Custo méd.: {s.custo_medio ? fmtBRL(s.custo_medio) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalItems}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DialogSaidaEstoqueObra open={dialogSaidaOpen} onClose={() => setDialogSaidaOpen(false)} onSuccess={onSaida} />
      {dialogMovOpen && (
        <DialogMovimentacaoEstoque open={dialogMovOpen} onClose={() => setDialogMovOpen(false)} onSuccess={onMov} locais={locais} almoxPreSelecionado={almoxFiltro || null} />
      )}
    </div>
  );
}
