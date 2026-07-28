import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText,
  Download,
  TrendingUp,
  DollarSign,
  Ruler,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { exportarCSV as exportarCSVBR } from '@/lib/csvBR';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable } from '@/lib/pdfBrand';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import PageHeader from '../components/ui/PageHeader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Formata número para CSV/pt-BR (vírgula decimal); texto passa direto.
const csvNum = (v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : (v ?? ''));

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState('progresso');
  const [obraId, setObraId] = useState('');
  const [periodo, setPeriodo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [comparacaoObra2, setComparacaoObra2] = useState('');
  const [gerando, setGerando] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra selecionada).
  const { empresa, branding } = useEmpresaBranding(obras.find((o) => o.id === obraId)?.empresa_id);

  // Medição canônica = BM (Boletim de Medição). Carrega os BMs da obra selecionada.
  const { data: bms = [] } = useQuery({
    queryKey: ['bms-relatorio', obraId],
    queryFn: () => base44.entities.BM.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.Orcamento.list()
  });

  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-orcamento'],
    queryFn: () => base44.entities.ItemOrcamento.list()
  });

  const obraSelecionada = obras.find(o => o.id === obraId);
  const obra2Selecionada = obras.find(o => o.id === comparacaoObra2);

  // Medição canônica = BM. Só BMs APROVADAS contam como medição oficial (ordenadas por número).
  const medicoesObra = bms
    .filter(b => b.obra_id === obraId && b.status === 'APROVADA')
    .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
  // Base de orçamento da obra: padrão do sistema é valor_contrato (fallback nos demais campos).
  const baseOrcado = obraSelecionada?.valor_contrato || obraSelecionada?.total_orcamento || obraSelecionada?.valor_orcado || 0;
  const dadosProgresso = medicoesObra.map(m => ({
    numero: m.numero,
    fisico: Number(m.percent_concluida) || 0,
    financeiro: baseOrcado ? ((Number(m.total_acumulado) || 0) / baseOrcado * 100) : 0
  }));

  // Dados para análise de custos (base "orçado" = valor_contrato, padrão do sistema).
  const orcamentoObra = orcamentos.find(o => o.obra_id === obraId && o.status === 'vigente');
  const orcadoVal = obraSelecionada?.valor_contrato || orcamentoObra?.valor_total || obraSelecionada?.total_orcamento || 0;
  const dadosCustos = obraSelecionada ? [
    { categoria: 'Orçado', valor: orcadoVal },
    { categoria: 'Realizado', valor: obraSelecionada.valor_realizado || 0 },
    { categoria: 'Contrato', valor: obraSelecionada.valor_contrato || obraSelecionada.total_orcamento || 0 },
  ].filter(d => d.valor > 0) : [];

  // Dados por categoria (orçado vs realizado)
  const itensOrcamentoObra = itensOrcamento.filter(i => i.orcamento_id === orcamentoObra?.id);
  const dadosPorCategoria = ['materiais', 'mao_obra', 'equipamentos', 'transporte'].map(categoria => {
    const itensCategoria = itensOrcamentoObra.filter(i => i.categoria === categoria);
    const orcado = itensCategoria.reduce((acc, i) => acc + (i.valor_total || 0), 0);
    
    // Para realizado, vamos simular com base no % concluído (em produção seria tracking real)
    const realizado = orcado * ((obraSelecionada?.percentual_concluido || 0) / 100);
    
    return {
      categoria: categoria.replace('_', ' '),
      orcado,
      realizado
    };
  }).filter(d => d.orcado > 0 || d.realizado > 0);

  // Comparação entre obras
  const dadosComparacao = comparacaoObra2 ? [
    {
      obra: obraSelecionada?.nome?.substring(0, 20) || 'Obra 1',
      progresso: obraSelecionada?.percentual_concluido || 0,
      custos: obraSelecionada?.valor_realizado || 0
    },
    {
      obra: obra2Selecionada?.nome?.substring(0, 20) || 'Obra 2',
      progresso: obra2Selecionada?.percentual_concluido || 0,
      custos: obra2Selecionada?.valor_realizado || 0
    }
  ] : [];

  // Paginação compartilhada (tabelas de progresso e de medições — mutuamente exclusivas por tipo)
  const pagProg = usePagination(dadosProgresso, 10);
  const pagMed = usePagination(medicoesObra, 10);
  const dadosProgressoPag = pagProg.paginatedItems;
  const medicoesPag = pagMed.paginatedItems;

  // Há dados para o tipo de relatório selecionado?
  const temDadosRelatorio =
    (tipoRelatorio === 'progresso' && dadosProgresso.length > 0) ||
    (tipoRelatorio === 'custos' && dadosCustos.length > 0) ||
    (tipoRelatorio === 'custos_categoria' && dadosPorCategoria.length > 0) ||
    (tipoRelatorio === 'comparacao' && dadosComparacao.length > 0) ||
    (tipoRelatorio === 'medicoes' && medicoesObra.length > 0);

  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  // Linhas do relatório atual (mesma fonte para Excel e CSV) — cobre todos os tipos.
  const linhasRelatorio = () => {
    if (tipoRelatorio === 'progresso') return dadosProgresso.map(d => ({ 'Medição': d.numero, '% Físico': round2(d.fisico), '% Financeiro': round2(d.financeiro) }));
    if (tipoRelatorio === 'custos') return dadosCustos.map(d => ({ 'Categoria': d.categoria, 'Valor': round2(d.valor) }));
    if (tipoRelatorio === 'custos_categoria') return dadosPorCategoria.map(d => ({ 'Categoria': d.categoria, 'Orçado': round2(d.orcado), 'Realizado': round2(d.realizado) }));
    if (tipoRelatorio === 'comparacao') return dadosComparacao.map(d => ({ 'Obra': d.obra, '% Progresso': round2(d.progresso), 'Realizado': round2(d.custos) }));
    if (tipoRelatorio === 'medicoes') return medicoesObra.map(m => ({ 'Número': m.numero, 'Período': `${m.data_inicio || ''} - ${m.data_fim || ''}`, '% Físico': round2(m.percent_concluida), 'Valor': round2(m.total_acumulado), 'Status': m.status }));
    return [];
  };

  // Título e formatos (moeda/%) por tipo de relatório, p/ o Excel branded.
  const TITULOS_XLSX = {
    progresso: 'Progresso Físico-Financeiro',
    custos: 'Controle de Custos',
    custos_categoria: 'Custos por Categoria',
    comparacao: 'Comparação entre Obras',
    medicoes: 'Medições (Boletins)',
  };
  const FORMATOS_XLSX = {
    progresso: { percentual: [1, 2] },
    custos: { moeda: [1] },
    custos_categoria: { moeda: [1, 2] },
    comparacao: { percentual: [1], moeda: [2] },
    medicoes: { percentual: [2], moeda: [3] },
  };

  const gerarExcel = () => {
    if (!obraId) { toast.error('Selecione uma obra'); return; }
    const rows = linhasRelatorio();
    if (!rows.length) { toast.error('Sem dados para exportar neste relatório'); return; }
    try {
      const headers = Object.keys(rows[0]);
      exportarXLSXBranded(`relatorio-${tipoRelatorio}-${obraSelecionada?.nome || 'obra'}`, [{
        nome: tipoRelatorio.slice(0, 31),
        titulo: TITULOS_XLSX[tipoRelatorio] || 'Relatório',
        subtitulo: obraSelecionada?.nome || '',
        headers,
        rows: rows.map((r) => headers.map((h) => r[h])),
        ...(FORMATOS_XLSX[tipoRelatorio] || {}),
      }], { empresa, branding });
      toast.success('Excel gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar Excel: ' + error.message);
    }
  };

  const exportarCSV = () => {
    if (!obraId) { toast.error('Selecione uma obra'); return; }
    const rows = linhasRelatorio();
    if (!rows.length) { toast.error('Sem dados para exportar neste relatório'); return; }
    const header = Object.keys(rows[0]);
    exportarCSVBR(
      `relatorio-${tipoRelatorio}-${obraSelecionada?.nome || 'obra'}.csv`,
      header,
      rows.map((r) => header.map((h) => csvNum(r[h])))
    );
    toast.success('CSV exportado!');
  };

  // Formatação de célula para o PDF: aplica moeda/% conforme os índices já mapeados em FORMATOS_XLSX.
  const fmtCelulaPDF = (valor, colIdx) => {
    const fmt = FORMATOS_XLSX[tipoRelatorio] || {};
    if ((fmt.moeda || []).includes(colIdx)) return moeda(valor);
    if ((fmt.percentual || []).includes(colIdx)) return `${round2(valor)}%`;
    return String(valor ?? '');
  };

  const gerarPDF = async () => {
    if (!obraId) { toast.error('Selecione uma obra'); return; }
    const rows = linhasRelatorio();
    if (!rows.length) { toast.error('Sem dados para exportar neste relatório'); return; }
    try {
      const header = Object.keys(rows[0]);
      const titulo = TITULOS_XLSX[tipoRelatorio] || 'Relatório';
      const doc = novoPDF();
      let y = await cabecalhoPDF(doc, {
        empresa,
        branding,
        titulo,
        subtitulo: obraSelecionada?.nome || '',
      });

      // Resumo da obra
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Status', (obraSelecionada?.status || '—').replace('_', ' ')],
          ['Progresso físico', `${obraSelecionada?.percentual_concluido || 0}%`],
          ['Valor contrato', moeda(obraSelecionada?.valor_contrato || obraSelecionada?.total_orcamento)],
          ['Valor realizado', moeda(obraSelecionada?.valor_realizado)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
        tableWidth: 90,
      }));
      y = doc.lastAutoTable.finalY + 8;

      // Tabela do relatório
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [header],
        body: rows.map((r) => header.map((h, i) => fmtCelulaPDF(r[h], i))),
        styles: { fontSize: 8, cellPadding: 2 },
      }));

      rodapePDF(doc, { empresa, branding, titulo });
      doc.save(`relatorio-${tipoRelatorio}-${obraSelecionada?.nome || 'obra'}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar PDF: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios e Análises"
        subtitle="Geração de relatórios customizáveis"
        actionIcon={FileText}
      />

      {/* Filtros */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-4 border-b border-gray-200">
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            Filtros de Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Tipo</Label>
                <Select value={tipoRelatorio} onValueChange={(v) => setTipoRelatorio(v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="progresso">Progresso Físico-Financeiro</SelectItem>
                    <SelectItem value="custos">Controle de Custos</SelectItem>
                    <SelectItem value="custos_categoria">Custos por Categoria</SelectItem>
                    <SelectItem value="medicoes">Resumo de Medições</SelectItem>
                    <SelectItem value="comparacao">Comparação de Obras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Obra Principal</Label>
                <ComboboxBusca
                  options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                  value={obraId}
                  onSelect={(v) => setObraId(v || '')}
                  placeholder="Selecione a obra"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra."
                />
              </div>
              {tipoRelatorio === 'comparacao' && (
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Comparar com</Label>
                  <ComboboxBusca
                    options={obras.filter(o => o.id !== obraId).map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                    value={comparacaoObra2}
                    onSelect={(v) => setComparacaoObra2(v || '')}
                    placeholder="Selecione outra obra"
                    searchPlaceholder="Buscar obra..."
                    emptyMessage="Nenhuma obra."
                  />
                </div>
              )}
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Período</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana">Última Semana</SelectItem>
                    <SelectItem value="mes">Último Mês</SelectItem>
                    <SelectItem value="trimestre">Último Trimestre</SelectItem>
                    <SelectItem value="ano">Último Ano</SelectItem>
                    <SelectItem value="completo">Período Completo</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {periodo === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Data Início</Label>
                  <Input className="h-11" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</Label>
                  <Input className="h-11" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
              <Button onClick={gerarExcel} disabled={!obraId} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2">
                <Download className="w-4 h-4" /> Excel
              </Button>
              <Button onClick={exportarCSV} disabled={!obraId} variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700 gap-2">
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </Button>
              <Button onClick={gerarPDF} disabled={!obraId} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 gap-2">
                <Download className="w-4 h-4" /> PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview do Relatório */}
      {obraId && (
        <>
          {/* Resumo da Obra */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">{obraSelecionada?.nome}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="text-gray-900 font-medium capitalize">{obraSelecionada?.status?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Progresso Físico</p>
                  <p className="text-emerald-600 font-bold">{obraSelecionada?.percentual_concluido || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Contrato</p>
                  <p className="text-gray-900 font-medium">{moeda(obraSelecionada?.valor_contrato || obraSelecionada?.total_orcamento)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Realizado</p>
                  <p className="text-gray-900 font-medium">{moeda(obraSelecionada?.valor_realizado)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sem dados para o relatório selecionado */}
          {!temDadosRelatorio && (
            <Card className="bg-white border-gray-200">
              <CardContent className="py-10 text-center">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-700 font-medium">Sem dados para este relatório nesta obra</p>
                <p className="text-sm text-gray-500 mt-1">
                  {tipoRelatorio === 'progresso' || tipoRelatorio === 'medicoes'
                    ? 'Esta obra não possui medições cadastradas.'
                    : 'Não há valores suficientes para gerar este relatório.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Gráficos */}
          {tipoRelatorio === 'progresso' && dadosProgresso.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Evolução do Progresso Físico e Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dadosProgresso}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="numero" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="fisico" stroke="#10B981" name="% Físico" strokeWidth={2} />
                    <Line type="monotone" dataKey="financeiro" stroke="#F59E0B" name="% Financeiro" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>

                {/* Tabela do progresso (desktop) */}
                <div className="hidden md:block overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Medição</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">% Físico</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">% Financeiro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dadosProgressoPag.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{d.numero}</td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">{round2(d.fisico)}%</td>
                          <td className="p-3 text-right text-amber-600 font-semibold">{round2(d.financeiro)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards mobile */}
                <div className="md:hidden flex flex-col gap-2 mt-4">
                  {dadosProgressoPag.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">Medição {d.numero}</span>
                      <div className="flex gap-4 text-sm">
                        <span className="text-emerald-600 font-semibold">{round2(d.fisico)}% fís.</span>
                        <span className="text-amber-600 font-semibold">{round2(d.financeiro)}% fin.</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination currentPage={pagProg.currentPage} totalPages={pagProg.totalPages} onPageChange={pagProg.goToPage} startIndex={pagProg.startIndex} endIndex={pagProg.endIndex} totalItems={pagProg.totalItems} />
              </CardContent>
            </Card>
          )}

          {tipoRelatorio === 'custos' && dadosCustos.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  Análise de Custos - Orçado vs Realizado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosCustos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="categoria" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip formatter={(value) => moeda(value)} />
                    <Bar dataKey="valor" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-500">Orçado</p>
                      <p className="text-gray-900 font-bold">{moeda(orcadoVal)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Realizado</p>
                      <p className="text-gray-900 font-bold">{moeda(obraSelecionada?.valor_realizado)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Variação</p>
                      <p className={`font-bold ${(obraSelecionada?.valor_realizado || 0) > orcadoVal ? 'text-red-600' : 'text-emerald-600'}`}>
                        {orcadoVal ? (((obraSelecionada?.valor_realizado || 0) / orcadoVal - 1) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {tipoRelatorio === 'custos_categoria' && dadosPorCategoria.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  Orçado vs Realizado por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={dadosPorCategoria}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="categoria" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip formatter={(value) => moeda(value)} />
                    <Legend />
                    <Bar dataKey="orcado" fill="#10B981" name="Orçado" />
                    <Bar dataKey="realizado" fill="#F59E0B" name="Realizado" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {tipoRelatorio === 'comparacao' && dadosComparacao.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  Comparação entre Obras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosComparacao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="obra" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="progresso" fill="#8B5CF6" name="% Progresso" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {dadosComparacao.map((d, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-sm text-gray-500 mb-2">{d.obra}</p>
                      <p className="text-gray-900 text-xl font-bold">{d.progresso.toFixed(1)}%</p>
                      <p className="text-sm text-gray-500">{moeda(d.custos)} realizado</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tipoRelatorio === 'medicoes' && medicoesObra.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-purple-500" />
                  Resumo de Medições
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Medição</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Período</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">% Físico</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {medicoesPag.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">Medição {m.numero}</td>
                          <td className="p-3 text-gray-600">
                            {m.data_inicio ? new Date(m.data_inicio).toLocaleDateString('pt-BR') : '-'} – {m.data_fim ? new Date(m.data_fim).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">{(Number(m.percent_concluida) || 0).toFixed(2)}%</td>
                          <td className="p-3 text-right font-semibold text-gray-900">{moeda(m.total_acumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards mobile */}
                <div className="md:hidden flex flex-col gap-2">
                  {medicoesPag.map(m => (
                    <div key={m.id} className="p-3 rounded-lg border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900">Medição {m.numero}</span>
                        <span className="font-semibold text-gray-900">{moeda(m.total_acumulado)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{m.data_inicio ? new Date(m.data_inicio).toLocaleDateString('pt-BR') : '-'} – {m.data_fim ? new Date(m.data_fim).toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="text-emerald-600 font-semibold">{(Number(m.percent_concluida) || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination currentPage={pagMed.currentPage} totalPages={pagMed.totalPages} onPageChange={pagMed.goToPage} startIndex={pagMed.startIndex} endIndex={pagMed.endIndex} totalItems={pagMed.totalItems} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}