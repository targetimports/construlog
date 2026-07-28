import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, X, Wrench, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Pagination from '../shared/Pagination';
import { usePagination } from '../shared/usePagination';

const ITENS_POR_PAGINA = 15;

const prioridadeConfig = {
  baixa: { label: 'Baixa', color: 'bg-blue-100 text-blue-700' },
  media: { label: 'Média', color: 'bg-amber-100 text-amber-700' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700' }
};

function formatarData(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
}

export default function AprovacaoSolicitacoes({ solicitacoes = [], isLoading, obras = [], equipamentos = [] }) {
  // modo: null (fechado) | 'aprovar' | 'rejeitar'
  const [selectedSol, setSelectedSol] = useState(null);
  const [modo, setModo] = useState(null);
  const [texto, setTexto] = useState('');
  const queryClient = useQueryClient();

  const obrasMap = useMemo(() => new Map(obras.map(o => [o.id, o.nome])), [obras]);
  const equipMap = useMemo(() => new Map(equipamentos.map(e => [e.id, e.nome])), [equipamentos]);

  const {
    currentPage, totalPages, paginatedItems, goToPage,
    startIndex, endIndex, totalItems
  } = usePagination(solicitacoes, ITENS_POR_PAGINA);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const fecharDialog = () => { setSelectedSol(null); setModo(null); setTexto(''); };

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['solicitacoes-equipamentos'] });

  const aprovarMutation = useMutation({
    mutationFn: (sol) => base44.functions.invoke('aprovarSolicitacaoEquipamento', {
      solicitacao_id: sol.id,
      aprovador_id: user?.id,
      observacao: texto
    }),
    onSuccess: () => {
      toast.success('Solicitação aprovada com sucesso!');
      invalidar();
      fecharDialog();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
  });

  const rejeitarMutation = useMutation({
    mutationFn: (sol) => base44.entities.SolicitacaoEquipamento.update(sol.id, {
      status: 'rejeitada',
      motivo_rejeicao: texto,
      aprovado_por: user?.email,
      data_aprovacao: new Date().toISOString()
    }),
    onSuccess: () => {
      toast.success('Solicitação rejeitada');
      invalidar();
      fecharDialog();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
  });

  const isPending = aprovarMutation.isPending || rejeitarMutation.isPending;

  const abrir = (sol, m) => { setSelectedSol(sol); setModo(m); setTexto(''); };

  if (isLoading) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-12 text-center text-gray-500">Carregando...</CardContent>
      </Card>
    );
  }

  if (solicitacoes.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="p-2.5 rounded-xl bg-emerald-50">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-gray-700 font-medium">Nenhuma solicitação pendente</p>
          <p className="text-sm text-gray-500">Todas as solicitações foram processadas!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Motivo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Solicitante</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Obra</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Período</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Prioridade</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map(sol => {
                  const prioridade = prioridadeConfig[sol.prioridade] || { label: sol.prioridade || '—', color: 'bg-gray-100 text-gray-700' };
                  const isAluguel = sol.tipo_solicitacao === 'aluguel';
                  const item = isAluguel
                    ? (sol.descricao_aluguel || 'Aluguel de terceiros')
                    : (equipMap.get(sol.equipamento_id) || sol.equipamento_id || '—');
                  return (
                    <tr key={sol.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{sol.motivo || 'Solicitação'}</p>
                        <p className="text-xs text-gray-500">{isAluguel ? 'Aluguel de terceiros' : 'Equipamento próprio'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={sol.solicitante_email || ''}>
                        {sol.solicitante_email || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {obrasMap.get(sol.obra_id) || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={item}>
                        <span className="inline-flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {item}
                          {isAluguel && sol.valor_estimado_aluguel != null && (
                            <span className="text-xs text-amber-700 font-medium">
                              (R$ {Number(sol.valor_estimado_aluguel).toLocaleString('pt-BR')})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatarData(sol.data_inicio)} – {formatarData(sol.data_fim)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`border-0 ${prioridade.color}`}>{prioridade.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => abrir(sol, 'aprovar')}
                            disabled={isPending}
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrir(sol, 'rejeitar')}
                            disabled={isPending}
                            className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <X className="w-4 h-4 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedSol} onOpenChange={(open) => !open && fecharDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modo === 'rejeitar' ? 'Rejeitar' : 'Aprovar'} Solicitação</DialogTitle>
          </DialogHeader>

          {selectedSol && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                <strong>{selectedSol.motivo || 'Solicitação'}</strong> — solicitado por{' '}
                <strong>{selectedSol.solicitante_email || '—'}</strong>
              </p>

              <div>
                <Label>
                  {modo === 'rejeitar' ? 'Motivo da rejeição *' : 'Observações (opcional)'}
                </Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={modo === 'rejeitar'
                    ? 'Ex: Equipamento indisponível no período'
                    : 'Ex: Equipamento será entregue no dia...'}
                  className="mt-2"
                  rows={3}
                  required={modo === 'rejeitar'}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={fecharDialog} className="flex-1">
                  Cancelar
                </Button>
                {modo === 'rejeitar' ? (
                  <Button
                    onClick={() => rejeitarMutation.mutate(selectedSol)}
                    disabled={!texto.trim() || isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {rejeitarMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => aprovarMutation.mutate(selectedSol)}
                    disabled={isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {aprovarMutation.isPending ? 'Aprovando...' : 'Confirmar Aprovação'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
