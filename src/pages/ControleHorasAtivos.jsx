import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Clock, Plus, Check, Trash2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

const POR_PAGINA = 15;
const REG_VAZIO = {
  ativo_id: '', obra_id: '', operador: '', data: new Date().toISOString().split('T')[0],
  horimetro_inicial: 0, horimetro_final: 0, custo_hora: 0, servico_executado: '',
};
const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ControleHorasAtivos() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [regExcluir, setRegExcluir] = useState(null);
  const [novoRegistro, setNovoRegistro] = useState(REG_VAZIO);
  const queryClient = useQueryClient();

  const { data: registros = [] } = useQuery({
    queryKey: ['horas-ativos'],
    queryFn: () => base44.entities.HorasAtivo.list('-data', 500),
  });
  const { data: ativos = [] } = useQuery({ queryKey: ['ativos'], queryFn: () => base44.entities.Ativo.list() });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });

  const criarMutation = useMutation({
    mutationFn: (data) => {
      const horasTrabalhadas = (Number(data.horimetro_final) || 0) - (Number(data.horimetro_inicial) || 0);
      return base44.entities.HorasAtivo.create({
        ...data,
        horas_trabalhadas: horasTrabalhadas,
        custo_total: horasTrabalhadas * (Number(data.custo_hora) || 0),
        validado: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['horas-ativos']);
      toast.success('Horas registradas com sucesso!');
      setDialogAberto(false);
      setNovoRegistro(REG_VAZIO);
    },
    onError: (e) => toast.error('Erro ao registrar: ' + (e?.message || 'tente novamente')),
  });

  const validarMutation = useMutation({
    mutationFn: (id) => base44.entities.HorasAtivo.update(id, { validado: true }),
    onSuccess: () => { queryClient.invalidateQueries(['horas-ativos']); toast.success('Registro validado!'); },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.HorasAtivo.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['horas-ativos']); toast.success('Registro excluído!'); setRegExcluir(null); },
    onError: (e) => { toast.error('Erro ao excluir: ' + e.message); setRegExcluir(null); },
  });

  const registrosFiltrados = useMemo(() => registros.filter((r) => {
    if (filtroStatus === 'pendentes') return !r.validado;
    if (filtroStatus === 'validados') return r.validado;
    return true;
  }), [registros, filtroStatus]);

  const totalHoras = registrosFiltrados.reduce((s, r) => s + (r.horas_trabalhadas || 0), 0);
  const custoTotal = registrosFiltrados.reduce((s, r) => s + (r.custo_total || 0), 0);
  const mediaHoras = registrosFiltrados.length ? (totalHoras / registrosFiltrados.length).toFixed(1) : 0;
  const custoMedio = registros.length ? custoTotal / registros.length : 0;
  const pendentes = registros.filter((r) => !r.validado).length;
  const validados = registros.filter((r) => r.validado).length;

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const pageItens = registrosFiltrados.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);
  const setFiltro = (f) => { setFiltroStatus(f); setPagina(1); };

  const horasCalc = (Number(novoRegistro.horimetro_final) || 0) - (Number(novoRegistro.horimetro_inicial) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Horas - Ativos"
        subtitle="Horímetro de equipamentos, máquinas e implementos"
        action={() => { setNovoRegistro(REG_VAZIO); setDialogAberto(true); }}
        actionLabel="Registrar Horas"
        actionIcon={Plus}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Registros Totais</div>
            <div className="text-2xl font-bold text-gray-900">{registros.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Total de Horas</div>
            <div className="text-2xl font-bold text-blue-600">{totalHoras.toFixed(1)}h</div>
            <p className="text-xs text-gray-400 mt-1">Média: {mediaHoras}h/operação</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Custo Total</div>
            <div className="text-2xl font-bold text-emerald-600">{fmtBRL(custoTotal)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Custo Médio</div>
            <div className="text-2xl font-bold text-amber-600">{fmtBRL(custoMedio)}</div>
            <p className="text-xs text-gray-400 mt-1">Por operação</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 mr-1">Filtrar:</span>
        <Button variant={filtroStatus === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => setFiltro('todos')} className={filtroStatus === 'todos' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700'}>Todos ({registros.length})</Button>
        <Button variant={filtroStatus === 'pendentes' ? 'default' : 'outline'} size="sm" onClick={() => setFiltro('pendentes')} className={filtroStatus === 'pendentes' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700'}>Pendentes ({pendentes})</Button>
        <Button variant={filtroStatus === 'validados' ? 'default' : 'outline'} size="sm" onClick={() => setFiltro('validados')} className={filtroStatus === 'validados' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700'}>Validados ({validados})</Button>
      </div>

      {/* Lista */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {registrosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhum registro de horas</h3>
              <p className="text-sm text-gray-500 mb-5">Registre as horas de um equipamento</p>
              <Button onClick={() => { setNovoRegistro(REG_VAZIO); setDialogAberto(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Registrar Horas</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Ativo</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Operador</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Horas</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Custo/Hora</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Custo Total</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((reg) => {
                      const ativo = ativos.find((a) => a.id === reg.ativo_id);
                      const obra = obras.find((o) => o.id === reg.obra_id);
                      const custoHora = reg.horas_trabalhadas ? (reg.custo_total || 0) / reg.horas_trabalhadas : (reg.custo_hora || 0);
                      return (
                        <tr key={reg.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{ativo?.nome || 'Ativo'}</p>
                            {reg.servico_executado && <p className="text-xs text-gray-500">{reg.servico_executado}</p>}
                          </td>
                          <td className="p-3 text-gray-600">{reg.data ? new Date(reg.data).toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="p-3 text-gray-600">{reg.operador || '—'}</td>
                          <td className="p-3 text-gray-600">{obra?.nome || <span className="text-gray-400">Sem obra</span>}</td>
                          <td className="p-3 text-right text-blue-700 font-medium">{(reg.horas_trabalhadas || 0)}h</td>
                          <td className="p-3 text-right text-gray-600">{fmtBRL(custoHora)}</td>
                          <td className="p-3 text-right text-emerald-700 font-medium">{fmtBRL(reg.custo_total)}</td>
                          <td className="p-3">
                            {reg.validado
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Validado</Badge>
                              : <Badge className="bg-amber-100 text-amber-700 border-0">Pendente</Badge>}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              {!reg.validado && (
                                <>
                                  <Button size="icon" variant="ghost" title="Validar" onClick={() => validarMutation.mutate(reg.id)} disabled={validarMutation.isPending}><Check className="w-4 h-4 text-emerald-600" /></Button>
                                  <Button size="icon" variant="ghost" title="Excluir" onClick={() => setRegExcluir(reg)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">Mostrando {(pagAtual - 1) * POR_PAGINA + 1}–{Math.min(pagAtual * POR_PAGINA, registrosFiltrados.length)} de {registrosFiltrados.length}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagAtual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                  <span className="text-xs text-gray-600">Página {pagAtual} de {totalPaginas}</span>
                  <Button variant="outline" size="sm" disabled={pagAtual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog novo registro */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Horas de Ativo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Ativo *</Label>
                <ComboboxBusca
                  options={ativos.filter((a) => ['maquina', 'equipamento'].includes(a.tipo)).map((a) => ({ value: a.id, label: a.nome }))}
                  value={novoRegistro.ativo_id}
                  onSelect={(v) => setNovoRegistro({ ...novoRegistro, ativo_id: v })}
                  placeholder="Selecione o ativo"
                  searchPlaceholder="Buscar ativo..."
                  emptyMessage="Nenhuma máquina/equipamento cadastrado."
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Obra *</Label>
                <ComboboxBusca
                  options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                  value={novoRegistro.obra_id}
                  onSelect={(v) => setNovoRegistro({ ...novoRegistro, obra_id: v })}
                  placeholder="Selecione a obra"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Operador</Label>
                <Input className="h-11" placeholder="Nome do operador" value={novoRegistro.operador} onChange={(e) => setNovoRegistro({ ...novoRegistro, operador: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data *</Label>
                <Input type="date" className="h-11" value={novoRegistro.data} onChange={(e) => setNovoRegistro({ ...novoRegistro, data: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Horímetro Inicial *</Label>
                <Input type="number" className="h-11" value={novoRegistro.horimetro_inicial} onChange={(e) => setNovoRegistro({ ...novoRegistro, horimetro_inicial: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Horímetro Final *</Label>
                <Input type="number" className="h-11" value={novoRegistro.horimetro_final} onChange={(e) => setNovoRegistro({ ...novoRegistro, horimetro_final: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Horas</Label>
                <div className="h-11 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-md text-lg font-bold text-blue-700">{horasCalc.toFixed(1)}h</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo/Hora (R$) *</Label>
                <Input type="number" className="h-11" placeholder="0,00" value={novoRegistro.custo_hora} onChange={(e) => setNovoRegistro({ ...novoRegistro, custo_hora: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo Total Estimado</Label>
                <div className="h-11 flex items-center justify-center bg-emerald-50 border border-emerald-200 rounded-md text-lg font-bold text-emerald-700">{fmtBRL(horasCalc * (Number(novoRegistro.custo_hora) || 0))}</div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Serviço Executado</Label>
              <Input className="h-11" placeholder="Descrição do serviço..." value={novoRegistro.servico_executado} onChange={(e) => setNovoRegistro({ ...novoRegistro, servico_executado: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => criarMutation.mutate(novoRegistro)} disabled={!novoRegistro.ativo_id || !novoRegistro.obra_id || criarMutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" />{criarMutation.isPending ? 'Registrando...' : 'Registrar Horas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!regExcluir} onOpenChange={(o) => { if (!o) setRegExcluir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-600" /> Excluir registro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Tem certeza que deseja excluir este registro de horas? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegExcluir(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => deletarMutation.mutate(regExcluir.id)} disabled={deletarMutation.isPending} className="bg-red-600 hover:bg-red-700 gap-2"><Trash2 className="w-4 h-4" />{deletarMutation.isPending ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
