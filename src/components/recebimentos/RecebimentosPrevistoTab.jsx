import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, CheckCircle, TrendingUp, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RecebimentoPrevistoForm from './RecebimentoPrevistoForm';
import BaixaRecebimentoModal from './BaixaRecebimentoModal';
import { useHasPermission } from '@/components/shared/RBACContext';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

const STATUS_CONFIG = {
  PREVISTO:  { label: 'Previsto',  cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  FATURADO:  { label: 'Faturado',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEBIDO:  { label: 'Recebido',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ATRASADO:  { label: 'Atrasado',  cls: 'bg-red-50 text-red-700 border-red-200' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500 border-gray-200' }
};

const TIPO_CONFIG = {
  ADIANTAMENTO: { label: 'Adiantamento', cls: 'bg-purple-50 text-purple-700' },
  MEDICAO:      { label: 'Medição',      cls: 'bg-slate-100 text-slate-700' },
  PARCELA:      { label: 'Parcela',      cls: 'bg-cyan-50 text-cyan-700' },
  OUTRO:        { label: 'Outro',        cls: 'bg-gray-100 text-gray-500' }
};

export default function RecebimentosPrevistoTab({ obraId, podeEditar = true }) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [baixandoItem, setBaixandoItem] = useState(null);
  // Aprovar/confirmar recebimento é ação financeira: só financeiro + admin/TI (FINANCEIRO_APPROVE).
  const podeAprovar = useHasPermission('FINANCEIRO_APPROVE');

  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ['recebimentos-previstos', obraId],
    queryFn: () => base44.entities.RecebimentoPrevisto.filter({ obra_id: obraId }, 'data_prevista'),
    enabled: !!obraId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RecebimentoPrevisto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recebimentos-previstos', obraId] });
      toast.success('Removido!');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`)
  });

  // Totalizadores
  const totais = useMemo(() => {
    const ativos = recebimentos.filter(r => r.status !== 'CANCELADO');
    const totalPrevisto = ativos.reduce((s, r) => s + (r.valor_previsto || 0), 0);
    const totalRecebido = ativos.filter(r => r.status === 'RECEBIDO').reduce((s, r) => s + (r.valor_real || r.valor_previsto || 0), 0);
    const totalPendente = ativos.filter(r => r.status !== 'RECEBIDO').reduce((s, r) => s + (r.valor_previsto || 0), 0);
    const atrasados = ativos.filter(r => r.status !== 'RECEBIDO' && r.data_prevista && isPast(parseISO(r.data_prevista))).length;

    return { totalPrevisto, totalRecebido, totalPendente, atrasados };
  }, [recebimentos]);

  // Mais recente no topo (por data prevista; desempate pela criação).
  const recebimentosOrdenados = useMemo(
    () => [...recebimentos].sort((a, b) =>
      (new Date(b.data_prevista || 0) - new Date(a.data_prevista || 0))
      || (new Date(b.created_date || 0) - new Date(a.created_date || 0))),
    [recebimentos],
  );

  const handleEditar = (r) => {
    setEditando(r);
    setFormOpen(true);
  };

  const handleNovo = () => {
    setEditando(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Recebimentos Previstos</h2>
          <p className="text-gray-500 text-sm mt-1 hidden sm:block">Projeção de entradas por etapa/medição</p>
        </div>
        {podeEditar && (
          <Button onClick={handleNovo} className="bg-blue-600 hover:bg-blue-700 gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Novo</span>
            <span className="hidden sm:inline">Novo Recebimento</span>
          </Button>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 min-w-0">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <span className="text-xs text-gray-500 font-semibold">Total Previsto</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-600 tabular-nums truncate">
              <span className="sm:hidden">{fmtCompact(totais.totalPrevisto)}</span>
              <span className="hidden sm:inline">{fmt(totais.totalPrevisto)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 min-w-0">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-gray-500 font-semibold">Total Recebido</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 tabular-nums truncate">
              <span className="sm:hidden">{fmtCompact(totais.totalRecebido)}</span>
              <span className="hidden sm:inline">{fmt(totais.totalRecebido)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 min-w-0">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-500 font-semibold">Saldo a Receber</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-amber-400 tabular-nums truncate">
              <span className="sm:hidden">{fmtCompact(totais.totalPendente)}</span>
              <span className="hidden sm:inline">{fmt(totais.totalPendente)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className={`border-gray-200 ${totais.atrasados > 0 ? 'bg-red-50' : 'bg-white'}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${totais.atrasados > 0 ? 'text-red-600' : 'text-gray-500'}`} />
              <span className="text-xs text-gray-500 font-semibold">Atrasados</span>
            </div>
            <p className={`text-xl font-bold ${totais.atrasados > 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {totais.atrasados}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 text-base">
            Histórico Cronológico ({recebimentos.length} registros)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}
            </div>
          ) : recebimentos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum recebimento previsto cadastrado</p>
              <p className="text-xs mt-1 text-gray-500">Clique em "Novo Recebimento" para adicionar</p>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Descrição</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Tipo</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Data Prevista</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Valor Previsto</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Valor Real</th>
                    <th className="px-3 py-3 text-center text-gray-500 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recebimentosOrdenados.map(r => {
                    const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.PREVISTO;
                    const tp = TIPO_CONFIG[r.tipo] || TIPO_CONFIG.OUTRO;
                    const ehMedicao = r.tipo === 'MEDICAO';
                    const atrasado = r.status !== 'RECEBIDO' && r.status !== 'CANCELADO'
                      && r.data_prevista && isPast(parseISO(r.data_prevista));

                    return (
                      <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <span className="text-gray-900 font-medium">{r.descricao}</span>
                          {r.observacao && (
                            <p className="text-xs text-gray-500 mt-0.5">{r.observacao}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={`${tp.cls} border-0 text-xs`}>{tp.label}</Badge>
                        </td>
                        <td className={`px-3 py-3 text-sm ${atrasado ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {r.data_prevista
                            ? format(parseISO(r.data_prevista), 'dd MMM yyyy', { locale: ptBR })
                            : '—'}
                          {atrasado && <span className="text-xs block text-red-500">vencido</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900 font-semibold">
                          {fmt(r.valor_previsto)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.valor_real ? (
                            <span className="text-emerald-600 font-semibold">{fmt(r.valor_real)}</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge className={`${st.cls} text-xs border`}>{st.label}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            {podeAprovar && r.status !== 'RECEBIDO' && r.status !== 'CANCELADO' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title={ehMedicao ? 'Medição: a receita entra pela aprovação da BM (Contas a Receber), não por aqui — evita duplicar.' : 'Confirmar Recebimento'}
                                disabled={ehMedicao}
                                onClick={() => setBaixandoItem(r)}
                                className={`h-7 w-7 ${ehMedicao ? 'text-gray-300 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700'}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {podeEditar && r.status !== 'RECEBIDO' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditar(r)}
                                className="text-gray-600 hover:text-gray-900 h-7 w-7"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {podeEditar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(r.id)}
                              className="text-red-600 hover:text-red-700 h-7 w-7"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards mobile */}
            <div className="md:hidden space-y-2">
              {recebimentosOrdenados.map(r => {
                const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.PREVISTO;
                const tp = TIPO_CONFIG[r.tipo] || TIPO_CONFIG.OUTRO;
                const ehMedicao = r.tipo === 'MEDICAO';
                const atrasado = r.status !== 'RECEBIDO' && r.status !== 'CANCELADO'
                  && r.data_prevista && isPast(parseISO(r.data_prevista));

                return (
                  <div key={r.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-gray-900 font-medium text-sm break-words">{r.descricao}</p>
                        {r.observacao && (
                          <p className="text-xs text-gray-500 mt-0.5 break-words">{r.observacao}</p>
                        )}
                      </div>
                      <span className="text-gray-900 font-semibold text-sm whitespace-nowrap shrink-0">
                        {fmt(r.valor_previsto)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge className={`${tp.cls} border-0 text-xs`}>{tp.label}</Badge>
                      <Badge className={`${st.cls} text-xs border`}>{st.label}</Badge>
                      <span className={`text-xs ${atrasado ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {r.data_prevista
                          ? format(parseISO(r.data_prevista), 'dd MMM yyyy', { locale: ptBR })
                          : '—'}
                      </span>
                      {atrasado && <span className="text-xs text-red-500">vencido</span>}
                    </div>
                    {r.valor_real ? (
                      <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                        <span className="text-gray-500 font-semibold">Valor Real</span>
                        <span className="text-emerald-600 font-semibold whitespace-nowrap">{fmt(r.valor_real)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
                      {podeAprovar && r.status !== 'RECEBIDO' && r.status !== 'CANCELADO' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={ehMedicao ? 'Medição: a receita entra pela aprovação da BM (Contas a Receber), não por aqui — evita duplicar.' : 'Confirmar Recebimento'}
                          disabled={ehMedicao}
                          onClick={() => setBaixandoItem(r)}
                          className={`h-9 w-9 ${ehMedicao ? 'text-gray-300 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700'}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {podeEditar && r.status !== 'RECEBIDO' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditar(r)}
                          className="text-gray-600 hover:text-gray-900 h-9 w-9"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {podeEditar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(r.id)}
                        className="text-red-600 hover:text-red-700 h-9 w-9"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Formulário */}
      <RecebimentoPrevistoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        obraId={obraId}
        recebimento={editando}
      />

      {/* Modal de Baixa */}
      {baixandoItem && (
        <BaixaRecebimentoModal
          open={!!baixandoItem}
          onClose={() => setBaixandoItem(null)}
          recebimento={baixandoItem}
          obraId={obraId}
        />
      )}
    </div>
  );
}