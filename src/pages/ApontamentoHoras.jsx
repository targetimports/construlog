import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Upload, Pencil, CheckCircle, XCircle } from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import FiltrosApontamentoHoras from '@/components/rh/FiltrosApontamentoHoras';
import FormApontamentoHoraModal from '@/components/rh/FormApontamentoHoraModal';
import DialogAprovarRejeitarApontamento from '@/components/rh/DialogAprovarRejeitarApontamento';
import ImportarDoDiarioModal from '@/components/rh/ImportarDoDiarioModal';
import ResumoApontamentoHoras from '@/components/rh/ResumoApontamentoHoras';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function ApontamentoHoras() {
  const [filtros, setFiltros] = useState({ obra_id: '', colaborador_id: '', de: '', ate: '' });
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showAprovacao, setShowAprovacao] = useState(null);
  const [showImportar, setShowImportar] = useState(false);
  const [pagina, setPagina] = useState(1);

  const queryClient = useQueryClient();

  const { data: apontamentos, isLoading, error } = useQuery({
    queryKey: ['apontamentos-horas', filtros, pagina],
    queryFn: () => base44.functions.invoke('listarApontamentosHora', { ...filtros, pagina }),
    select: (res) => res.data
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000),
  });
  const nomePorId = React.useMemo(
    () => Object.fromEntries((colaboradores || []).map((c) => [c.id, c.nome])),
    [colaboradores]
  );

  // Obras p/ resolver nome no Excel (mesma queryKey do componente de filtros — cache único).
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });
  const obraNomePorId = React.useMemo(
    () => Object.fromEntries((obras || []).map((o) => [o.id, o.nome])),
    [obras]
  );

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra filtrada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obras?.find((o) => o.id === filtros.obra_id)?.empresa_id);

  const criarMutation = useMutation({
    mutationFn: (dados) => base44.functions.invoke('criarApontamentoHora', dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apontamentos-horas'] });
      setShowForm(false);
      setEditando(null);
    }
  });

  const editarMutation = useMutation({
    mutationFn: (dados) => base44.functions.invoke('editarApontamentoHora', dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apontamentos-horas'] });
      setEditando(null);
    }
  });

  const aprovarMutation = useMutation({
    mutationFn: (apontamento_id) => base44.functions.invoke('aprovarApontamentoHora', { apontamento_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apontamentos-horas'] });
      setShowAprovacao(null);
    }
  });

  const rejeitarMutation = useMutation({
    mutationFn: ({ apontamento_id, motivo }) => base44.functions.invoke('rejeitarApontamentoHora', { apontamento_id, motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apontamentos-horas'] });
      setShowAprovacao(null);
    }
  });

  // Exporta EXCEL branded com exatamente o que a tela mostra (página atual, filtros aplicados).
  const exportarExcel = () => {
    const linhas = apontamentos?.apontamentos || [];
    if (!linhas.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
      const periodo = [filtros.de && `de ${dataBR(filtros.de)}`, filtros.ate && `até ${dataBR(filtros.ate)}`].filter(Boolean).join(' ');
      exportarXLSXBranded(`apontamentos_horas_${new Date().toISOString().split('T')[0]}`, [{
        nome: 'Apontamentos',
        titulo: 'Apontamentos de Horas',
        subtitulo: `${linhas.length} apontamento(s)` +
          (filtros.obra_id ? ` · ${obraNomePorId[filtros.obra_id] || ''}` : '') +
          (periodo ? ` · ${periodo}` : ''),
        headers: ['Data', 'Colaborador', 'Obra', 'Horas Normais', 'Horas Extras', 'Custo Hora', 'Custo Total', 'Status', 'Origem', 'Observação'],
        rows: linhas.map((ap) => [
          dataBR(ap.data),
          nomePorId[ap.colaborador_id] || ap.colaborador_id || '',
          obraNomePorId[ap.obra_id] || ap.obra_id || '',
          Number(ap.horas_normais) || 0,
          Number(ap.horas_extras) || 0,
          Number(ap.custo_hora) || 0,
          Number(ap.custo_total) || 0,
          ap.status || '',
          ap.origem || '',
          ap.observacao || '',
        ]),
        moeda: [5, 6],
      }], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  const statusBadge = (status) => {
    const cfg = {
      rascunho: 'bg-amber-100 text-amber-700',
      aprovado: 'bg-emerald-100 text-emerald-700',
      rejeitado: 'bg-red-100 text-red-700',
    };
    return `border-0 ${cfg[status] || 'bg-gray-100 text-gray-600'}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apontamento de Horas</h1>
          <p className="text-gray-500 text-sm mt-1">Horas normais/extras e custo por colaborador</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowImportar(true)} variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700">
            <Upload className="w-4 h-4 mr-2" /> Importar do Diário
          </Button>
          <Button onClick={exportarExcel} variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700">
            <Download className="w-4 h-4 mr-2" /> Exportar Excel
          </Button>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Novo Apontamento
          </Button>
        </div>
      </div>

      <FiltrosApontamentoHoras onFiltroChange={setFiltros} />

      {filtros.de || filtros.ate ? (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
          Filtros aplicados: {filtros.de && `de ${filtros.de}`} {filtros.ate && `até ${filtros.ate}`}
        </div>
      ) : null}

      <ResumoApontamentoHoras filtros={filtros} />

      {isLoading ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-0">
            <TableSkeleton bare rows={6} cols={7} />
          </CardContent>
        </Card>
      ) : error ? (
        <div className="text-red-500">Erro ao carregar</div>
      ) : (
        <>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {(apontamentos?.apontamentos?.length || 0) === 0 ? (
                <p className="text-center py-12 text-gray-400">Nenhum apontamento encontrado.</p>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Normais</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Extras</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Custo Total</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {apontamentos?.apontamentos?.map((ap) => (
                          <tr key={ap.id} className="hover:bg-gray-50">
                            <td className="p-3 text-gray-700">{ap.data ? new Date(ap.data).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="p-3 font-medium text-gray-900">{nomePorId[ap.colaborador_id] || ap.colaborador_id || '—'}</td>
                            <td className="text-right p-3 text-gray-600">{ap.horas_normais ?? 0}</td>
                            <td className="text-right p-3 text-gray-600">{ap.horas_extras ?? 0}</td>
                            <td className="text-right p-3 text-gray-700">R$ {(ap.custo_total || 0).toFixed(2)}</td>
                            <td className="p-3"><Badge className={statusBadge(ap.status)}>{ap.status}</Badge></td>
                            <td className="p-3">
                              <div className="flex gap-1 justify-end">
                                {ap.status === 'rascunho' && (
                                  <>
                                    <Button size="icon" variant="ghost" title="Editar" onClick={() => { setEditando(ap); setShowForm(true); }}>
                                      <Pencil className="w-4 h-4 text-gray-400" />
                                    </Button>
                                    <Button size="icon" variant="ghost" title="Aprovar" onClick={() => setShowAprovacao(ap)}>
                                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                                    </Button>
                                    <Button size="icon" variant="ghost" title="Rejeitar" onClick={() => rejeitarMutation.mutate({ apontamento_id: ap.id })}>
                                      <XCircle className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {apontamentos?.apontamentos?.map((ap) => (
                      <div key={ap.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 break-words">{nomePorId[ap.colaborador_id] || ap.colaborador_id || '—'}</p>
                            <p className="text-xs text-gray-500">{ap.data ? new Date(ap.data).toLocaleDateString('pt-BR') : '—'}</p>
                          </div>
                          <Badge className={statusBadge(ap.status)}>{ap.status}</Badge>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span>Normais: <span className="font-medium text-gray-700">{ap.horas_normais ?? 0}h</span></span>
                            <span>Extras: <span className="font-medium text-gray-700">{ap.horas_extras ?? 0}h</span></span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">R$ {(ap.custo_total || 0).toFixed(2)}</p>
                        </div>
                        {ap.status === 'rascunho' && (
                          <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                            <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => { setEditando(ap); setShowForm(true); }}><Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar</Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-8 text-emerald-600" onClick={() => setShowAprovacao(ap)}><CheckCircle className="w-3.5 h-3.5" /> Aprovar</Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-8 text-red-600 ml-auto" onClick={() => rejeitarMutation.mutate({ apontamento_id: ap.id })}><XCircle className="w-3.5 h-3.5" /> Rejeitar</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {apontamentos?.paginacao && (() => {
                    const { total, pagina, paginas } = apontamentos.paginacao;
                    const perPage = paginas > 0 ? Math.ceil(total / paginas) : total;
                    return (
                      <Pagination
                        currentPage={pagina}
                        totalPages={paginas}
                        onPageChange={setPagina}
                        startIndex={(pagina - 1) * perPage}
                        endIndex={Math.min(pagina * perPage, total)}
                        totalItems={total}
                      />
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showForm && (
        <FormApontamentoHoraModal
          apontamento={editando}
          onSave={(dados) => {
            if (editando) {
              editarMutation.mutate({ apontamento_id: editando.id, ...dados });
            } else {
              criarMutation.mutate(dados);
            }
          }}
          onClose={() => {
            setShowForm(false);
            setEditando(null);
          }}
        />
      )}

      {showAprovacao && (
        <DialogAprovarRejeitarApontamento
          apontamento={showAprovacao}
          onAprovar={() => aprovarMutation.mutate(showAprovacao.id)}
          onRejeitar={(motivo) => rejeitarMutation.mutate({ apontamento_id: showAprovacao.id, motivo })}
          onClose={() => setShowAprovacao(null)}
        />
      )}

      {showImportar && (
        <ImportarDoDiarioModal
          onImportar={(dados) => {
            base44.functions.invoke('importarApontamentosDoDiario', dados).then(() => {
              queryClient.invalidateQueries({ queryKey: ['apontamentos-horas'] });
              setShowImportar(false);
            });
          }}
          onClose={() => setShowImportar(false)}
        />
      )}
    </div>
  );
}