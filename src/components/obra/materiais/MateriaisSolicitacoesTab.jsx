import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/shared/Pagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { cn } from '@/lib/utils';
import { Plus, ClipboardList, Truck, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import AtenderRequisicaoModal from './AtenderRequisicaoModal';
import RequisicaoModal from '@/components/suprimentos/RequisicaoModal';
import DetalheRequisicaoModal from './DetalheRequisicaoModal';

// Já saiu do rascunho/aprovação → o olho abre o DETALHE (com fotos e conferência do
// recebimento), não o editor. Rascunho/enviada ainda dá para editar.
const JA_MOVIMENTOU = (s) => ['EM_TRANSITO', 'BAIXADA'].includes(String(s));

const PER_PAGE = 15;

const STATUS_CONFIG = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-600' },
  ENVIADA: { label: 'Requisitada', cls: 'bg-blue-100 text-blue-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  EM_TRANSITO: { label: 'Em trânsito', cls: 'bg-blue-100 text-blue-700' },
  BAIXADA: { label: 'Recebida', cls: 'bg-purple-100 text-purple-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
};

export default function MateriaisSolicitacoesTab({ obraId, podeEditar = false }) {
  const qc = useQueryClient();
  const [reqModal, setReqModal] = useState({ open: false, requisicao: null });
  const [detalheReq, setDetalheReq] = useState(null);
  const [atenderReq, setAtenderReq] = useState(null);
  const abrirOlho = (req) => (JA_MOVIMENTOU(req.status) ? setDetalheReq(req) : setReqModal({ open: true, requisicao: req }));
  const [page, setPage] = useState(1);

  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-obra-materiais', obraId],
    queryFn: () => base44.entities.RequisicaoObra.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId,
  });

  const { data: reqItens = [] } = useQuery({
    queryKey: ['requisicoes-itens-obra', obraId],
    queryFn: async () => {
      const reqIds = requisicoes.map((r) => r.id);
      if (reqIds.length === 0) return [];
      const todos = await base44.entities.RequisicaoObraItem.list('-created_date', 500);
      return todos.filter((it) => reqIds.includes(it.requisicao_id));
    },
    enabled: requisicoes.length > 0,
  });

  const { data: locaisCentral = [] } = useQuery({
    queryKey: ['locais-central-sol'],
    queryFn: () => base44.entities.LocalEstoque.filter({ tipo: 'CENTRAL' }),
    staleTime: 60000,
  });

  const centralId = locaisCentral[0]?.id;

  const { data: saldosCentral = [] } = useQuery({
    queryKey: ['saldos-central-sol', centralId],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: centralId }),
    enabled: !!centralId,
    staleTime: 30000,
  });

  const saldoCentralMap = {};
  for (const s of saldosCentral) {
    saldoCentralMap[s.material_id] = s.saldo_atual || 0;
  }

  const { data: user } = useQuery({ queryKey: ['me-reqtab'], queryFn: () => base44.auth.me().catch(() => null) });
  const aprovarMut = useMutation({
    mutationFn: (req) => base44.entities.RequisicaoObra.update(req.id, { status: 'APROVADA', aprovado_por_user_id: user?.email, aprovado_em: new Date().toISOString() }),
    onSuccess: () => {
      toast.success('Requisição aprovada');
      qc.invalidateQueries({ queryKey: ['requisicoes-obra-materiais', obraId] });
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message),
  });

  const itensMap = {};
  for (const it of reqItens) {
    if (!itensMap[it.requisicao_id]) itensMap[it.requisicao_id] = [];
    itensMap[it.requisicao_id].push(it);
  }

  const totalPages = Math.max(1, Math.ceil(requisicoes.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PER_PAGE;
  const endIndex = Math.min(startIndex + PER_PAGE, requisicoes.length);
  const pagina = requisicoes.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-sm text-gray-500">{requisicoes.length} requisições</p>
          <p className="text-xs text-gray-400 mt-0.5">Puxa material do estoque central para a obra — não é compra.</p>
        </div>
        <Button onClick={() => setReqModal({ open: true, requisicao: null })} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-sm w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Nova Requisição
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : requisicoes.length === 0 ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhuma requisição de material para esta obra.</p>
            <p className="text-xs text-gray-400 mt-1">Crie uma requisição para puxar materiais do estoque central (não é uma compra).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Requisição</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Itens</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Solicitante</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagina.map((req) => {
                  const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.RASCUNHO;
                  const itensReq = itensMap[req.id] || [];
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">#{req.id.substring(0, 8)}</div>
                        {req.observacao && (
                          <div
                            className="text-xs text-gray-400 italic mt-0.5 max-w-[220px] truncate"
                            title={req.observacao}
                          >
                            {req.observacao}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('border-0', st.cls)}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {itensReq.length === 0 ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {itensReq.map((it) => (
                              <div key={it.id} className="text-xs text-gray-600">
                                {it.material_nome || 'Material'}{' '}
                                <span className="text-gray-400">
                                  · {it.quantidade_solicitada} {it.material_unidade}
                                  {saldoCentralMap[it.material_id] !== undefined && ` (Central: ${saldoCentralMap[it.material_id]})`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {req.solicitante_nome || req.solicitante_user_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {req.data_requisicao ? new Date(req.data_requisicao).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {podeEditar && req.status === 'ENVIADA' && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              disabled={aprovarMut.isPending} onClick={() => aprovarMut.mutate(req)}>
                              <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                            </Button>
                          )}
                          {podeEditar && req.status === 'APROVADA' && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => setAtenderReq(req)}>
                              <Truck className="w-3.5 h-3.5" /> Atender
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title={JA_MOVIMENTOU(req.status) ? 'Ver recebimento (fotos, quebras)' : 'Ver / editar'} onClick={() => abrirOlho(req)}>
                            <Eye className="w-4 h-4 text-gray-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2 p-3">
            {pagina.map((req) => {
              const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.RASCUNHO;
              const itensReq = itensMap[req.id] || [];
              return (
                <div key={req.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-gray-900">#{req.id.substring(0, 8)}</div>
                    <Badge className={cn('border-0 shrink-0', st.cls)}>{st.label}</Badge>
                  </div>
                  {req.observacao && (
                    <div className="text-xs text-gray-400 italic mt-0.5 break-words">{req.observacao}</div>
                  )}
                  <div className="mt-2">
                    {itensReq.length === 0 ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {itensReq.map((it) => (
                          <div key={it.id} className="text-xs text-gray-600 break-words">
                            {it.material_nome || 'Material'}{' '}
                            <span className="text-gray-400">
                              · {it.quantidade_solicitada} {it.material_unidade}
                              {saldoCentralMap[it.material_id] !== undefined && ` (Central: ${saldoCentralMap[it.material_id]})`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-600 truncate min-w-0">
                      {req.solicitante_nome || req.solicitante_user_id || '—'}
                    </span>
                    <span className="text-gray-500 whitespace-nowrap shrink-0">
                      {req.data_requisicao ? new Date(req.data_requisicao).toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </div>
                  {podeEditar && req.status === 'ENVIADA' && (
                    <Button size="sm" variant="outline" className="mt-2 w-full h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      disabled={aprovarMut.isPending} onClick={() => aprovarMut.mutate(req)}>
                      <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                    </Button>
                  )}
                  {podeEditar && req.status === 'APROVADA' && (
                    <Button size="sm" variant="outline" className="mt-2 w-full h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setAtenderReq(req)}>
                      <Truck className="w-3.5 h-3.5" /> Atender
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="mt-2 w-full h-8 gap-1 border-gray-300 text-gray-600"
                    onClick={() => abrirOlho(req)}>
                    <Eye className="w-3.5 h-3.5" /> {JA_MOVIMENTOU(req.status) ? 'Ver recebimento' : 'Ver / editar'}
                  </Button>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={requisicoes.length}
            />
          )}
        </div>
      )}

      {/* Cadastro / edição de requisição (multi-item, mesmo modal da página) */}
      <RequisicaoModal
        open={reqModal.open}
        onClose={() => setReqModal({ open: false, requisicao: null })}
        requisicao={reqModal.requisicao}
        obraFixaId={obraId}
      />

      {/* Modal de atendimento: transfere Central → Obra */}
      <AtenderRequisicaoModal
        open={!!atenderReq}
        onClose={() => setAtenderReq(null)}
        requisicao={atenderReq || {}}
        itens={atenderReq ? (itensMap[atenderReq.id] || []) : []}
        saldoCentralMap={saldoCentralMap}
        obraId={obraId}
      />

      <DetalheRequisicaoModal
        requisicao={detalheReq}
        open={!!detalheReq}
        onClose={() => setDetalheReq(null)}
      />
    </div>
  );
}
