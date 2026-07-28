import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, FileText } from 'lucide-react';
import FiltrosContratos from '../components/contratos/FiltrosContratos';
import FormContratoModal from '../components/contratos/FormContratoModal';
import Pagination from '@/components/shared/Pagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

const LIMIT = 20;
const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

const TIPO_LABEL = { empreitada: 'Empreitada', fornecimento: 'Fornecimento', prestacao_servico: 'Prestação de Serviço', subcontratacao: 'Subcontratação' };
const STATUS_CLS = { ativo: 'bg-green-100 text-green-800', encerrado: 'bg-gray-100 text-gray-600', suspenso: 'bg-amber-100 text-amber-700' };

export default function ContratosPage() {
  const [filtros, setFiltros] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState(null);
  const [pagina, setPagina] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contratos', filtros, pagina],
    queryFn: async () => (await base44.functions.invoke('listarContratos', { ...filtros, pagina, limit: LIMIT })).data,
  });

  const { data: obras = [] } = useQuery({ queryKey: ['obras-contratos-map'], queryFn: () => base44.entities.Obra.list('-created_date', 1000) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores-contratos-map'], queryFn: () => base44.entities.Fornecedor.list('-created_date', 2000).catch(() => []) });

  const obraMap = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const fornMap = useMemo(() => Object.fromEntries(fornecedores.map((f) => [f.id, f.nome || f.razao_social])), [fornecedores]);

  const handleFiltroChange = (novosFiltros) => { setFiltros(novosFiltros); setPagina(0); };
  const handleSave = () => { queryClient.invalidateQueries({ queryKey: ['contratos'] }); setEditingContrato(null); };

  const contratos = data?.contratos || [];
  const total = data?.total || 0;
  const totalPaginas = data?.total_paginas || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-500 mt-1 hidden sm:block">Contratos com fornecedores e terceiros por obra</p>
        </div>
        <Button onClick={() => { setEditingContrato(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      <FiltrosContratos onFiltroChange={handleFiltroChange} onLimpar={() => { setFiltros({}); setPagina(0); }} />

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={8} cols={8} />
          ) : contratos.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhum contrato encontrado</p>
              <p className="text-xs text-gray-400 mt-1">Use "Novo Contrato" para cadastrar.</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {contratos.map((c) => {
                  const stCls = STATUS_CLS[c.status] || 'bg-gray-100 text-gray-600';
                  return (
                    <div key={c.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 break-words">{c.titulo || c.numero}</p>
                          {c.titulo && c.numero && <p className="text-xs text-gray-500">{c.numero}</p>}
                        </div>
                        <Badge className={`border-0 shrink-0 ${stCls}`}>{c.status || '—'}</Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p className="break-words"><span className="text-gray-400">Obra:</span> {obraMap[c.obra_id] || '—'}</p>
                        <p className="break-words"><span className="text-gray-400">Contratado:</span> {c.contratado_nome || fornMap[c.fornecedor_id] || '—'}</p>
                        <p><span className="text-gray-400">Tipo:</span> {TIPO_LABEL[c.tipo] || c.tipo || '—'}</p>
                        <p><span className="text-gray-400">Período:</span> {fmtData(c.data_inicio)} → {fmtData(c.data_fim_prevista)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-base font-semibold text-gray-900 tabular-nums break-words">{fmtBRL(c.valor_total)}</span>
                        <Button size="sm" variant="outline" onClick={() => { setEditingContrato(c); setModalOpen(true); }} className="border-gray-300 text-gray-700 gap-1.5 shrink-0">
                          <Edit2 className="h-4 w-4" /> Editar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Contrato</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Contratado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Início</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Fim Previsto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {contratos.map((c) => {
                      const stCls = STATUS_CLS[c.status] || 'bg-gray-100 text-gray-600';
                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{c.titulo || c.numero}</p>
                            {c.titulo && c.numero && <p className="text-xs text-gray-500">{c.numero}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[14rem] truncate" title={obraMap[c.obra_id] || ''}>{obraMap[c.obra_id] || '—'}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[14rem] truncate" title={c.contratado_nome || fornMap[c.fornecedor_id] || ''}>{c.contratado_nome || fornMap[c.fornecedor_id] || '—'}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{TIPO_LABEL[c.tipo] || c.tipo || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{fmtBRL(c.valor_total)}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtData(c.data_inicio)}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtData(c.data_fim_prevista)}</td>
                          <td className="px-4 py-3">
                            <Badge className={`border-0 ${stCls}`}>{c.status || '—'}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => { setEditingContrato(c); setModalOpen(true); }} className="border-gray-300 text-gray-700">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={pagina + 1}
                totalPages={totalPaginas}
                onPageChange={(p) => setPagina(p - 1)}
                startIndex={pagina * LIMIT}
                endIndex={Math.min((pagina + 1) * LIMIT, total)}
                totalItems={total}
              />
            </>
          )}
        </CardContent>
      </Card>

      <FormContratoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} contrato={editingContrato} />
    </div>
  );
}
