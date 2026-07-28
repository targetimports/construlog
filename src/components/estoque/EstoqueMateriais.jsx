import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, Package, ChevronLeft, ChevronRight } from 'lucide-react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const statusConfig = {
  'OK': { label: 'OK', cls: 'bg-green-100 text-green-700' },
  'ALERTA': { label: 'Alerta', cls: 'bg-amber-100 text-amber-700' },
  'CRITICO': { label: 'Crítico', cls: 'bg-red-100 text-red-700' },
  'RUPTURA': { label: 'Ruptura', cls: 'bg-red-200 text-red-800' },
  'PARADO': { label: 'Parado', cls: 'bg-purple-100 text-purple-700' },
};

function calcStatus(s) {
  const saldo = s.saldo_atual || 0;
  if (saldo === 0) return 'RUPTURA';
  if ((s.quantidade_minima || 0) > 0 && saldo < s.quantidade_minima) return 'CRITICO';
  if ((s.ponto_reposicao || 0) > 0 && saldo <= s.ponto_reposicao) return 'ALERTA';
  if (s.status_estoque === 'PARADO') return 'PARADO';
  return 'OK';
}

export default function EstoqueMateriais({ saldos = [], locais = [] }) {
  const [busca, setBusca] = useState('');
  const [filtroLocal, setFiltroLocal] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCurva, setFiltroCurva] = useState('todos');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const localMap = useMemo(() => {
    const m = {};
    locais.forEach(l => { m[l.id] = l; });
    return m;
  }, [locais]);

  const itens = useMemo(() => {
    return saldos.map(s => {
      const local = localMap[s.local_estoque_id];
      const status = calcStatus(s);
      return { ...s, local, status_calc: status };
    });
  }, [saldos, localMap]);

  const filtrados = useMemo(() => {
    return itens.filter(s => {
      if (busca && !(s.material_nome || '').toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroLocal !== 'todos') {
        if (filtroLocal === 'CENTRAL' && s.local?.tipo !== 'CENTRAL') return false;
        if (filtroLocal === 'OBRA' && s.local?.tipo !== 'OBRA') return false;
        if (filtroLocal !== 'CENTRAL' && filtroLocal !== 'OBRA' && s.local_estoque_id !== filtroLocal) return false;
      }
      if (filtroStatus !== 'todos' && s.status_calc !== filtroStatus) return false;
      if (filtroCurva !== 'todos' && (s.curva_abc || '') !== filtroCurva) return false;
      return true;
    }).sort((a, b) => {
      const order = { RUPTURA: 0, CRITICO: 1, ALERTA: 2, PARADO: 3, OK: 4 };
      return (order[a.status_calc] || 4) - (order[b.status_calc] || 4);
    });
  }, [itens, busca, filtroLocal, filtroStatus, filtroCurva]);

  React.useEffect(() => { setPage(1); }, [busca, filtroLocal, filtroStatus, filtroCurva]);
  const totalPages = Math.max(1, Math.ceil(filtrados.length / PER_PAGE));
  const pageItems = filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const temFiltro = busca || filtroLocal !== 'todos' || filtroStatus !== 'todos' || filtroCurva !== 'todos';
  const limparFiltros = () => { setBusca(''); setFiltroLocal('todos'); setFiltroStatus('todos'); setFiltroCurva('todos'); };

  const locaisAtivos = locais.filter(l => l.ativo !== false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Materiais em Estoque ({filtrados.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar material..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filtroLocal} onValueChange={setFiltroLocal}>
            <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Locais</SelectItem>
              <SelectItem value="CENTRAL">Centrais</SelectItem>
              <SelectItem value="OBRA">Obras</SelectItem>
              {locaisAtivos.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="ALERTA">Alerta</SelectItem>
              <SelectItem value="CRITICO">Crítico</SelectItem>
              <SelectItem value="RUPTURA">Ruptura</SelectItem>
              <SelectItem value="PARADO">Parado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCurva} onValueChange={setFiltroCurva}>
            <SelectTrigger className="w-full sm:w-[120px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Curva ABC</SelectItem>
              <SelectItem value="A">Curva A</SelectItem>
              <SelectItem value="B">Curva B</SelectItem>
              <SelectItem value="C">Curva C</SelectItem>
            </SelectContent>
          </Select>
          {temFiltro && (
            <button onClick={limparFiltros} className="text-sm text-gray-500 hover:text-gray-700 underline px-2 h-9 self-start sm:self-auto">
              Limpar filtros
            </button>
          )}
        </div>

        {/* Tabela */}
        <div className="border border-gray-200 rounded-lg">
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Local</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Material</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Saldo</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Reserv.</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Trâns.</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Dispon.</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Mínimo</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Custo Médio</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-500">ABC</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map(s => {
                const disponivel = Math.max(0, (s.saldo_atual || 0) - (s.quantidade_reservada || 0) - (s.quantidade_em_transito || 0));
                const valor = (s.saldo_atual || 0) * (s.custo_unitario_medio || 0);
                const st = statusConfig[s.status_calc] || statusConfig.OK;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3 text-xs">
                      <span className="truncate max-w-[120px] inline-block align-middle text-gray-700">{s.local?.nome || '—'}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{s.local?.tipo === 'CENTRAL' ? 'Central' : 'Obra'}</span>
                    </td>
                    <td className="p-3 font-medium text-gray-900">{s.material_nome || '—'}</td>
                    <td className="p-3 text-right font-semibold">{fmtN(s.saldo_atual)}</td>
                    <td className="p-3 text-right text-orange-600">{fmtN(s.quantidade_reservada)}</td>
                    <td className="p-3 text-right text-cyan-600">{fmtN(s.quantidade_em_transito)}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700">{fmtN(disponivel)}</td>
                    <td className="p-3 text-right text-gray-500">{fmtN(s.quantidade_minima)}</td>
                    <td className="p-3 text-right text-gray-500">{fmt(s.custo_unitario_medio)}</td>
                    <td className="p-3 text-right font-semibold">{fmt(valor)}</td>
                    <td className="p-3 text-center">
                      {s.curva_abc ? (
                        <Badge variant="outline" className="text-xs">{s.curva_abc}</Badge>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-400">
                    Nenhum material encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden flex flex-col gap-y-2 p-2">
            {pageItems.map(s => {
              const disponivel = Math.max(0, (s.saldo_atual || 0) - (s.quantidade_reservada || 0) - (s.quantidade_em_transito || 0));
              const valor = (s.saldo_atual || 0) * (s.custo_unitario_medio || 0);
              const st = statusConfig[s.status_calc] || statusConfig.OK;
              return (
                <div key={s.id} className="p-3 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 break-words">{s.material_nome || '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">
                        {s.local?.nome || '—'} <span className="text-gray-400">· {s.local?.tipo === 'CENTRAL' ? 'Central' : 'Obra'}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
                      {s.curva_abc && <Badge variant="outline" className="text-xs">{s.curva_abc}</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="flex flex-col leading-tight">
                      <span className="text-gray-400">Saldo</span>
                      <span className="font-semibold tabular-nums">{fmtN(s.saldo_atual)}</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-gray-400">Reserv.</span>
                      <span className="text-orange-600 tabular-nums">{fmtN(s.quantidade_reservada)}</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-gray-400">Trâns.</span>
                      <span className="text-cyan-600 tabular-nums">{fmtN(s.quantidade_em_transito)}</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-gray-400">Dispon.</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">{fmtN(disponivel)}</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-gray-400">Mínimo</span>
                      <span className="text-gray-500 tabular-nums">{fmtN(s.quantidade_minima)}</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-gray-400">Custo Médio</span>
                      <span className="text-gray-500 break-words">{fmt(s.custo_unitario_medio)}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400">Valor total</span>
                    <span className="font-semibold text-sm break-words text-right">{fmt(valor)}</span>
                  </div>
                </div>
              );
            })}
            {filtrados.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Nenhum material encontrado
              </div>
            )}
          </div>

          {filtrados.length > PER_PAGE && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">Mostrando {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtrados.length)} de {filtrados.length}</span>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                <span className="text-xs text-gray-600 whitespace-nowrap">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}