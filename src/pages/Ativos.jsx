import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Eye, Trash2, Clock, Pencil, CheckCircle2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import AtivoForm from '../components/ativos/AtivoForm';
import AbastecimentosTab from '../components/ativos/AbastecimentosTab';
import AtivoDetalhes from '../components/ativos/AtivoDetalhes';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AtivosPage() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [ativoSelecionado, setAtivoSelecionado] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroLocalizacao, setFiltroLocalizacao] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const queryClient = useQueryClient();

  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 100)
  });


  const deletarMutation = useMutation({
    mutationFn: async (ativoObj) => {
      // Mantém a sincronia: se houver veículo de frota vinculado, exclui junto.
      if (ativoObj?.veiculo_id) {
        await base44.entities.Veiculo.delete(ativoObj.veiculo_id).catch(() => {});
      }
      // Se houver equipamento (módulo operacional) espelhado, exclui junto.
      if (ativoObj?.equipamento_id) {
        await base44.entities.Equipamento.delete(ativoObj.equipamento_id).catch(() => {});
      }
      await base44.entities.Ativo.delete(ativoObj.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ativos']);
      queryClient.invalidateQueries(['veiculos']);
      queryClient.invalidateQueries(['equipamentos']);
      toast.success('Ativo excluído!');
      setConfirmarExclusao(null);
    }
  });

  const statusConfig = {
    disponivel: { color: 'bg-emerald-100 text-emerald-700', label: 'Disponível' },
    em_uso: { color: 'bg-blue-100 text-blue-700', label: 'Em Uso' },
    manutencao: { color: 'bg-amber-100 text-amber-700', label: 'Manutenção' },
    inativo: { color: 'bg-gray-100 text-gray-700', label: 'Inativo' },
    descartado: { color: 'bg-red-100 text-red-700', label: 'Descartado' }
  };

  const localizacaoConfig = {
    almoxarifado: 'Almoxarifado',
    em_obra: 'Em Obra',
    em_transito: 'Em Trânsito'
  };

  const ativosFiltrados = ativos.filter(ativo => {
    const matchStatus = filtroStatus === 'todos' || ativo.status === filtroStatus;
    const matchLocal = filtroLocalizacao === 'todos' || ativo.localizacao_atual === filtroLocalizacao;
    const matchTipo = filtroTipo === 'todos' || ativo.tipo === filtroTipo;
    return matchStatus && matchLocal && matchTipo;
  });

  // Paginação
  const pagAtivos = usePagination(ativosFiltrados, 20);
  const ativosPag = pagAtivos.paginatedItems;
  const filtrosAtivosCount = (filtroStatus !== 'todos' ? 1 : 0) + (filtroLocalizacao !== 'todos' ? 1 : 0) + (filtroTipo !== 'todos' ? 1 : 0);
  const limparFiltros = () => { setFiltroStatus('todos'); setFiltroLocalizacao('todos'); setFiltroTipo('todos'); };

  const stats = {
    total: ativos.length,
    disponiveis: ativos.filter(a => a.status === 'disponivel').length,
    em_uso: ativos.filter(a => a.status === 'em_uso').length,
    manutencao: ativos.filter(a => a.status === 'manutencao').length
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Ativos"
        subtitle="Ferramentas, equipamentos e máquinas da empresa"
        action={() => {
          setAtivoSelecionado(null);
          setDialogAberto(true);
        }}
        actionLabel="Novo Ativo"
        actionIcon={Plus}
      />

      <Tabs defaultValue="ativos" className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="abastecimentos">
          <AbastecimentosTab />
        </TabsContent>

        <TabsContent value="ativos" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs sm:text-sm text-gray-500">Total</p><p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{stats.total}</p></div>
                  <Package className="w-8 h-8 text-gray-400 opacity-40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs sm:text-sm text-gray-500">Disponíveis</p><p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{stats.disponiveis}</p></div>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs sm:text-sm text-gray-500">Em Uso</p><p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{stats.em_uso}</p></div>
                  <Clock className="w-8 h-8 text-blue-500 opacity-40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs sm:text-sm text-gray-500">Manutenção</p><p className="text-lg sm:text-2xl font-bold text-amber-600 mt-1 tabular-nums">{stats.manutencao}</p></div>
                  <Wrench className="w-8 h-8 text-amber-500 opacity-40" />
                </div>
              </CardContent>
            </Card>
          </div>

          <FiltrosColapsaveis ativos={filtrosAtivosCount} onLimpar={limparFiltros} rodape={<span className="text-xs text-gray-500">{ativosFiltrados.length} ativo(s)</span>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                <ComboboxBusca
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'disponivel', label: 'Disponível' },
                    { value: 'em_uso', label: 'Em Uso' },
                    { value: 'manutencao', label: 'Manutenção' },
                    { value: 'inativo', label: 'Inativo' },
                  ]}
                  value={filtroStatus}
                  onSelect={(v) => setFiltroStatus(v || 'todos')}
                  placeholder="Todos" searchPlaceholder="Buscar status..." emptyMessage="—"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Localização</Label>
                <ComboboxBusca
                  options={[
                    { value: 'todos', label: 'Todas' },
                    { value: 'almoxarifado', label: 'Almoxarifado' },
                    { value: 'em_obra', label: 'Em Obra' },
                    { value: 'em_transito', label: 'Em Trânsito' },
                  ]}
                  value={filtroLocalizacao}
                  onSelect={(v) => setFiltroLocalizacao(v || 'todos')}
                  placeholder="Todas" searchPlaceholder="Buscar localização..." emptyMessage="—"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Tipo</Label>
                <ComboboxBusca
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'ferramenta', label: 'Ferramenta' },
                    { value: 'equipamento', label: 'Equipamento' },
                    { value: 'maquina', label: 'Máquina' },
                    { value: 'veiculo_pequeno', label: 'Veículo Pequeno' },
                  ]}
                  value={filtroTipo}
                  onSelect={(v) => setFiltroTipo(v || 'todos')}
                  placeholder="Todos" searchPlaceholder="Buscar tipo..." emptyMessage="—"
                />
              </div>
            </div>
          </FiltrosColapsaveis>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {ativosFiltrados.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum ativo encontrado</p>
                </div>
              ) : (
                <>
                  {/* Cards mobile */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {ativosPag.map(ativo => (
                      <div key={ativo.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{ativo.nome}</p>
                            <p className="text-xs text-gray-500">{ativo.codigo || '—'} · <span className="capitalize">{(ativo.tipo || '').replace(/_/g, ' ')}</span></p>
                          </div>
                          <Badge className={`border-0 flex-shrink-0 ${statusConfig[ativo.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                            {statusConfig[ativo.status]?.label || ativo.status || '-'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>{localizacaoConfig[ativo.localizacao_atual] || '—'}</span>
                          <span className="text-gray-700">{ativo.valor_aquisicao ? `R$ ${ativo.valor_aquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</span>
                        </div>
                        <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => { setAtivoSelecionado(ativo); setDetalhesAberto(true); }}><Eye className="w-4 h-4" /> Ver</Button>
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => { setAtivoSelecionado(ativo); setDialogAberto(true); }}><Pencil className="w-4 h-4" /> Editar</Button>
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirmarExclusao(ativo)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Ativo</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Código</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Tipo</th>
                          <th className="text-center p-3 text-xs font-semibold text-gray-500">Status</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Localização</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ativosPag.map(ativo => (
                          <tr key={ativo.id} className="hover:bg-gray-50">
                            <td className="p-3">
                              <div className="font-medium text-gray-900">{ativo.nome}</div>
                              {(ativo.marca || ativo.numero_serie) && (
                                <div className="text-xs text-gray-500">{[ativo.marca, ativo.modelo].filter(Boolean).join(' ')}{ativo.numero_serie ? ` · SN: ${ativo.numero_serie}` : ''}</div>
                              )}
                            </td>
                            <td className="p-3 text-gray-600">{ativo.codigo || '-'}</td>
                            <td className="p-3 text-gray-600 capitalize">{(ativo.tipo || '-').replace(/_/g, ' ')}</td>
                            <td className="p-3 text-center">
                              <Badge className={`border-0 ${statusConfig[ativo.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                                {statusConfig[ativo.status]?.label || ativo.status || '-'}
                              </Badge>
                            </td>
                            <td className="p-3 text-gray-600">{localizacaoConfig[ativo.localizacao_atual] || '-'}</td>
                            <td className="p-3 text-right text-gray-700">
                              {ativo.valor_aquisicao ? `R$ ${ativo.valor_aquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Ver" onClick={() => { setAtivoSelecionado(ativo); setDetalhesAberto(true); }}>
                                  <Eye className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar" onClick={() => { setAtivoSelecionado(ativo); setDialogAberto(true); }}>
                                  <Pencil className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Excluir" onClick={() => setConfirmarExclusao(ativo)}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pagination currentPage={pagAtivos.currentPage} totalPages={pagAtivos.totalPages} onPageChange={pagAtivos.goToPage} startIndex={pagAtivos.startIndex} endIndex={pagAtivos.endIndex} totalItems={pagAtivos.totalItems} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <AtivoForm
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        ativo={ativoSelecionado}
      />

      <AtivoDetalhes
        open={detalhesAberto}
        onOpenChange={setDetalhesAberto}
        ativo={ativoSelecionado}
      />

      <AlertDialog open={!!confirmarExclusao} onOpenChange={() => setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{confirmarExclusao?.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletarMutation.mutate(confirmarExclusao)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}