import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import {
  Plus,
  Wrench,
  Calendar as CalendarIcon,
  DollarSign,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function ManutencaoEquipamento() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 15;
  const [formData, setFormData] = useState({
    equipamento_id: '',
    tipo: 'preventiva',
    data_programada: null,
    descricao: '',
    prioridade: 'media',
    custo_mao_obra: 0,
    custo_pecas: 0,
    observacoes: ''
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes-equipamento'],
    queryFn: () => base44.entities.ManutencaoEquipamento.list('-created_date', 100)
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const criarManutencaoMutation = useMutation({
    mutationFn: (data) => base44.entities.ManutencaoEquipamento.create(data),
    onSuccess: () => {
      toast.success('Manutenção agendada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['manutencoes-equipamento'] });
      setDialogOpen(false);
      limparFormulario();
    },
    onError: (error) => {
      toast.error('Erro ao agendar manutenção: ' + error.message);
    }
  });

  const concluirManutencaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ManutencaoEquipamento.update(id, data),
    onSuccess: () => {
      toast.success('Manutenção concluída!');
      queryClient.invalidateQueries({ queryKey: ['manutencoes-equipamento'] });
    },
    onError: (error) => {
      toast.error('Erro ao concluir manutenção: ' + error.message);
    }
  });

  const limparFormulario = () => {
    setFormData({
      equipamento_id: '',
      tipo: 'preventiva',
      data_programada: null,
      descricao: '',
      prioridade: 'media',
      custo_mao_obra: 0,
      custo_pecas: 0,
      observacoes: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.equipamento_id || !formData.data_programada || !formData.descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const custo_total = Number(formData.custo_mao_obra || 0) + Number(formData.custo_pecas || 0);

    criarManutencaoMutation.mutate({
      ...formData,
      data_programada: format(formData.data_programada, 'yyyy-MM-dd'),
      custo_mao_obra: Number(formData.custo_mao_obra || 0),
      custo_pecas: Number(formData.custo_pecas || 0),
      custo_total,
      status: 'agendada',
      responsavel_tecnico: user?.email
    });
  };

  const handleConcluir = (manutencao) => {
    concluirManutencaoMutation.mutate({
      id: manutencao.id,
      data: {
        status: 'concluida',
        data_realizada: format(new Date(), 'yyyy-MM-dd')
      }
    });
  };

  // Estatísticas
  const stats = {
    agendadas: manutencoes.filter(m => m.status === 'agendada').length,
    emAndamento: manutencoes.filter(m => m.status === 'em_andamento').length,
    concluidas: manutencoes.filter(m => m.status === 'concluida').length,
    custoTotal: manutencoes.reduce((acc, m) => acc + (m.custo_total || 0), 0)
  };

  const statusConfig = {
    agendada: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
    em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
    concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
    cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' }
  };

  const prioridadeConfig = {
    baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
    media: { label: 'Média', color: 'bg-blue-100 text-blue-700' },
    alta: { label: 'Alta', color: 'bg-amber-100 text-amber-700' },
    urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700' }
  };

  const equipamentoOptions = useMemo(
    () => equipamentos.map(eq => ({ value: eq.id, label: eq.nome })),
    [equipamentos]
  );

  // Histórico ordenado (mais recente primeiro) + paginação
  const historico = useMemo(
    () => [...manutencoes].sort((a, b) => new Date(b.data_programada || 0) - new Date(a.data_programada || 0)),
    [manutencoes]
  );
  const totalPaginas = Math.max(1, Math.ceil(historico.length / ITENS_POR_PAGINA));
  const pClamp = Math.min(pagina, totalPaginas);
  const inicioPag = (pClamp - 1) * ITENS_POR_PAGINA;
  const historicoPag = historico.slice(inicioPag, inicioPag + ITENS_POR_PAGINA);

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Agendadas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.agendadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Em Andamento</p>
                <p className="text-2xl font-bold text-amber-600">{stats.emAndamento}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50">
                <Wrench className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Concluídas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.concluidas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Custo Total</p>
                <p className="text-xl font-bold text-purple-600">
                  {stats.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Agendar Manutenção (controlado pelo botão no cabeçalho do histórico) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar Nova Manutenção</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Equipamento *</Label>
                <ComboboxBusca
                  options={equipamentoOptions}
                  value={formData.equipamento_id}
                  onSelect={(v) => setFormData({...formData, equipamento_id: v})}
                  placeholder="Selecione o equipamento"
                  searchPlaceholder="Buscar equipamento..."
                />
              </div>

              <div>
                <Label className="mb-1 block">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({...formData, tipo: v})}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                    <SelectItem value="preditiva">Preditiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Data Programada *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-11 justify-start font-normal border-gray-300">
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                      {formData.data_programada ? 
                        format(formData.data_programada, 'PPP', { locale: ptBR }) : 
                        'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.data_programada}
                      onSelect={(date) => setFormData({...formData, data_programada: date})}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="mb-1 block">Prioridade</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(v) => setFormData({...formData, prioridade: v})}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Custo Mão de Obra (R$)</Label>
                <Input
                  className="h-11"
                  type="number"
                  step="0.01"
                  value={formData.custo_mao_obra}
                  onChange={(e) => setFormData({...formData, custo_mao_obra: e.target.value})}
                />
              </div>

              <div>
                <Label className="mb-1 block">Custo Peças (R$)</Label>
                <Input
                  className="h-11"
                  type="number"
                  step="0.01"
                  value={formData.custo_pecas}
                  onChange={(e) => setFormData({...formData, custo_pecas: e.target.value})}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="mb-1 block">Descrição *</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Descreva a manutenção"
                  rows={3}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="mb-1 block">Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                  placeholder="Observações adicionais"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarManutencaoMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {criarManutencaoMutation.isPending ? 'Agendando...' : 'Agendar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Histórico de Manutenções */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-gray-900">Histórico de Manutenções</CardTitle>
          <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Agendar Manutenção
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <ClipboardList className="w-10 h-10" />
              <p className="text-sm text-gray-500">Nenhuma manutenção registrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Equipamento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Descrição</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Prioridade</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Programada</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Custo</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historicoPag.map(manutencao => {
                      const equipamento = equipamentos.find(e => e.id === manutencao.equipamento_id);
                      const status = statusConfig[manutencao.status];
                      const prioridade = prioridadeConfig[manutencao.prioridade];
                      return (
                        <tr key={manutencao.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{equipamento?.nome || 'Equipamento'}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={manutencao.descricao}>{manutencao.descricao}</td>
                          <td className="px-4 py-3 text-center"><Badge variant="outline" className="capitalize">{manutencao.tipo}</Badge></td>
                          <td className="px-4 py-3 text-center"><Badge className={`border-0 ${prioridade?.color}`}>{prioridade?.label}</Badge></td>
                          <td className="px-4 py-3 text-center"><Badge className={`border-0 ${status?.color}`}>{status?.label}</Badge></td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{manutencao.data_programada ? format(new Date(manutencao.data_programada), 'dd/MM/yyyy') : '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{manutencao.custo_total > 0 ? manutencao.custo_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {manutencao.status === 'agendada' && (
                              <Button size="sm" onClick={() => handleConcluir(manutencao)} disabled={concluirManutencaoMutation.isPending} className="h-8 bg-emerald-600 hover:bg-emerald-700">
                                Concluir
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {historico.length > ITENS_POR_PAGINA && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">Mostrando {inicioPag + 1}–{Math.min(inicioPag + ITENS_POR_PAGINA, historico.length)} de {historico.length}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pClamp <= 1} onClick={() => setPagina(Math.max(1, pClamp - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                    <span className="text-xs text-gray-600">Página {pClamp} de {totalPaginas}</span>
                    <Button variant="outline" size="sm" disabled={pClamp >= totalPaginas} onClick={() => setPagina(Math.min(totalPaginas, pClamp + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}