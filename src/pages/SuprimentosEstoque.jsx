import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Package, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FormEntradaAvulsaComNF from '@/components/estoque/FormEntradaAvulsaComNF';

function calcSaldos(movs, localId) {
  const saldos = {}; // materialId -> { qtd, ultimoCusto }
  for (const m of movs) {
    const mid = m.material_id;
    if (!mid) continue;
    if (!saldos[mid]) saldos[mid] = { qtd: 0, ultimoCusto: 0, nome: m.material_nome || '', unidade: m.material_unidade || '' };

    if (m.tipo === 'ENTRADA' && m.destino_local_id === localId) {
      saldos[mid].qtd += m.quantidade || 0;
      if (m.custo_unitario) saldos[mid].ultimoCusto = m.custo_unitario;
    }
    if (m.tipo === 'SAIDA' && m.origem_local_id === localId) {
      saldos[mid].qtd -= m.quantidade || 0;
    }
    if (m.tipo === 'TRANSFERENCIA') {
      if (m.origem_local_id === localId) saldos[mid].qtd -= m.quantidade || 0;
      if (m.destino_local_id === localId) saldos[mid].qtd += m.quantidade || 0;
    }
    if (m.tipo === 'AJUSTE') {
      if (m.destino_local_id === localId) saldos[mid].qtd += m.quantidade || 0;
      if (m.origem_local_id === localId) saldos[mid].qtd -= m.quantidade || 0;
    }
  }
  return saldos;
}

export default function SuprimentosEstoque() {
  const [localId, setLocalId] = useState('');
  const [busca, setBusca] = useState('');
  const [modalEntrada, setModalEntrada] = useState(false);

  const { data: locais = [] } = useQuery({ queryKey: ['locais-ativos'], queryFn: () => base44.entities.LocalEstoque.filter({ ativo: true }, 'nome', 50) });
  const { data: movs = [], isLoading, refetch } = useQuery({
    queryKey: ['estoque-movs-all'],
    queryFn: () => base44.entities.EstoqueMovimentacao.list('-data_mov', 5000),
  });

  const saldos = useMemo(() => {
    if (!localId) return {};
    return calcSaldos(movs, localId);
  }, [movs, localId]);

  const linhas = useMemo(() => {
    return Object.entries(saldos)
      .map(([materialId, s]) => ({ materialId, ...s, valorEstimado: s.qtd * s.ultimoCusto }))
      .filter(l => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [saldos, busca]);

  const totalValor = linhas.reduce((acc, l) => acc + (l.valorEstimado || 0), 0);
  const comSaldo = linhas.filter(l => l.qtd > 0).length;
  const semSaldo = linhas.filter(l => l.qtd <= 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque — Visão Geral</h1>
          <p className="text-sm text-gray-500 hidden sm:block">Saldo calculado por movimentações registradas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 flex-1 sm:flex-none"><RefreshCw className="w-3 h-3" /> Atualizar</Button>
          <Button onClick={() => setModalEntrada(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"><Plus className="w-3 h-3" /> Entrada Avulsa</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap">
        <div className="w-full sm:w-64">
          <ComboboxBusca
            options={locais.map(l => ({ value: l.id, label: `${l.nome} (${l.tipo})` }))}
            value={localId}
            onSelect={(v) => setLocalId(v || '')}
            placeholder="Selecionar local de estoque..."
            searchPlaceholder="Buscar local..."
            emptyMessage="Nenhum local encontrado."
            buscarParaListar
            dicaBusca="Digite para buscar o local..."
          />
        </div>
        {localId && (
          <div className="relative w-full sm:flex-1 sm:min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-9" placeholder="Filtrar por material..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        )}
      </div>

      {!localId ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Selecione um local de estoque para visualizar o saldo</p>
        </Card>
      ) : isLoading ? (
        <p className="text-center py-10 text-gray-400">Calculando saldos...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-4 flex flex-col">
              <p className="text-2xl sm:text-3xl font-bold text-green-600 tabular-nums">{comSaldo}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Materiais com Saldo</p>
            </Card>
            <Card className="p-4 flex flex-col">
              <p className="text-2xl sm:text-3xl font-bold text-gray-400 tabular-nums">{semSaldo}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Sem Saldo / Zerados</p>
            </Card>
            <Card className="p-4 col-span-2 sm:col-span-1 flex flex-col">
              <p className="text-lg sm:text-xl font-bold text-blue-700 break-words tabular-nums">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Valor Estimado Total</p>
            </Card>
          </div>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              {linhas.length === 0 ? (
                <p className="text-center py-12 text-gray-400">Nenhum material encontrado para este local.</p>
              ) : (
                <>
                  {/* Tabela (desktop) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-semibold text-gray-600">Material</th>
                          <th className="text-left p-3 font-semibold text-gray-600 w-20">Unidade</th>
                          <th className="text-right p-3 font-semibold text-gray-600 w-28">Saldo</th>
                          <th className="text-right p-3 font-semibold text-gray-600 w-32">Último Custo</th>
                          <th className="text-right p-3 font-semibold text-gray-600 w-36">Valor Estimado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {linhas.map(l => (
                          <tr key={l.materialId} className={l.qtd <= 0 ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                            <td className="p-3 font-medium text-gray-900">{l.nome || l.materialId.slice(0, 12)}</td>
                            <td className="p-3 text-gray-500">{l.unidade}</td>
                            <td className="p-3 text-right">
                              <span className={`font-bold ${l.qtd <= 0 ? 'text-gray-400' : l.qtd < 5 ? 'text-orange-600' : 'text-green-700'}`}>
                                {l.qtd.toFixed(3)}
                              </span>
                              {l.qtd <= 0 && <Badge className="ml-2 bg-gray-100 text-gray-400 text-xs">zerado</Badge>}
                            </td>
                            <td className="p-3 text-right text-gray-500 text-xs">
                              {l.ultimoCusto ? `R$ ${l.ultimoCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-700 text-xs">
                              {l.valorEstimado ? `R$ ${l.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {linhas.map(l => (
                      <div key={l.materialId} className={`p-3 ${l.qtd <= 0 ? 'bg-gray-50 opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 break-words">{l.nome || l.materialId.slice(0, 12)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{l.unidade}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`font-bold ${l.qtd <= 0 ? 'text-gray-400' : l.qtd < 5 ? 'text-orange-600' : 'text-green-700'}`}>
                              {l.qtd.toFixed(3)}
                            </span>
                            {l.qtd <= 0 && <Badge className="ml-2 bg-gray-100 text-gray-400 text-xs">zerado</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                          <span className="text-gray-500">
                            Últ. custo: {l.ultimoCusto ? `R$ ${l.ultimoCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                          </span>
                          <span className="font-semibold text-gray-700 break-words text-right">
                            {l.valorEstimado ? `R$ ${l.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal Entrada Avulsa */}
      <FormEntradaAvulsaComNF
        open={modalEntrada}
        onClose={() => setModalEntrada(false)}
        onSuccess={() => {
          refetch();
          setModalEntrada(false);
        }}
      />
    </div>
  );
}