import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable, PDF_STRIPE, PDF_INK } from '@/lib/pdfBrand';
import { exportarCSV } from '@/lib/csvBR';

const fmtMoeda = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const localDe = (o) => [o.cidade, o.estado].filter(Boolean).join('/') || '—';
// Orçamento da obra: campo real é total_orcamento (com fallbacks de orçamento/contrato).
// NÃO usar valor_realizado aqui — é custo executado, não orçamento.
const orcamentoDe = (o) => o.total_orcamento || o.total_final_orcamento || o.valor_contrato || o.valor_orcado || 0;
const STATUS_OPCOES = [
  { v: 'todas', l: 'Todos os Status' },
  { v: 'a_iniciar', l: 'A iniciar' },
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'concluida', l: 'Concluída' },
  { v: 'paralisada', l: 'Paralisada' },
  { v: 'cancelada', l: 'Cancelada' },
];
const statusLabel = (s) => STATUS_OPCOES.find(o => o.v === s)?.l || (s ? String(s).replace(/_/g, ' ') : '-');

export default function RelatoriosObras() {
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  // Relatório multi-obra (nível grupo) — branding do grupo/matriz.
  const { empresa, branding } = useEmpresaBranding(undefined);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 100)
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.Orcamento.list('-updated_date', 100)
  });

  const clientes = useMemo(() => {
    const clientesSet = new Set(obras.map(o => o.cliente).filter(Boolean));
    return Array.from(clientesSet).sort();
  }, [obras]);

  const obrasFiltradas = useMemo(() => {
    return obras.filter(obra => {
      const passaStatus = filtroStatus === 'todas' || obra.status === filtroStatus;
      const passaCliente = !filtroCliente || obra.cliente === filtroCliente;

      const dataObraInicio = obra.data_inicio ? new Date(obra.data_inicio) : null;
      const passaData = !dataInicio || !dataFim ||
        (dataObraInicio && dataObraInicio >= new Date(dataInicio) && dataObraInicio <= new Date(dataFim));

      return passaStatus && passaCliente && passaData;
    });
  }, [obras, filtroStatus, filtroCliente, dataInicio, dataFim]);

  const stats = useMemo(() => {
    const total = obrasFiltradas.length;
    const ativas = obrasFiltradas.filter(o => o.status === 'em_andamento').length;
    const concluidas = obrasFiltradas.filter(o => o.status === 'concluida').length;
    const totalOrcado = obrasFiltradas.reduce((sum, o) => sum + orcamentoDe(o), 0);

    return { total, ativas, concluidas, totalOrcado };
  }, [obrasFiltradas]);

  const { paginatedItems: obrasPaginadas, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(obrasFiltradas, 20);
  const ativos = (filtroStatus !== 'todas' ? 1 : 0) + (filtroCliente ? 1 : 0) + (dataInicio ? 1 : 0) + (dataFim ? 1 : 0);
  const limparFiltros = () => { setFiltroStatus('todas'); setFiltroCliente(''); setDataInicio(''); setDataFim(''); };

  // Descreve o recorte de filtros aplicado, para constar no relatório.
  const descricaoFiltros = () => {
    const partes = [];
    if (filtroStatus !== 'todas') partes.push(`Status: ${statusLabel(filtroStatus)}`);
    if (filtroCliente) partes.push(`Cliente: ${filtroCliente}`);
    if (dataInicio && dataFim) partes.push(`Início entre ${fmtData(dataInicio)} e ${fmtData(dataFim)}`);
    return partes.length ? partes.join('  ·  ') : 'Todas as obras';
  };

  // Exportações geradas no cliente a partir das obras filtradas (sem depender de storage).
  const handleExportarPDF = async () => {
    if (!obrasFiltradas.length) return;
    try {
      const doc = novoPDF();
      let y = await cabecalhoPDF(doc, {
        empresa,
        branding,
        titulo: 'Relatório de Obras',
        subtitulo: descricaoFiltros(),
      });

      // ── Resumo (indicadores) ────────────────────────────────────────────
      const ticketMedio = stats.total ? stats.totalOrcado / stats.total : 0;
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Total de obras', String(stats.total)],
          ['Em andamento', String(stats.ativas)],
          ['Concluídas', String(stats.concluidas)],
          ['Orçamento total', fmtMoeda(stats.totalOrcado)],
          ['Orçamento médio por obra', fmtMoeda(ticketMedio)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
        tableWidth: 90,
      }));
      y = doc.lastAutoTable.finalY + 8;

      // ── Detalhamento das obras ──────────────────────────────────────────
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Obra', 'Código', 'Cliente', 'Local', 'Status', 'Início', 'Prev. término', 'Orçamento']],
        body: obrasFiltradas.map(o => [
          o.nome || '—', o.codigo || '—', o.cliente || '—', localDe(o),
          statusLabel(o.status), fmtData(o.data_inicio), fmtData(o.data_prevista_fim), fmtMoeda(orcamentoDe(o)),
        ]),
        foot: [['', '', '', '', '', '', 'Total', fmtMoeda(stats.totalOrcado)]],
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 7: { halign: 'right' } },
        footStyles: { fillColor: PDF_STRIPE, textColor: PDF_INK, fontStyle: 'bold', halign: 'right' },
      }));

      rodapePDF(doc, { empresa, branding, titulo: 'Relatório de Obras' });
      doc.save(`relatorio-obras-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar PDF: ' + error.message);
    }
  };

  const handleExportarCSV = () => {
    if (!obrasFiltradas.length) return;
    exportarCSV(
      `relatorio-obras-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Obra', 'Código', 'Cliente', 'Cidade', 'UF', 'Status', 'Data Início', 'Previsão Término', 'Responsável', 'Orçamento (R$)'],
      [
        ...obrasFiltradas.map(o => [
          o.nome || '', o.codigo || '', o.cliente || '', o.cidade || '', o.estado || '',
          statusLabel(o.status), fmtData(o.data_inicio), fmtData(o.data_prevista_fim),
          o.responsavel_obra || o.responsavel_tecnico || '',
          (orcamentoDe(o) || 0).toFixed(2).replace('.', ','),
        ]),
        ['TOTAL', '', '', '', '', '', '', '', '', (stats.totalOrcado || 0).toFixed(2).replace('.', ',')],
      ]
    );
    toast.success('CSV exportado!');
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios de Obras</h1>
          <p className="text-gray-500 text-sm mt-1">Gere e exporte relatórios detalhados sobre suas obras</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleExportarCSV} disabled={obrasFiltradas.length === 0} variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700 gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={handleExportarPDF} disabled={obrasFiltradas.length === 0} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 gap-2">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosColapsaveis ativos={ativos} onLimpar={limparFiltros} rodape={<span className="text-xs text-gray-500">{obrasFiltradas.length} obra(s)</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={STATUS_OPCOES.map(s => ({ value: s.v, label: s.l }))}
              value={filtroStatus}
              onSelect={(v) => setFiltroStatus(v || 'todas')}
              placeholder="Todos os Status"
              searchPlaceholder="Buscar status..."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Cliente</Label>
            <ComboboxBusca
              options={[{ value: '__all', label: 'Todos os Clientes' }, ...clientes.map(c => ({ value: c, label: c }))]}
              value={filtroCliente || '__all'}
              onSelect={(v) => setFiltroCliente(v === '__all' ? '' : (v || ''))}
              placeholder="Todos os Clientes"
              searchPlaceholder="Buscar cliente..."
              emptyMessage="Nenhum cliente."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Data Início</Label>
            <Input className="h-11" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Data Fim</Label>
            <Input className="h-11" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
      </FiltrosColapsaveis>

      {/* KPIs do Relatório */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-gray-500">Total de Obras</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-gray-500">Em Andamento</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{stats.ativas}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-gray-500">Concluídas</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1 tabular-nums">{stats.concluidas}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-gray-500">Orçamento Total</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-700 mt-1 tabular-nums truncate" title={fmtMoeda(stats.totalOrcado)}>{fmtCompactBRL(stats.totalOrcado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Listagem */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">Obras ({obrasFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {obrasFiltradas.length === 0 ? (
            <p className="text-gray-500 text-center py-12">Nenhuma obra encontrada com esses filtros</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {obrasPaginadas.map(obra => (
                  <div key={obra.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{obra.nome}</p>
                        <p className="text-xs text-gray-500">{obra.cliente || '-'}{obra.codigo ? ` · ${obra.codigo}` : ''}</p>
                      </div>
                      <Badge className={`border-0 flex-shrink-0 ${obra.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' : obra.status === 'concluida' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel(obra.status)}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-green-700 tabular-nums">{fmtMoeda(orcamentoDe(obra))}</div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Cliente</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Código</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Orçamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {obrasPaginadas.map(obra => (
                      <tr key={obra.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{obra.nome}</td>
                        <td className="p-3 text-gray-600">{obra.cliente || '-'}</td>
                        <td className="p-3 text-gray-600">{obra.codigo || '-'}</td>
                        <td className="p-3 text-center">
                          <Badge className={`border-0 ${obra.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' : obra.status === 'concluida' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {statusLabel(obra.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium text-green-700">{fmtMoeda(orcamentoDe(obra))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}