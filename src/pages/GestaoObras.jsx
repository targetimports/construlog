import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Building2, Users, DollarSign, Calendar, FileText, Printer, Download, ChevronRight, ChevronLeft, ClipboardList, Ruler, BookOpen, ShoppingCart, CheckCircle2, Clock, Package, Search, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SubMenuObras from '../components/gestao/SubMenuObras';
import MaterialesSolicitados from '../components/gestao-obras/MaterialesSolicitados';
import ComboboxBusca from '../components/shared/ComboboxBusca';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable } from '@/lib/pdfBrand';
import { TableSkeleton } from '@/components/shared/Skeletons';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

export default function GestaoObras() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="OBRAS_EDIT">
      <GestaoObrasContent />
    </RouteGuardFinalV2>);

}

function GestaoObrasContent() {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activeTab, setActiveTab] = useState('minhas-obras');
  const [pagObras, setPagObras] = useState(1);
  const [pagOrc, setPagOrc] = useState(1);
  const [pagBM, setPagBM] = useState(1);
  const [pagDiario, setPagDiario] = useState(1);
  const [pagReq, setPagReq] = useState(1);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroResp, setFiltroResp] = useState('');
  // Orçamentos
  const [fOrcTexto, setFOrcTexto] = useState('');
  const [fOrcObra, setFOrcObra] = useState('');
  const [fOrcStatus, setFOrcStatus] = useState('');
  // Medições (BM)
  const [fBMTexto, setFBMTexto] = useState('');
  const [fBMObra, setFBMObra] = useState('');
  const [fBMStatus, setFBMStatus] = useState('');
  // Diário
  const [fDiaObra, setFDiaObra] = useState('');
  const [fDiaStatus, setFDiaStatus] = useState('');
  const [fDiaData, setFDiaData] = useState('');
  // Compras
  const [fReqTexto, setFReqTexto] = useState('');
  const [fReqObra, setFReqObra] = useState('');
  const [fReqSolic, setFReqSolic] = useState('');
  const [fReqStatus, setFReqStatus] = useState('');

  // Relatório multi-obra (nível grupo): usa a matriz/branding do grupo.
  const { empresa, branding } = useEmpresaBranding(undefined);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list()
  });

  const { data: orcamentos = [], isLoading: loadingOrc } = useQuery({
    queryKey: ['gestao-orcamentos'],
    queryFn: () => base44.entities.Orcamento.list('-created_date', 500)
  });

  const { data: bms = [], isLoading: loadingBM } = useQuery({
    queryKey: ['gestao-bms'],
    queryFn: () => base44.entities.BM.list('-created_date', 500)
  });

  const { data: diarios = [], isLoading: loadingDiario } = useQuery({
    queryKey: ['gestao-diarios'],
    queryFn: () => base44.entities.DiarioObra.list('-data', 500)
  });

  const { data: requisicoes = [], isLoading: loadingReq } = useQuery({
    queryKey: ['gestao-requisicoes'],
    queryFn: () => base44.entities.RequisicaoCompra.list('-created_date', 500)
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['gestao-ocs'],
    queryFn: () => base44.entities.OrdemCompra.list('-created_date', 500)
  });

  const nomeObra = (id) => obras.find((o) => o.id === id)?.nome || '—';

  const clientesUnicos = [...new Set(obras.map((o) => o.cliente).filter(Boolean))].sort();
  const responsaveisUnicos = [...new Set(obras.map((o) => o.responsavel_tecnico).filter(Boolean))].sort();
  const obrasFiltradas = obras.filter((o) =>
    (!filtroNome || (o.nome || '').toLowerCase().includes(filtroNome.toLowerCase())) &&
    (!filtroCliente || o.cliente === filtroCliente) &&
    (!filtroResp || o.responsavel_tecnico === filtroResp)
  );
  const limparFiltros = () => { setFiltroNome(''); setFiltroCliente(''); setFiltroResp(''); setPagObras(1); };

  // Opções de obra (compartilhada) e helpers de distinct
  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome })).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  const distinct = (arr, fn) => [...new Set(arr.map(fn).filter(Boolean))].sort();
  const txtIncl = (campo, q) => !q || String(campo || '').toLowerCase().includes(q.toLowerCase());

  // Orçamentos
  const orcStatusOptions = distinct(orcamentos, (o) => o.status).map((s) => ({ value: s, label: s }));
  const orcamentosFiltrados = orcamentos.filter((o) =>
    txtIncl(o.numero || o.nome, fOrcTexto) &&
    (!fOrcObra || o.obra_id === fOrcObra) &&
    (!fOrcStatus || o.status === fOrcStatus)
  );
  const limparOrc = () => { setFOrcTexto(''); setFOrcObra(''); setFOrcStatus(''); setPagOrc(1); };

  // Medições (BM)
  const bmStatusOptions = distinct(bms, (b) => b.status).map((s) => ({ value: s, label: s }));
  const bmsFiltrados = bms.filter((b) =>
    txtIncl(b.numero != null ? `BM ${b.numero}` : '', fBMTexto) &&
    (!fBMObra || b.obra_id === fBMObra) &&
    (!fBMStatus || b.status === fBMStatus)
  );
  const limparBM = () => { setFBMTexto(''); setFBMObra(''); setFBMStatus(''); setPagBM(1); };

  // Diário
  const diaStatusOptions = distinct(diarios, (d) => d.status_registro || d.status).map((s) => ({ value: s, label: s }));
  const diariosFiltrados = diarios.filter((d) =>
    (!fDiaObra || d.obra_id === fDiaObra) &&
    (!fDiaStatus || (d.status_registro || d.status) === fDiaStatus) &&
    (!fDiaData || String(d.data || '').slice(0, 10) === fDiaData)
  );
  const limparDia = () => { setFDiaObra(''); setFDiaStatus(''); setFDiaData(''); setPagDiario(1); };

  // Compras
  const reqSolicOptions = distinct(requisicoes, (r) => r.solicitante_nome).map((s) => ({ value: s, label: s }));
  const reqStatusOptions = distinct(requisicoes, (r) => r.status_aprovacao || r.status).map((s) => ({ value: s, label: s }));
  const requisicoesFiltradas = requisicoes.filter((r) =>
    txtIncl(r.titulo || r.numero, fReqTexto) &&
    (!fReqObra || r.obra_id === fReqObra) &&
    (!fReqSolic || r.solicitante_nome === fReqSolic) &&
    (!fReqStatus || (r.status_aprovacao || r.status) === fReqStatus)
  );
  const limparReq = () => { setFReqTexto(''); setFReqObra(''); setFReqSolic(''); setFReqStatus(''); setPagReq(1); };

  const statusConfig = {
    planejamento: { label: 'Planejamento', color: 'bg-slate-600' },
    em_andamento: { label: 'Em Andamento', color: 'bg-blue-600' },
    pausada: { label: 'Pausada', color: 'bg-amber-600' },
    concluida: { label: 'Concluída', color: 'bg-green-600' },
    cancelada: { label: 'Cancelada', color: 'bg-red-600' }
  };

  // Gera o relatório de gestão de obras em PDF (client-side, via jsPDF) a partir
  // das obras carregadas — não depende de função no backend.
  const handlePrint = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      // Gera do subconjunto FILTRADO/visível (bate com o que o usuário vê).
      const lista = obrasFiltradas;
      // Base orçada = valor do CONTRATO (padrão do sistema p/ consolidado).
      const orcadoObra = (o) => Number(o.valor_contrato || o.valor_orcado || o.total_orcamento) || 0;

      const emAndamento = lista.filter((o) => ['em_andamento', 'EM_ANDAMENTO', 'ativa', 'a_iniciar'].includes(o.status)).length;
      const concluidas = lista.filter((o) => ['concluida', 'CONCLUIDA', 'ENCERRADA'].includes(o.status)).length;
      const totalOrcado = lista.reduce((s, o) => s + orcadoObra(o), 0);
      const totalRealizado = lista.reduce((s, o) => s + (Number(o.valor_realizado) || 0), 0);

      const doc = novoPDF();
      const M = 14;
      let y = await cabecalhoPDF(doc, {
        empresa,
        branding,
        titulo: 'Relatório de Gestão de Obras',
        subtitulo: `${lista.length} obra(s) · Total orçado ${fmtBRL(totalOrcado)}`,
      });

      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Total de obras', String(lista.length)],
          ['Em andamento', String(emAndamento)],
          ['Concluídas', String(concluidas)],
          ['Total orçado', fmtBRL(totalOrcado)],
          ['Total realizado', fmtBRL(totalRealizado)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
      }));
      y = doc.lastAutoTable.finalY + 8;

      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Obra', 'Cliente', 'Status', '% Físico', 'Orçado', 'Realizado', 'Prev. Fim']],
        body: lista.map((o) => [
          o.nome || '—',
          o.cliente || o.cliente_nome || '—',
          statusConfig[o.status]?.label || o.status || '—',
          `${o.percentual_concluido || 0}%`,
          fmtBRL(orcadoObra(o)),
          fmtBRL(o.valor_realizado),
          fmtData(o.data_prevista_fim),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 3: { halign: 'right' } },
      }));

      rodapePDF(doc, { empresa, branding, titulo: 'Relatório de Gestão de Obras' });
      doc.save(`relatorio-gestao-obras-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar relatório: ' + (error?.message || 'tente novamente'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Helpers de apresentação reutilizados pelas abas consolidadas
  const KpiCard = ({ icon: Icon, color, label, value }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Icon className={`w-8 h-8 ${color}`} />
          <div>
            <p className={`text-sm ${color}`}>{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const Pill = ({ children, className }) => (
    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center border border-transparent ${className || 'bg-gray-100 text-gray-700'}`}>
      {children}
    </span>
  );

  const statusPill = (status) => {
    const s = String(status || '').toLowerCase();
    if (['aprovado', 'aprovada', 'concluida', 'concluido', 'comprada', 'finalizado', 'finalizada', 'recebido', 'recebida'].includes(s)) return 'bg-green-100 text-green-800';
    if (['rascunho', 'em_andamento', 'em_cotacao', 'pendente', 'aguardando', 'em_aprovacao'].includes(s)) return 'bg-blue-100 text-blue-800';
    if (['rejeitado', 'rejeitada', 'cancelado', 'cancelada', 'reprovado', 'reprovada'].includes(s)) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  const EmptyState = ({ text }) => (
    <div className="text-center py-12 text-gray-400 text-sm">{text}</div>
  );

  const PAGE_SIZE = 15;
  const pageSlice = (arr, pagina) => {
    const totalPaginas = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
    const atual = Math.min(pagina, totalPaginas);
    return arr.slice((atual - 1) * PAGE_SIZE, atual * PAGE_SIZE);
  };

  const Paginacao = ({ total, pagina, setPagina }) => {
    const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const atual = Math.min(pagina, totalPaginas);
    return (
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          {total === 0 ? 'Nenhum registro' : `Mostrando ${(atual - 1) * PAGE_SIZE + 1}–${Math.min(atual * PAGE_SIZE, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={atual <= 1} className="h-8 gap-1 border-gray-300 text-gray-700">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </Button>
          <span className="text-xs text-gray-600">Página {atual} de {totalPaginas}</span>
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={atual >= totalPaginas} className="h-8 gap-1 border-gray-300 text-gray-700">
            Próxima <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Barra de filtros genérica reutilizada pelas abas consolidadas.
  // fields: [{ type: 'text'|'date'|'combo', label, value, onChange|onSelect, options?, placeholder? }]
  const FiltroBar = ({ fields, onClear, hasActive }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          {fields.map((f, i) => (
            <div key={i} className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
              {f.type === 'text' ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input placeholder={f.placeholder} value={f.value} onChange={(e) => f.onChange(e.target.value)} className="h-11 pl-9" />
                </div>
              ) : f.type === 'date' ? (
                <Input type="date" value={f.value} onChange={(e) => f.onChange(e.target.value)} className="h-11" />
              ) : (
                <ComboboxBusca
                  options={f.options}
                  value={f.value}
                  onSelect={f.onSelect}
                  placeholder={f.placeholder}
                  searchPlaceholder={f.searchPlaceholder || 'Buscar...'}
                  emptyMessage={f.emptyMessage || 'Nenhum resultado.'}
                />
              )}
            </div>
          ))}
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 shrink-0">
              <X className="w-4 h-4" /> Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'minhas-obras':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-blue-600 text-sm">Total de Obras</p>
                      <p className="text-2xl font-bold text-gray-900">{obras.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-green-600 text-sm">Em Andamento</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {obras.filter((o) => ['em_andamento', 'EM_ANDAMENTO', 'ativa', 'a_iniciar'].includes(o.status)).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-purple-600" />
                    <div>
                      <p className="text-purple-600 text-sm">Concluídas</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {obras.filter((o) => ['concluida', 'CONCLUIDA', 'ENCERRADA'].includes(o.status)).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-amber-600" />
                    <div>
                      <p className="text-amber-600 text-sm">Total Orçado</p>
                      <p className="text-2xl font-bold text-gray-900">
                        R$ {obras.reduce((sum, o) => sum + (o.total_final_orcamento || o.total_orcamento || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome da obra</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        placeholder="Buscar por nome..."
                        value={filtroNome}
                        onChange={(e) => { setFiltroNome(e.target.value); setPagObras(1); }}
                        className="h-11 pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Cliente</label>
                    <ComboboxBusca
                      options={clientesUnicos.map((c) => ({ value: c, label: c }))}
                      value={filtroCliente}
                      onSelect={(v) => { setFiltroCliente(v); setPagObras(1); }}
                      placeholder="Todos os clientes"
                      searchPlaceholder="Buscar cliente..."
                      emptyMessage="Nenhum cliente encontrado."
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Responsável</label>
                    <ComboboxBusca
                      options={responsaveisUnicos.map((r) => ({ value: r, label: r }))}
                      value={filtroResp}
                      onSelect={(v) => { setFiltroResp(v); setPagObras(1); }}
                      placeholder="Todos os responsáveis"
                      searchPlaceholder="Buscar responsável..."
                      emptyMessage="Nenhum responsável encontrado."
                    />
                  </div>
                  {(filtroNome || filtroCliente || filtroResp) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparFiltros}
                      className="h-9 gap-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 shrink-0"
                    >
                      <X className="w-4 h-4" /> Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {obrasFiltradas.length === 0 && (
                <Card><CardContent><EmptyState text="Nenhuma obra encontrada com os filtros aplicados." /></CardContent></Card>
              )}
              {pageSlice(obrasFiltradas, pagObras).map((obra) =>
              <Card key={obra.id}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-gray-900 font-semibold text-lg">{obra.nome}</h3>
                            <Badge className="bg-green-600 text-slate-50 px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border-transparent shadow-sm">
                              {statusConfig[obra.status]?.label}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="space-y-1">
                              <p className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Cliente: {obra.cliente}
                              </p>
                              <p className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Responsável: {obra.responsavel_tecnico}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Contrato: R$ {obra.valor_contrato?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Prazo: {obra.data_prevista_fim ? new Date(obra.data_prevista_fim).toLocaleDateString('pt-BR') : 'Não definido'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Link to={createPageUrl('ObraDetalhes') + `?id=${obra.id}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </Button>
                        </Link>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Progresso Físico</span>
                          <span className="text-gray-900 font-medium">{obra.percentual_concluido || 0}%</span>
                        </div>
                        <Progress value={obra.percentual_concluido || 0} className="h-2" />
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                         <div>
                           <p className="text-xs text-gray-600">Valor Orçado</p>
                           <p className="text-sm font-semibold text-green-600">
                             R$ {obra.valor_orcado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         </div>
                         <div>
                           <p className="text-xs text-gray-600">Valor Realizado</p>
                           <p className="text-sm font-semibold text-blue-600">
                             R$ {obra.valor_realizado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         </div>
                         <div>
                           <p className="text-xs text-gray-600">Necessário para Iniciar</p>
                           <p className="text-sm font-semibold text-amber-600">
                             R$ {Math.min(obra.valor_orcado || 0, obra.valor_contrato || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         </div>
                       </div>

                      {/* Materiais Solicitados */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-3">MATERIAIS SOLICITADOS</p>
                        <MaterialesSolicitados obraId={obra.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Paginacao total={obrasFiltradas.length} pagina={pagObras} setPagina={setPagObras} />
              </CardContent>
            </Card>
          </>);

      case 'orcamentos': {
        const totalOrcado = orcamentos.reduce((s, o) => s + (Number(o.valor_total) || 0), 0);
        const importados = orcamentos.filter((o) => o.importado).length;
        const obrasComOrc = new Set(orcamentos.map((o) => o.obra_id).filter(Boolean)).size;
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard icon={ClipboardList} color="text-blue-600" label="Total de Orçamentos" value={orcamentos.length} />
              <KpiCard icon={Download} color="text-purple-600" label="Importados" value={importados} />
              <KpiCard icon={DollarSign} color="text-amber-600" label="Valor Total Orçado" value={fmtBRL(totalOrcado)} />
              <KpiCard icon={Building2} color="text-green-600" label="Obras com Orçamento" value={obrasComOrc} />
            </div>
            <FiltroBar
              hasActive={!!(fOrcTexto || fOrcObra || fOrcStatus)}
              onClear={limparOrc}
              fields={[
                { type: 'text', label: 'Número / Nome', placeholder: 'Buscar orçamento...', value: fOrcTexto, onChange: (v) => { setFOrcTexto(v); setPagOrc(1); } },
                { type: 'combo', label: 'Obra', options: obraOptions, value: fOrcObra, onSelect: (v) => { setFOrcObra(v); setPagOrc(1); }, placeholder: 'Todas as obras', searchPlaceholder: 'Buscar obra...' },
                { type: 'combo', label: 'Status', options: orcStatusOptions, value: fOrcStatus, onSelect: (v) => { setFOrcStatus(v); setPagOrc(1); }, placeholder: 'Todos os status', searchPlaceholder: 'Buscar status...' },
              ]}
            />
            <Card>
              <CardContent className="p-0">
                {loadingOrc ? <TableSkeleton bare rows={6} cols={6} /> : <>
                {orcamentosFiltrados.length === 0 ? <EmptyState text="Nenhum orçamento encontrado." /> :
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-6 py-3">Orçamento</th>
                        <th className="px-6 py-3">Obra</th>
                        <th className="px-6 py-3 text-right">Valor Total</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Origem</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice(orcamentosFiltrados, pagOrc).map((o) => (
                        <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{o.numero || o.nome || `#${String(o.id).slice(0, 8)}`}</td>
                          <td className="px-6 py-3 text-gray-600">{nomeObra(o.obra_id)}</td>
                          <td className="px-6 py-3 text-right tabular-nums font-semibold text-gray-900">{fmtBRL(o.valor_total)}</td>
                          <td className="px-6 py-3"><Pill className={statusPill(o.status)}>{o.status || '—'}</Pill></td>
                          <td className="px-6 py-3 text-gray-500">{o.importado ? 'Importado' : 'Manual'}</td>
                          <td className="px-6 py-3 text-right">
                            <Link to={createPageUrl('OrcamentoDetalhes') + `?id=${o.id}`}>
                              <Button variant="ghost" size="sm">Detalhes <ChevronRight className="w-4 h-4 ml-1" /></Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
                <Paginacao total={orcamentosFiltrados.length} pagina={pagOrc} setPagina={setPagOrc} />
                </>}
              </CardContent>
            </Card>
          </>);
      }

      case 'medicoes': {
        const aprovadas = bms.filter((b) => String(b.status).toLowerCase().includes('aprov')).length;
        const totalMedido = bms.reduce((s, b) => s + (Number(b.total_periodo) || 0), 0);
        const obrasComBM = new Set(bms.map((b) => b.obra_id).filter(Boolean)).size;
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard icon={Ruler} color="text-blue-600" label="Total de Medições (BM)" value={bms.length} />
              <KpiCard icon={CheckCircle2} color="text-green-600" label="Aprovadas" value={aprovadas} />
              <KpiCard icon={DollarSign} color="text-amber-600" label="Total Medido (período)" value={fmtBRL(totalMedido)} />
              <KpiCard icon={Building2} color="text-purple-600" label="Obras com Medição" value={obrasComBM} />
            </div>
            <FiltroBar
              hasActive={!!(fBMTexto || fBMObra || fBMStatus)}
              onClear={limparBM}
              fields={[
                { type: 'text', label: 'Número BM', placeholder: 'Buscar BM...', value: fBMTexto, onChange: (v) => { setFBMTexto(v); setPagBM(1); } },
                { type: 'combo', label: 'Obra', options: obraOptions, value: fBMObra, onSelect: (v) => { setFBMObra(v); setPagBM(1); }, placeholder: 'Todas as obras', searchPlaceholder: 'Buscar obra...' },
                { type: 'combo', label: 'Status', options: bmStatusOptions, value: fBMStatus, onSelect: (v) => { setFBMStatus(v); setPagBM(1); }, placeholder: 'Todos os status', searchPlaceholder: 'Buscar status...' },
              ]}
            />
            <Card>
              <CardContent className="p-0">
                {loadingBM ? <TableSkeleton bare rows={6} cols={8} /> : <>
                {bmsFiltrados.length === 0 ? <EmptyState text="Nenhuma medição (BM) encontrada." /> :
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-6 py-3">BM</th>
                        <th className="px-6 py-3">Obra</th>
                        <th className="px-6 py-3">Período</th>
                        <th className="px-6 py-3 text-right">% Concl.</th>
                        <th className="px-6 py-3 text-right">Total Período</th>
                        <th className="px-6 py-3 text-right">Acumulado</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice(bmsFiltrados, pagBM).map((b) => (
                        <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{b.numero != null ? `BM ${b.numero}` : `#${String(b.id).slice(0, 8)}`}</td>
                          <td className="px-6 py-3 text-gray-600">{nomeObra(b.obra_id)}</td>
                          <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{fmtData(b.data_inicio)} – {fmtData(b.data_fim)}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{b.percent_concluida != null ? `${Number(b.percent_concluida).toFixed(1)}%` : '—'}</td>
                          <td className="px-6 py-3 text-right tabular-nums font-semibold text-gray-900">{fmtBRL(b.total_periodo)}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-gray-600">{fmtBRL(b.total_acumulado)}</td>
                          <td className="px-6 py-3"><Pill className={statusPill(b.status)}>{b.status || '—'}</Pill></td>
                          <td className="px-6 py-3 text-right">
                            <Link to={createPageUrl('BMDetalhes') + `?bm_id=${b.id}`}>
                              <Button variant="ghost" size="sm">Detalhes <ChevronRight className="w-4 h-4 ml-1" /></Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
                <Paginacao total={bmsFiltrados.length} pagina={pagBM} setPagina={setPagBM} />
                </>}
              </CardContent>
            </Card>
          </>);
      }

      case 'diario': {
        const pendentes = diarios.filter((d) => !['aprovado', 'aprovada'].includes(String(d.status_registro || d.status).toLowerCase())).length;
        const aprovados = diarios.filter((d) => ['aprovado', 'aprovada'].includes(String(d.status_registro || d.status).toLowerCase())).length;
        const obrasComDiario = new Set(diarios.map((d) => d.obra_id).filter(Boolean)).size;
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard icon={BookOpen} color="text-blue-600" label="Total de Diários" value={diarios.length} />
              <KpiCard icon={Clock} color="text-amber-600" label="Pendentes" value={pendentes} />
              <KpiCard icon={CheckCircle2} color="text-green-600" label="Aprovados" value={aprovados} />
              <KpiCard icon={Building2} color="text-purple-600" label="Obras com Diário" value={obrasComDiario} />
            </div>
            <FiltroBar
              hasActive={!!(fDiaObra || fDiaStatus || fDiaData)}
              onClear={limparDia}
              fields={[
                { type: 'combo', label: 'Obra', options: obraOptions, value: fDiaObra, onSelect: (v) => { setFDiaObra(v); setPagDiario(1); }, placeholder: 'Todas as obras', searchPlaceholder: 'Buscar obra...' },
                { type: 'combo', label: 'Status', options: diaStatusOptions, value: fDiaStatus, onSelect: (v) => { setFDiaStatus(v); setPagDiario(1); }, placeholder: 'Todos os status', searchPlaceholder: 'Buscar status...' },
                { type: 'date', label: 'Data', value: fDiaData, onChange: (v) => { setFDiaData(v); setPagDiario(1); } },
              ]}
            />
            <Card>
              <CardContent className="p-0">
                {loadingDiario ? <TableSkeleton bare rows={6} cols={6} /> : <>
                {diariosFiltrados.length === 0 ? <EmptyState text="Nenhum diário encontrado." /> :
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-6 py-3">Data</th>
                        <th className="px-6 py-3">Obra</th>
                        <th className="px-6 py-3">Clima</th>
                        <th className="px-6 py-3">Atividades</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice(diariosFiltrados, pagDiario).map((d) => (
                        <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">{fmtData(d.data)}</td>
                          <td className="px-6 py-3 text-gray-600">{nomeObra(d.obra_id)}</td>
                          <td className="px-6 py-3 text-gray-500">{d.clima || '—'}</td>
                          <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{d.atividades_realizadas || '—'}</td>
                          <td className="px-6 py-3"><Pill className={statusPill(d.status_registro || d.status)}>{d.status_registro || d.status || '—'}</Pill></td>
                          <td className="px-6 py-3 text-right">
                            <Link to={createPageUrl('DiarioObra') + `?obra_id=${d.obra_id}`}>
                              <Button variant="ghost" size="sm">Abrir <ChevronRight className="w-4 h-4 ml-1" /></Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
                <Paginacao total={diariosFiltrados.length} pagina={pagDiario} setPagina={setPagDiario} />
                </>}
              </CardContent>
            </Card>
          </>);
      }

      case 'compras': {
        const totalReq = requisicoes.reduce((s, r) => s + (Number(r.valor_total) || 0), 0);
        const pendentesAprov = requisicoes.filter((r) => ['pendente', 'aguardando', 'em_aprovacao'].includes(String(r.status_aprovacao || r.status).toLowerCase())).length;
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard icon={ShoppingCart} color="text-blue-600" label="Requisições" value={requisicoes.length} />
              <KpiCard icon={Package} color="text-purple-600" label="Ordens de Compra" value={ordensCompra.length} />
              <KpiCard icon={DollarSign} color="text-amber-600" label="Valor em Requisições" value={fmtBRL(totalReq)} />
              <KpiCard icon={Clock} color="text-red-600" label="Pendentes de Aprovação" value={pendentesAprov} />
            </div>
            <FiltroBar
              hasActive={!!(fReqTexto || fReqObra || fReqSolic || fReqStatus)}
              onClear={limparReq}
              fields={[
                { type: 'text', label: 'Requisição', placeholder: 'Buscar por título/nº...', value: fReqTexto, onChange: (v) => { setFReqTexto(v); setPagReq(1); } },
                { type: 'combo', label: 'Obra', options: obraOptions, value: fReqObra, onSelect: (v) => { setFReqObra(v); setPagReq(1); }, placeholder: 'Todas as obras', searchPlaceholder: 'Buscar obra...' },
                { type: 'combo', label: 'Solicitante', options: reqSolicOptions, value: fReqSolic, onSelect: (v) => { setFReqSolic(v); setPagReq(1); }, placeholder: 'Todos', searchPlaceholder: 'Buscar solicitante...' },
                { type: 'combo', label: 'Status', options: reqStatusOptions, value: fReqStatus, onSelect: (v) => { setFReqStatus(v); setPagReq(1); }, placeholder: 'Todos os status', searchPlaceholder: 'Buscar status...' },
              ]}
            />
            <Card>
              <CardContent className="p-0">
                {loadingReq ? <TableSkeleton bare rows={6} cols={6} /> : <>
                {requisicoesFiltradas.length === 0 ? <EmptyState text="Nenhuma requisição encontrada." /> :
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-6 py-3">Requisição</th>
                        <th className="px-6 py-3">Obra</th>
                        <th className="px-6 py-3">Solicitante</th>
                        <th className="px-6 py-3 text-right">Valor</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice(requisicoesFiltradas, pagReq).map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{r.titulo || r.numero || `#${String(r.id).slice(0, 8)}`}</td>
                          <td className="px-6 py-3 text-gray-600">{nomeObra(r.obra_id)}</td>
                          <td className="px-6 py-3 text-gray-500">{r.solicitante_nome || '—'}</td>
                          <td className="px-6 py-3 text-right tabular-nums font-semibold text-gray-900">{fmtBRL(r.valor_total)}</td>
                          <td className="px-6 py-3"><Pill className={statusPill(r.status_aprovacao || r.status)}>{r.status_aprovacao || r.status || '—'}</Pill></td>
                          <td className="px-6 py-3 text-right">
                            <Link to={createPageUrl('Compras') + `?id=${r.id}`}>
                              <Button variant="ghost" size="sm">Abrir <ChevronRight className="w-4 h-4 ml-1" /></Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
                <Paginacao total={requisicoesFiltradas.length} pagina={pagReq} setPagina={setPagReq} />
                </>}
              </CardContent>
            </Card>
          </>);
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Obras</h1>
          <p className="text-gray-600 mt-1">Visão consolidada de todas as obras</p>
        </div>
        <Button
          onClick={handlePrint}
          disabled={isGeneratingPDF}
          className="gap-2">

          {isGeneratingPDF ?
          <>
              <Download className="w-4 h-4 animate-pulse" />
              Gerando PDF...
            </> :

          <>
              <Printer className="w-4 h-4" />
              Imprimir Relatório
            </>
          }
        </Button>
      </div>

      {/* Submenu horizontal */}
      <div className="flex flex-wrap justify-center gap-1.5 bg-white rounded-xl p-1.5 shadow-sm border border-gray-200 w-fit mx-auto">
        {[
        { label: 'Minhas Obras', id: 'minhas-obras', icon: Building2 },
        { label: 'Orçamentos', id: 'orcamentos', icon: ClipboardList },
        { label: 'Medições', id: 'medicoes', icon: Ruler },
        { label: 'Diário de Obras', id: 'diario', icon: BookOpen },
        { label: 'Compras', id: 'compras', icon: ShoppingCart }].
        map((item) => {
          const Icon = item.icon;
          const ativo = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                ativo
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}>
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {renderContent()}
    </div>);

}