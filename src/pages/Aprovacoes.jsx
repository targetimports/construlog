import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, X, Eye, Clock, Shield, History, Settings, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DialogProcessarAprovacao from '../components/aprovacoes/DialogProcessarAprovacao';
import DetalhesOrdemCompra from '../components/compras/DetalhesOrdemCompra';
import FiltroAplicadoBanner from '../components/shared/FiltroAplicadoBanner';
import HistoricoAprovacao from '../components/aprovacoes/HistoricoAprovacao';
import ConfigAlcadas from '../components/aprovacoes/ConfigAlcadas';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function Aprovacoes() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pendentes');
  const [filtros, setFiltros] = useState({
    modulo: '',
    status: 'pendente',
    nivel: '',
    obra_id: '',
    de: '',
    ate: ''
  });
  const [dialogProcessar, setDialogProcessar] = useState(null);
  const [detalhesOc, setDetalhesOc] = useState(null);
  const [historicoDialog, setHistoricoDialog] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user-aprovacoes'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000
  });

  const isAdmin = user?.role === 'admin' || user?.cargo === 'diretor';

  // Query aprovações via backend
  const { data: listagemResp, isLoading } = useQuery({
    queryKey: ['aprovacoes', filtros],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarAprovacoes', filtros);
      return res.data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  // Query logs de auditoria
  const { data: logsAuditoria = [] } = useQuery({
    queryKey: ['logs-auditoria-aprovacoes'],
    queryFn: () => base44.entities.LogAuditoriaSistema.filter(
      { entidade: 'Aprovacao' },
      '-data_hora',
      50
    ),
    enabled: activeTab === 'auditoria'
  });

  const processarMutation = useMutation({
    mutationFn: async (payload) => {
      return await base44.functions.invoke('processarAprovacaoHierarquica', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
      setDialogProcessar(null);
      const data = res.data;
      if (data.status === 'aprovado') {
        toast.success('Aprovação concedida — todos os níveis concluídos!');
      } else if (data.status === 'escalado') {
        toast.success(`Aprovado no N${data.nivel_anterior}, escalado para N${data.nivel_novo}`);
      } else if (data.status === 'rejeitado') {
        toast.info('Solicitação rejeitada');
      } else {
        toast.success('Processado com sucesso');
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.message);
    }
  });

  const statusBadgeConfig = {
    pendente: { label: 'Pendente', cor: 'bg-yellow-100 text-yellow-800' },
    aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-800' },
    rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-800' },
    cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-800' },
    escalado: { label: 'Escalado', cor: 'bg-blue-100 text-blue-800' }
  };

  const temFiltroAplicado = Object.values(filtros).some(v => v && v !== 'pendente');

  // KPIs
  const items = listagemResp?.items || [];
  const totalPendentes = items.filter(a => a.status === 'pendente').length;
  const totalAprovadas = items.filter(a => a.status === 'aprovado').length;
  const totalRejeitadas = items.filter(a => a.status === 'rejeitado').length;
  const valorPendente = items.filter(a => a.status === 'pendente').reduce((s, a) => s + (a.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Aprovações
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Gerenciar hierarquia de aprovação para compras e pagamentos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendentes" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Aprovações
            {totalPendentes > 0 && <Badge className="bg-yellow-100 text-yellow-700 ml-1">{totalPendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <History className="w-3.5 h-3.5" /> Auditoria
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="config" className="gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Configurar Alçadas
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: Aprovações */}
        <TabsContent value="pendentes" className="space-y-4 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Pendentes', value: totalPendentes, cor: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Valor Pendente', value: `R$ ${valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, cor: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Aprovadas', value: totalAprovadas, cor: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Rejeitadas', value: totalRejeitadas, cor: 'text-red-600', bg: 'bg-red-50' }
            ].map(kpi => (
              <Card key={kpi.label} className={cn("border", kpi.bg)}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500 font-medium">{kpi.label}</p>
                  <p className={cn("text-xl font-bold mt-1", kpi.cor)}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {temFiltroAplicado && (
            <FiltroAplicadoBanner
              filtros={{ obra: filtros.obra_id, de: filtros.de, ate: filtros.ate }}
              onLimpar={() => setFiltros({ modulo: '', status: 'pendente', nivel: '', obra_id: '', de: '', ate: '' })}
            />
          )}

          {/* Filtros */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Select value={filtros.modulo || 'todos'} onValueChange={v => setFiltros({...filtros, modulo: v === 'todos' ? '' : v})}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Módulo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Módulos</SelectItem>
                    <SelectItem value="compras">Compras</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtros.status} onValueChange={v => setFiltros({...filtros, status: v})}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtros.nivel || 'todos'} onValueChange={v => setFiltros({...filtros, nivel: v === 'todos' ? '' : v})}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Nível" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Níveis</SelectItem>
                    <SelectItem value="N1">N1</SelectItem>
                    <SelectItem value="N2">N2</SelectItem>
                    <SelectItem value="N3">N3</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={filtros.de} onChange={e => setFiltros({...filtros, de: e.target.value})} className="text-sm" />
                <Input type="date" value={filtros.ate} onChange={e => setFiltros({...filtros, ate: e.target.value})} className="text-sm" />
                <Button variant="outline" size="sm" onClick={() => setFiltros({ modulo: '', status: 'pendente', nivel: '', obra_id: '', de: '', ate: '' })}>
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Aprovações ({listagemResp?.total || 0})</CardTitle>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && items.length === 0 ? (
                <TableSkeleton bare rows={6} cols={8} />
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Nível</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Descrição</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Módulo</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">Valor</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Solicitante</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Data</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? items.map(aprov => {
                      const config = statusBadgeConfig[aprov.status] || statusBadgeConfig.pendente;
                      const horasRestantes = aprov.prazo_expira_em
                        ? Math.max(0, Math.round((new Date(aprov.prazo_expira_em) - new Date()) / (1000 * 60 * 60)))
                        : null;
                      const isUrgente = horasRestantes !== null && horasRestantes < 12;

                      return (
                        <tr key={aprov.id} className={cn("border-b border-gray-100 hover:bg-gray-50", isUrgente && aprov.status === 'pendente' && "bg-amber-50/50")}>
                          <td className="py-3 px-3">
                            <Badge className={cn("text-xs",
                              aprov.nivel === 'N1' ? "bg-blue-100 text-blue-700" :
                              aprov.nivel === 'N2' ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {aprov.nivel || 'N1'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-900 max-w-[200px] truncate">{aprov.descricao}</div>
                            <div className="text-xs text-gray-500">{aprov.referencia_tipo}</div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-xs">{aprov.modulo === 'financeiro' ? 'Financeiro' : 'Compras'}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">
                            R$ {(aprov.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <Badge className={config.cor}>{config.label}</Badge>
                              {isUrgente && aprov.status === 'pendente' && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-600 text-xs">
                            {aprov.solicitado_nome || aprov.solicitado_por}
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">
                            {aprov.solicitado_em ? new Date(aprov.solicitado_em).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {aprov.status === 'pendente' && (
                                <>
                                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                                    onClick={() => setDialogProcessar({...aprov, acao: 'aprovar'})}
                                    disabled={processarMutation.isPending}>
                                    <CheckCircle2 className="w-3 h-3" /> Aprovar
                                  </Button>
                                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs text-red-600 hover:text-red-700"
                                    onClick={() => setDialogProcessar({...aprov, acao: 'reprovar'})}
                                    disabled={processarMutation.isPending}>
                                    <X className="w-3 h-3" /> Rejeitar
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => setHistoricoDialog(aprov)}>
                                <History className="w-3.5 h-3.5" />
                              </Button>
                              {aprov.referencia_tipo === 'OrdemCompra' && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                  onClick={() => setDetalhesOc({ id: aprov.referencia_id, open: true })}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="8" className="py-12 text-center text-gray-500">
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          ) : (
                            <>
                              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Nenhuma aprovação encontrada</p>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Auditoria */}
        <TabsContent value="auditoria" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" />
                Log de Auditoria de Aprovações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Data/Hora</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Operação</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Usuário</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Detalhes</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsAuditoria.map(log => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 text-xs text-gray-600">
                          {log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={cn("text-xs",
                            log.operacao === 'aprovar' ? "bg-green-100 text-green-700" :
                            log.operacao === 'rejeitar' ? "bg-red-100 text-red-700" :
                            "bg-blue-100 text-blue-700"
                          )}>
                            {log.operacao}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-700">{log.usuario_id}</td>
                        <td className="py-3 px-3 text-xs text-gray-500 max-w-[300px] truncate">
                          {log.dados_depois ? JSON.stringify(log.dados_depois).substring(0, 100) : '-'}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-500">{log.origem_funcao}</td>
                      </tr>
                    ))}
                    {logsAuditoria.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-gray-500 text-sm">
                          Nenhum log de auditoria encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Configurar Alçadas */}
        {isAdmin && (
          <TabsContent value="config" className="mt-4">
            <ConfigAlcadas />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog Processar */}
      {dialogProcessar && (
        <DialogProcessarAprovacao
          aprovacao={dialogProcessar}
          open={!!dialogProcessar}
          onClose={() => setDialogProcessar(null)}
          onProcessar={(payload) => processarMutation.mutate(payload)}
          isLoading={processarMutation.isPending}
        />
      )}

      {/* Dialog Detalhes OC */}
      {detalhesOc && (
        <DetalhesOrdemCompra
          oc_id={detalhesOc.id}
          open={detalhesOc.open}
          onClose={() => setDetalhesOc(null)}
        />
      )}

      {/* Dialog Histórico */}
      {historicoDialog && (
        <Dialog open={!!historicoDialog} onOpenChange={() => setHistoricoDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Histórico de Aprovação</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-sm font-medium">{historicoDialog.descricao}</p>
                <p className="text-xs text-gray-500 mt-1">
                  R$ {(historicoDialog.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <HistoricoAprovacao
                historico={historicoDialog.historico_aprovacoes || []}
                nivelAtual={historicoDialog.nivel_atual || 1}
                nivelMaximo={historicoDialog.nivel_maximo || 1}
                status={historicoDialog.status}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Import Dialog for inline use
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';