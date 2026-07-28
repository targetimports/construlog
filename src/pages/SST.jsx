import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';
import { AlertTriangle, Users, ClipboardCheck, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import AlertasSST from '../components/sst/AlertasSST';
import FormASOModal from '../components/sst/FormASOModal';
import FormTreinamentoModal from '../components/sst/FormTreinamentoModal';
import FormAcidenteModal from '../components/sst/FormAcidenteModal';
import FormAcaoCorretivaModal from '../components/sst/FormAcaoCorretivaModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' };

const gravidadeCfg = {
  leve: 'bg-blue-100 text-blue-700', moderado: 'bg-amber-100 text-amber-700',
  grave: 'bg-red-100 text-red-700', fatal: 'bg-red-200 text-red-800',
};
const acaoStatusCfg = {
  aberta: 'bg-amber-100 text-amber-700', em_andamento: 'bg-blue-100 text-blue-700',
  concluida: 'bg-emerald-100 text-emerald-700', cancelada: 'bg-gray-100 text-gray-600',
};
const prioridadeCfg = { baixa: 'text-gray-500', media: 'text-amber-600', alta: 'text-red-600', critica: 'text-red-700' };
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export default function SST() {
  const [searchTerm, setSearchTerm] = useState('');
  const [tabAtivo, setTabAtivo] = useState('colaboradores');
  const [asoModalOpen, setAsoModalOpen] = useState(false);
  const [treinoModalOpen, setTreinoModalOpen] = useState(false);
  const [acidenteModal, setAcidenteModal] = useState({ open: false, acidente: null });
  const [acidenteExcluir, setAcidenteExcluir] = useState(null);
  const [acaoModal, setAcaoModal] = useState({ open: false, acao: null });
  const [acaoExcluir, setAcaoExcluir] = useState(null);
  const qc = useQueryClient();

  const deleteAcidente = useMutation({
    mutationFn: (id) => base44.entities.AcidenteTrabalho.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acidentes'] }); toast.success('Acidente excluído!'); setAcidenteExcluir(null); },
    onError: (e) => { toast.error('Erro ao excluir: ' + e.message); setAcidenteExcluir(null); },
  });

  const deleteAcao = useMutation({
    mutationFn: (id) => base44.entities.AcaoCorretiva.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acoes-corretivas'] }); toast.success('Ação excluída!'); setAcaoExcluir(null); },
    onError: (e) => { toast.error('Erro ao excluir: ' + e.message); setAcaoExcluir(null); },
  });

  const { data: colaboradores = [] } = useQuery({ queryKey: ['colaboradores'], queryFn: () => base44.entities.Colaborador.list() });
  const { data: asos = [] } = useQuery({ queryKey: ['asos'], queryFn: () => base44.entities.ASO.list('-data_exame', 200) });
  const { data: treinamentos = [] } = useQuery({ queryKey: ['treinamentos'], queryFn: () => base44.entities.Treinamento.list('-data_realizacao', 100) });
  const { data: acidentes = [] } = useQuery({ queryKey: ['acidentes'], queryFn: () => base44.entities.AcidenteTrabalho.list('-data_hora', 100) });
  const { data: acoesCorretivas = [] } = useQuery({ queryKey: ['acoes-corretivas'], queryFn: () => base44.entities.AcaoCorretiva.list('-created_date', 100) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });

  const colaboradoresComStatus = useMemo(() => colaboradores.map((colab) => {
    const asosColab = asos.filter((a) => a.colaborador_id === colab.id);
    const asoValido = asosColab.find((a) => new Date(a.data_validade) > new Date() && a.resultado === 'apto');
    const temNR18 = treinamentos.filter((t) => t.colaboradores_ids?.includes(colab.id) && t.status === 'realizado').some((t) => {
      if (t.tipo !== 'nr18') return false;
      const dv = new Date(t.data_realizacao);
      dv.setMonth(dv.getMonth() + (t.validade_meses || 24));
      return dv > new Date();
    });
    const regular = asoValido && temNR18;
    const alertas = [];
    if (!asoValido) alertas.push('ASO vencido ou inexistente');
    if (!temNR18) alertas.push('NR18 vencida ou não realizada');
    return { ...colab, regular, asoValido: !!asoValido, temNR18, alertas };
  }), [colaboradores, asos, treinamentos]);

  const regulares = colaboradoresComStatus.filter((c) => c.regular).length;
  const irregulares = colaboradoresComStatus.filter((c) => !c.regular).length;
  const asosVencendo = asos.filter((a) => {
    const dias = Math.ceil((new Date(a.data_validade) - new Date()) / 86400000);
    return dias > 0 && dias <= 30;
  }).length;
  const acidentesAno = acidentes.filter((a) => new Date(a.data_hora).getFullYear() === new Date().getFullYear()).length;
  const acoesAbertas = acoesCorretivas.filter((a) => a.status === 'aberta' || a.status === 'em_andamento').length;

  const dadosRegularidade = [{ name: 'Regulares', value: regulares }, { name: 'Irregulares', value: irregulares }];
  const acidentesPorGravidade = [
    { gravidade: 'Leve', value: acidentes.filter((a) => a.gravidade === 'leve').length },
    { gravidade: 'Moderado', value: acidentes.filter((a) => a.gravidade === 'moderado').length },
    { gravidade: 'Grave', value: acidentes.filter((a) => a.gravidade === 'grave').length },
    { gravidade: 'Fatal', value: acidentes.filter((a) => a.gravidade === 'fatal').length },
  ].filter((d) => d.value > 0);

  const filteredColaboradores = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return colaboradoresComStatus.filter((c) => !q || c.nome?.toLowerCase().includes(q) || (c.cpf || '').includes(searchTerm));
  }, [colaboradoresComStatus, searchTerm]);

  const pagColab = usePagination(filteredColaboradores, 20);
  const pagAcid = usePagination(acidentes, 20);
  const pagAcao = usePagination(acoesCorretivas, 20);
  const colabPage = pagColab.paginatedItems;
  const acidPage = pagAcid.paginatedItems;
  const acaoPage = pagAcao.paginatedItems;

  return (
    <div className="space-y-6">
      <PageHeader title="Segurança do Trabalho" subtitle="Gestão de SST, ASO, treinamentos e acidentes" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Colaboradores Regulares</div><div className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums">{regulares}</div><p className="text-xs text-gray-400 mt-1">{irregulares} irregulares</p></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">ASOs Vencendo</div><div className="text-lg sm:text-2xl font-bold text-amber-600 tabular-nums">{asosVencendo}</div><p className="text-xs text-gray-400 mt-1">Próximos 30 dias</p></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Acidentes no Ano</div><div className="text-lg sm:text-2xl font-bold text-red-600 tabular-nums">{acidentesAno}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Ações Abertas</div><div className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{acoesAbertas}</div></CardContent></Card>
      </div>

      <AlertasSST colaboradores={colaboradoresComStatus} asos={asos} treinamentos={treinamentos} acoesCorretivas={acoesCorretivas} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200">
          <CardHeader><CardTitle className="text-gray-900 text-base">Regularidade dos Colaboradores</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {regulares + irregulares === 0 ? <p className="text-center text-gray-400 pt-24">Sem dados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosRegularidade} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {dadosRegularidade.map((e, i) => <Cell key={i} fill={i === 0 ? '#10B981' : '#EF4444'} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader><CardTitle className="text-gray-900 text-base">Acidentes por Gravidade</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {acidentesPorGravidade.length === 0 ? <p className="text-center text-gray-400 pt-24">Sem acidentes registrados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={acidentesPorGravidade}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="gravidade" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="space-y-4">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="colaboradores" className="gap-2 whitespace-nowrap"><Users className="w-4 h-4" /> Colaboradores ({colaboradores.length})</TabsTrigger>
          <TabsTrigger value="acidentes" className="gap-2 whitespace-nowrap"><AlertTriangle className="w-4 h-4" /> Acidentes ({acidentes.length})</TabsTrigger>
          <TabsTrigger value="acoes" className="gap-2 whitespace-nowrap"><ClipboardCheck className="w-4 h-4" /> Ações Corretivas ({acoesCorretivas.length})</TabsTrigger>
        </TabsList>

        {/* Colaboradores */}
        <TabsContent value="colaboradores" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); pagColab.goToPage(1); }} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => setTreinoModalOpen(true)} variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700 gap-2"><Plus className="w-4 h-4" /> Registrar Treinamento</Button>
              <Button onClick={() => setAsoModalOpen(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" /> Novo ASO</Button>
            </div>
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {filteredColaboradores.length === 0 ? (
                <p className="text-center py-12 text-gray-400">Nenhum colaborador encontrado.</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {colabPage.map((c) => (
                      <Link key={c.id} to={createPageUrl(`ColaboradorDetalhes?id=${c.id}`)} className="block p-3 rounded-lg border border-gray-200 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                            <p className="text-xs text-gray-500">{c.cargo || '—'}</p>
                          </div>
                          {c.regular ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Regular</Badge> : <Badge className="bg-red-100 text-red-700 border-0">Irregular</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="text-gray-500">ASO: {c.asoValido ? <span className="text-emerald-600 font-medium">Válido</span> : <span className="text-red-600 font-medium">Vencido</span>}</span>
                          <span className="text-gray-500">NR18: {c.temNR18 ? <span className="text-emerald-600 font-medium">Válido</span> : <span className="text-red-600 font-medium">Pendente</span>}</span>
                        </div>
                        {!c.regular && c.alertas.map((a, i) => <p key={i} className="text-xs text-red-500">{a}</p>)}
                      </Link>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Cargo</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">ASO</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">NR18</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Situação</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {colabPage.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-900">{c.nome}</td>
                            <td className="p-3 text-gray-600">{c.cargo || '—'}</td>
                            <td className="p-3">{c.asoValido ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Válido</Badge> : <Badge className="bg-red-100 text-red-700 border-0">Vencido</Badge>}</td>
                            <td className="p-3">{c.temNR18 ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Válido</Badge> : <Badge className="bg-red-100 text-red-700 border-0">Pendente</Badge>}</td>
                            <td className="p-3">
                              {c.regular ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Regular</Badge> : (
                                <div>
                                  <Badge className="bg-red-100 text-red-700 border-0">Irregular</Badge>
                                  {c.alertas.map((a, i) => <p key={i} className="text-xs text-red-500 mt-0.5">{a}</p>)}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <Link to={createPageUrl(`ColaboradorDetalhes?id=${c.id}`)}><Button size="sm" variant="ghost" className="text-gray-600">Ver detalhes</Button></Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination currentPage={pagColab.currentPage} totalPages={pagColab.totalPages} onPageChange={pagColab.goToPage} startIndex={pagColab.startIndex} endIndex={pagColab.endIndex} totalItems={pagColab.totalItems} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acidentes */}
        <TabsContent value="acidentes" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setAcidenteModal({ open: true, acidente: null })} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" /> Registrar Acidente</Button>
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {acidentes.length === 0 ? (
                <p className="text-center py-12 text-gray-400">Nenhum acidente registrado.</p>
              ) : (
                <>
                {/* Mobile cards */}
                <div className="md:hidden flex flex-col gap-2 p-2">
                  {acidPage.map((a) => {
                    const obra = obras.find((o) => o.id === a.obra_id);
                    const colab = colaboradores.find((c) => c.id === a.colaborador_id);
                    return (
                      <div key={a.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{colab?.nome || '—'}</p>
                            <p className="text-xs text-gray-500">{a.data_hora ? new Date(a.data_hora).toLocaleString('pt-BR') : '—'}</p>
                          </div>
                          <Badge className={`border-0 capitalize ${gravidadeCfg[a.gravidade] || 'bg-gray-100 text-gray-600'}`}>{a.gravidade}</Badge>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {obra?.nome && <p><span className="text-gray-400">Obra: </span>{obra.nome}</p>}
                          {a.tipo && <p className="capitalize"><span className="text-gray-400">Tipo: </span>{(a.tipo || '').replace('_', ' ')}</p>}
                          {a.descricao && <p className="text-gray-600">{a.descricao}</p>}
                        </div>
                        <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => setAcidenteModal({ open: true, acidente: a })}><Pencil className="w-4 h-4" /> Editar</Button>
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setAcidenteExcluir(a)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Data/Hora</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Gravidade</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Tipo</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Descrição</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {acidPage.map((a) => {
                        const obra = obras.find((o) => o.id === a.obra_id);
                        const colab = colaboradores.find((c) => c.id === a.colaborador_id);
                        return (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="p-3 text-gray-600">{a.data_hora ? new Date(a.data_hora).toLocaleString('pt-BR') : '—'}</td>
                            <td className="p-3 font-medium text-gray-900">{colab?.nome || '—'}</td>
                            <td className="p-3 text-gray-600">{obra?.nome || '—'}</td>
                            <td className="p-3"><Badge className={`border-0 capitalize ${gravidadeCfg[a.gravidade] || 'bg-gray-100 text-gray-600'}`}>{a.gravidade}</Badge></td>
                            <td className="p-3 text-gray-600 capitalize">{(a.tipo || '').replace('_', ' ') || '—'}</td>
                            <td className="p-3 text-gray-600 max-w-xs truncate">{a.descricao}</td>
                            <td className="p-3">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" title="Editar" onClick={() => setAcidenteModal({ open: true, acidente: a })}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                                <Button size="icon" variant="ghost" title="Excluir" onClick={() => setAcidenteExcluir(a)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={pagAcid.currentPage} totalPages={pagAcid.totalPages} onPageChange={pagAcid.goToPage} startIndex={pagAcid.startIndex} endIndex={pagAcid.endIndex} totalItems={pagAcid.totalItems} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ações Corretivas */}
        <TabsContent value="acoes" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setAcaoModal({ open: true, acao: null })} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" /> Nova Ação</Button>
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {acoesCorretivas.length === 0 ? (
                <p className="text-center py-12 text-gray-400">Nenhuma ação corretiva registrada.</p>
              ) : (
                <>
                {/* Mobile cards */}
                <div className="md:hidden flex flex-col gap-2 p-2">
                  {acaoPage.map((a) => (
                    <div key={a.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 min-w-0">{a.descricao_problema}</p>
                        <Badge className={`border-0 capitalize flex-shrink-0 ${acaoStatusCfg[a.status] || 'bg-gray-100 text-gray-600'}`}>{(a.status || '').replace('_', ' ')}</Badge>
                      </div>
                      {a.acao_proposta && <p className="text-xs text-gray-600">{a.acao_proposta}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span className={`font-medium capitalize ${prioridadeCfg[a.prioridade] || 'text-gray-500'}`}>{a.prioridade || '—'}</span>
                        {a.responsavel && <span><span className="text-gray-400">Resp.: </span>{a.responsavel}</span>}
                        <span><span className="text-gray-400">Prazo: </span>{dataBR(a.prazo)}</span>
                      </div>
                      <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => setAcaoModal({ open: true, acao: a })}><Pencil className="w-4 h-4" /> Editar</Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setAcaoExcluir(a)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Problema</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Ação proposta</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Prioridade</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Responsável</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Prazo</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {acaoPage.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900 max-w-xs">{a.descricao_problema}</td>
                          <td className="p-3 text-gray-600 max-w-xs truncate">{a.acao_proposta}</td>
                          <td className="p-3"><span className={`text-xs font-medium capitalize ${prioridadeCfg[a.prioridade] || 'text-gray-500'}`}>{a.prioridade || '—'}</span></td>
                          <td className="p-3 text-gray-600">{a.responsavel || '—'}</td>
                          <td className="p-3 text-gray-600">{dataBR(a.prazo)}</td>
                          <td className="p-3"><Badge className={`border-0 capitalize ${acaoStatusCfg[a.status] || 'bg-gray-100 text-gray-600'}`}>{(a.status || '').replace('_', ' ')}</Badge></td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" title="Editar" onClick={() => setAcaoModal({ open: true, acao: a })}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                              <Button size="icon" variant="ghost" title="Excluir" onClick={() => setAcaoExcluir(a)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={pagAcao.currentPage} totalPages={pagAcao.totalPages} onPageChange={pagAcao.goToPage} startIndex={pagAcao.startIndex} endIndex={pagAcao.endIndex} totalItems={pagAcao.totalItems} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormASOModal open={asoModalOpen} onClose={() => setAsoModalOpen(false)} colaboradores={colaboradores} />
      <FormTreinamentoModal open={treinoModalOpen} onClose={() => setTreinoModalOpen(false)} colaboradores={colaboradores} />
      <FormAcidenteModal open={acidenteModal.open} onClose={() => setAcidenteModal({ open: false, acidente: null })} acidente={acidenteModal.acidente} colaboradores={colaboradores} obras={obras} />
      <FormAcaoCorretivaModal open={acaoModal.open} onClose={() => setAcaoModal({ open: false, acao: null })} acao={acaoModal.acao} obras={obras} />

      <Dialog open={!!acidenteExcluir} onOpenChange={(o) => { if (!o) setAcidenteExcluir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> Excluir acidente</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Excluir o registro de acidente{acidenteExcluir?.data_hora ? ` de ${new Date(acidenteExcluir.data_hora).toLocaleString('pt-BR')}` : ''}? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcidenteExcluir(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => deleteAcidente.mutate(acidenteExcluir.id)} disabled={deleteAcidente.isPending} className="bg-red-600 hover:bg-red-700 gap-2"><Trash2 className="w-4 h-4" />{deleteAcidente.isPending ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!acaoExcluir} onOpenChange={(o) => { if (!o) setAcaoExcluir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> Excluir ação corretiva</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Excluir esta ação corretiva? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcaoExcluir(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => deleteAcao.mutate(acaoExcluir.id)} disabled={deleteAcao.isPending} className="bg-red-600 hover:bg-red-700 gap-2"><Trash2 className="w-4 h-4" />{deleteAcao.isPending ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
