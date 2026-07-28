import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Calendar as CalendarIcon, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const ITENS_POR_PAGINA = 15;
const PRIO_BADGE = {
  baixa: 'bg-gray-100 text-gray-700 border-0',
  media: 'bg-blue-100 text-blue-700 border-0',
  alta: 'bg-amber-100 text-amber-700 border-0',
  critica: 'bg-red-100 text-red-700 border-0',
};
const STATUS_BADGE = {
  pendente: 'bg-amber-100 text-amber-700 border-0',
  aprovada: 'bg-emerald-100 text-emerald-700 border-0',
  rejeitada: 'bg-red-100 text-red-700 border-0',
  cancelada: 'bg-gray-100 text-gray-700 border-0',
};
const STATUS_LABEL = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada', cancelada: 'Cancelada' };

export default function AgendamentoEquipamento() {
  const queryClient = useQueryClient();
  const [selectedEquipamento, setSelectedEquipamento] = useState('');
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [obra, setObra] = useState('');
  const [motivo, setMotivo] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [pagina, setPagina] = useState(1);

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos-ativos'],
    queryFn: () => base44.entities.Equipamento.filter({ status: 'ativo' })
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000)
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-equipamento'],
    queryFn: () => base44.entities.SolicitacaoEquipamento.list('-created_date', 500)
  });

  const criarReservaMutation = useMutation({
    mutationFn: (data) => base44.entities.SolicitacaoEquipamento.create(data),
    onSuccess: () => {
      toast.success('Solicitação criada! Aguardando aprovação.');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-equipamento'] });
      limparFormulario();
    },
    onError: (error) => toast.error('Erro ao criar solicitação: ' + error.message)
  });

  const limparFormulario = () => {
    setSelectedEquipamento(''); setDataInicio(null); setDataFim(null);
    setObra(''); setMotivo(''); setPrioridade('media');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedEquipamento || !dataInicio || !dataFim || !obra || !motivo) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (new Date(dataFim) < new Date(dataInicio)) {
      toast.error('Data de fim deve ser posterior à data de início');
      return;
    }
    criarReservaMutation.mutate({
      equipamento_id: selectedEquipamento,
      obra_id: obra,
      tipo_solicitacao: 'proprio',
      data_inicio: format(dataInicio, 'yyyy-MM-dd'),
      data_fim: format(dataFim, 'yyyy-MM-dd'),
      motivo,
      prioridade,
      status: 'pendente',
      solicitante_email: user?.email
    });
  };

  const verificarDisponibilidade = (equipamentoId, inicio, fim) => {
    if (!equipamentoId || !inicio || !fim) return { disponivel: true, conflitos: [] };
    const conflitos = solicitacoes.filter(r => {
      // Considera apenas solicitações ativas (não rejeitadas/canceladas) para conflito.
      if (r.equipamento_id !== equipamentoId) return false;
      if (['rejeitada', 'cancelada'].includes(r.status)) return false;
      const reservaInicio = new Date(r.data_inicio);
      const reservaFim = new Date(r.data_fim);
      return (inicio <= reservaFim && fim >= reservaInicio);
    });
    return { disponivel: conflitos.length === 0, conflitos };
  };

  const disponibilidade = verificarDisponibilidade(selectedEquipamento, dataInicio, dataFim);

  const equipamentoOptions = useMemo(
    () => equipamentos.map(eq => ({ value: eq.id, label: `${eq.nome}${eq.tipo ? ' - ' + eq.tipo : ''}` })),
    [equipamentos]
  );
  const obraOptions = useMemo(() => obras.map(o => ({ value: o.id, label: o.nome })), [obras]);

  const totalPaginas = Math.max(1, Math.ceil(solicitacoes.length / ITENS_POR_PAGINA));
  const pClamp = Math.min(pagina, totalPaginas);
  const inicio = (pClamp - 1) * ITENS_POR_PAGINA;
  const solicitacoesPag = solicitacoes.slice(inicio, inicio + ITENS_POR_PAGINA);

  return (
    <div className="space-y-6">
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Agendar Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Equipamento *</Label>
                <ComboboxBusca
                  options={equipamentoOptions}
                  value={selectedEquipamento}
                  onSelect={setSelectedEquipamento}
                  placeholder="Selecione o equipamento"
                  searchPlaceholder="Buscar equipamento..."
                />
              </div>

              <div>
                <Label className="mb-1 block">Obra *</Label>
                <ComboboxBusca
                  options={obraOptions}
                  value={obra}
                  onSelect={setObra}
                  placeholder="Selecione a obra"
                  searchPlaceholder="Buscar obra..."
                />
              </div>

              <div>
                <Label className="mb-1 block">Data de Início *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-11 justify-start text-left font-normal border-gray-300">
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                      {dataInicio ? format(dataInicio, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="mb-1 block">Data de Fim *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-11 justify-start text-left font-normal border-gray-300">
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                      {dataFim ? format(dataFim, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} disabled={(date) => dataInicio && date < dataInicio} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="mb-1 block">Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label className="mb-1 block">Motivo / Justificativa *</Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo da solicitação" rows={3} />
              </div>
            </div>

            {selectedEquipamento && dataInicio && dataFim && (
              <div className={`p-4 rounded-lg border ${disponibilidade.disponivel ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {disponibilidade.disponivel ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <p className="text-emerald-700 font-medium">Equipamento disponível no período selecionado</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-red-700 font-medium">Conflito de agendamento</p>
                        <p className="text-red-600 text-sm mt-1">Este equipamento já possui {disponibilidade.conflitos.length} reserva(s) no período</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={limparFormulario}>Limpar</Button>
              <Button type="submit" disabled={criarReservaMutation.isPending || !disponibilidade.disponivel} className="bg-blue-600 hover:bg-blue-700">
                {criarReservaMutation.isPending ? 'Criando...' : 'Criar Solicitação'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Solicitações */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Solicitações de Equipamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {solicitacoes.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Nenhuma solicitação registrada</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-3 text-left text-xs font-semibold text-gray-500">Equipamento</th>
                      <th className="p-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                      <th className="p-3 text-left text-xs font-semibold text-gray-500">Período</th>
                      <th className="p-3 text-center text-xs font-semibold text-gray-500">Prioridade</th>
                      <th className="p-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {solicitacoesPag.map(sol => {
                      const equipamento = equipamentos.find(e => e.id === sol.equipamento_id);
                      const obraSol = obras.find(o => o.id === sol.obra_id);
                      return (
                        <tr key={sol.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{equipamento?.nome || 'Equipamento'}</td>
                          <td className="p-3 text-gray-600">{obraSol?.nome || '—'}</td>
                          <td className="p-3 text-gray-600">
                            {sol.data_inicio ? format(new Date(sol.data_inicio), 'dd/MM/yyyy') : '—'} – {sol.data_fim ? format(new Date(sol.data_fim), 'dd/MM/yyyy') : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={PRIO_BADGE[sol.prioridade] || 'bg-gray-100 text-gray-700 border-0'}>{sol.prioridade}</Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={STATUS_BADGE[sol.status] || 'bg-gray-100 text-gray-700 border-0'}>{STATUS_LABEL[sol.status] || sol.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {solicitacoes.length > ITENS_POR_PAGINA && (
                <div className="flex items-center justify-between p-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Mostrando {inicio + 1}–{Math.min(inicio + ITENS_POR_PAGINA, solicitacoes.length)} de {solicitacoes.length}</span>
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
