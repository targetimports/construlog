import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import {
  ArrowLeft,
  Edit,
  FileText,
  TrendingUp,
  Calendar,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
  PieChart as PieChartIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable } from '@/lib/pdfBrand';
import GanttChart from '../components/orcamento/GanttChart';
import ConverterParaCompra from '../components/orcamento/ConverterParaCompra';
import CotacoesItem from '../components/orcamento/CotacoesItem';
import CronogramaGantt from '../components/orcamento/CronogramaGantt';
import LinkModulos from '../components/shared/LinkModulos';

// Paleta dos gráficos sem azul (slate, esmeralda, roxo, âmbar).
const COLORS = ['#475569', '#10B981', '#8B5CF6', '#F59E0B'];

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusConfig = {
  rascunho:   { label: 'Rascunho',   color: 'bg-gray-100 text-gray-600 border-gray-200',       icon: FileText },
  em_analise: { label: 'Em Análise', color: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Clock },
  aprovado:   { label: 'Aprovado',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  rejeitado:  { label: 'Rejeitado',  color: 'bg-red-50 text-red-700 border-red-200',           icon: XCircle },
  vigente:    { label: 'Vigente',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle }
};

export default function OrcamentoDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const orcamentoId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [itemParaComprar, setItemParaComprar] = useState(null);
  const [itemCotacoes, setItemCotacoes] = useState(null);

  const { data: orcamentoData, isLoading } = useQuery({
    queryKey: ['orcamento', orcamentoId],
    queryFn: () => base44.entities.Orcamento.filter({ id: orcamentoId }),
    enabled: !!orcamentoId
  });

  const { data: itens = [] } = useQuery({
    queryKey: ['itens-orcamento', orcamentoId],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId }),
    enabled: !!orcamentoId
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Itens do cronograma físico (datas por atividade) — usados para distribuir
  // o valor de cada item do orçamento ao longo dos meses de execução.
  const obraIdAtual = orcamentoData?.[0]?.obra_id;

  // Branding da empresa da obra (logo + CNPJ) para o PDF cliente-facing.
  const obraDoOrcamento = obras.find((o) => o.id === obraIdAtual);
  const { empresa, branding } = useEmpresaBranding(obraDoOrcamento?.empresa_id);
  const { data: cronogramaItens = [] } = useQuery({
    queryKey: ['cronograma-fisfinan', obraIdAtual],
    queryFn: () => base44.entities.CronogramaItem.filter({ obraId: obraIdAtual }),
    enabled: !!obraIdAtual
  });

  // Distribuição mensal (físico-financeiro) persistida no import.
  const { data: periodosCronograma = [] } = useQuery({
    queryKey: ['cronograma-periodos', obraIdAtual],
    queryFn: () => base44.entities.CronogramaItemPeriodo.filter({ obra_id: obraIdAtual }),
    enabled: !!obraIdAtual
  });

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Orcamento.update(orcamentoId, {
        status: 'aprovado',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento', orcamentoId] });
      toast.success('Orçamento aprovado!');
    }
  });

  const rejeitarMutation = useMutation({
    mutationFn: () => base44.entities.Orcamento.update(orcamentoId, { status: 'rejeitado' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento', orcamentoId] });
      toast.success('Orçamento rejeitado');
    }
  });

  const ativarObraMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('ativarObraAPartirDoOrcamento', { orcamento_id: orcamentoId });
      return response?.data || response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento', orcamentoId] });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Obra ativada com sucesso! Todos os módulos estão disponíveis.');
      setTimeout(() => {
        if (data?.obra_id) window.location.href = createPageUrl(`ObraDetalhes?id=${data.obra_id}`);
      }, 500);
    },
    onError: (error) => {
      toast.error('Erro ao ativar obra: ' + (error?.message || 'tente novamente'));
    }
  });

  // Geração de PDF client-side (jsPDF) — não depende de função no backend.
  // Documento cliente-facing com cabeçalho de marca (logo + empresa + CNPJ).
  const handleDownloadPDF = async () => {
    if (!orcamento) return;
    setDownloadingPDF(true);
    try {
      const doc = novoPDF();
      const M = 14;
      const subtitulo = [obra?.nome, orcamento.versao ? `v${orcamento.versao}` : null]
        .filter(Boolean).join(' · ');
      let y = await cabecalhoPDF(doc, {
        empresa,
        branding,
        titulo: 'Proposta Orçamentária',
        subtitulo,
      });

      // Resumo do orçamento (título/obra/versão/valores) antes da tabela de itens.
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Proposta', 'Detalhe']],
        body: [
          ['Título', orcamento.titulo || 'Orçamento'],
          ['Obra', obra?.nome || '—'],
          ['Versão', orcamento.versao != null ? String(orcamento.versao) : '—'],
          ['Valor total', fmtBRL(orcamento.valor_total)],
          ...(orcamento.valor_proposta ? [['Valor proposta', fmtBRL(orcamento.valor_proposta)]] : []),
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
      }));
      y = doc.lastAutoTable.finalY + 8;

      // Tabela de itens do orçamento (mesmas colunas/dados de antes).
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Cat.', 'Descrição', 'Un', 'Qtd', 'Unitário', 'Total']],
        body: (itens || []).map((i) => [
          (i.categoria || '').replace(/_/g, ' '),
          i.descricao || '',
          i.unidade || '',
          i.quantidade ?? '',
          fmtBRL(i.valor_unitario),
          fmtBRL(i.valor_total),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
      }));

      rodapePDF(doc, { empresa, branding, titulo: 'Proposta Orçamentária' });
      const nomeArq = `proposta-${(obra?.nome || 'orcamento').toString().slice(0, 30).replace(/\s+/g, '-')}-v${orcamento.versao || '0'}.pdf`;
      doc.save(nomeArq);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar PDF: ' + (error?.message || 'tente novamente'));
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-gray-200" />
        <Skeleton className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const orcamento = orcamentoData?.[0];
  if (!orcamento) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Orçamento não encontrado</p>
      </div>
    );
  }

  const obra = obras.find(o => o.id === orcamento.obra_id);
  const status = statusConfig[orcamento.status] || statusConfig.rascunho;
  const StatusIcon = status.icon;

  // Valor total robusto: usa o do orçamento ou soma os itens (evita divisão por zero).
  const valorTotalOrc = orcamento.valor_total || itens.reduce((s, i) => s + (i.valor_total || 0), 0) || 0;
  const denom = valorTotalOrc || 1;

  // CUSTO PREVISTO — o que o orçamento diz que a obra deve custar, ao lado do
  // que ela vai faturar. É a linha-base do controle de desvio: sem ela, medir
  // avanço não produz "o que isto deveria ter custado".
  //
  // Um item só conta se o custo for MENOR que a venda. Custo igual à venda não
  // é margem zero, é custo desconhecido — herança da importação antiga, que
  // gravava o mesmo número nos dois campos. Somá-lo afundaria a margem do
  // orçamento inteiro e faria uma obra saudável parecer no prejuízo.
  const temCusto = (i) => {
    const c = Number(i.custo_total) || 0;
    const v = Number(i.valor_total) || 0;
    return c > 0 && v > 0 && c < v * 0.9999;
  };
  const itensComCusto = itens.filter(temCusto);
  const custoPrevisto = itensComCusto.reduce((s, i) => s + (Number(i.custo_total) || 0), 0);
  const vendaComCusto = itensComCusto.reduce((s, i) => s + (Number(i.valor_total) || 0), 0);
  const margemPrevista = vendaComCusto > 0 ? ((vendaComCusto - custoPrevisto) / vendaComCusto) * 100 : null;
  // Quanto do orçamento tem custo conhecido. Abaixo de 100% a margem é real,
  // porém parcial — e o cartão precisa dizer isso em vez de fingir cobertura total.
  const coberturaCusto = valorTotalOrc > 0 ? (vendaComCusto / valorTotalOrc) * 100 : 0;

  // Dados para gráficos
  const distribuicaoCategoria = [
    { name: 'Materiais', value: orcamento.valor_total_materiais || 0 },
    { name: 'Mão de Obra', value: orcamento.valor_total_mao_obra || 0 },
    { name: 'Equipamentos', value: orcamento.valor_total_equipamentos || 0 },
    { name: 'Transporte', value: orcamento.valor_total_transporte || 0 }
  ].filter(item => item.value > 0);

  // Curva ABC
  const itensOrdenados = [...itens]
    .sort((a, b) => (b.valor_total || 0) - (a.valor_total || 0))
    .map((item, index, arr) => {
      const percAcumulado = arr
        .slice(0, index + 1)
        .reduce((acc, i) => acc + (i.valor_total || 0), 0) / denom * 100;

      let classe = 'C';
      if (percAcumulado <= 80) classe = 'A';
      else if (percAcumulado <= 95) classe = 'B';

      return { ...item, percentual_acumulado: percAcumulado, classe_abc: classe };
    });

  // Cronograma físico-financeiro (por mês real do calendário).
  // O valor de cada item do orçamento é distribuído igualmente pelos meses de
  // execução da atividade correspondente no cronograma físico (CronogramaItem),
  // casada pela descrição/nome da atividade.
  const mapaDatasAtividade = {};
  for (const c of cronogramaItens) {
    const nome = String(c.nomeAtividade || '').trim().toLowerCase();
    if (nome && !mapaDatasAtividade[nome]) {
      mapaDatasAtividade[nome] = { inicio: c.dataInicioPlanejada, fim: c.dataFimPlanejada };
    }
  }

  const mesesEntre = (inicio, fim) => {
    const di = new Date(inicio);
    let df = fim ? new Date(fim) : di;
    if (isNaN(di)) return [];
    if (isNaN(df) || df < di) df = di;
    const meses = [];
    const cur = new Date(di.getFullYear(), di.getMonth(), 1);
    const end = new Date(df.getFullYear(), df.getMonth(), 1);
    while (cur <= end) {
      meses.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return meses;
  };

  const acumPorMes = {};
  for (const item of itens) {
    const valor = item.valor_total || 0;
    if (!valor) continue;
    const datas = mapaDatasAtividade[String(item.descricao || '').trim().toLowerCase()];
    const inicio = datas?.inicio || obra?.data_inicio;
    const fim = datas?.fim || obra?.data_prevista_fim || inicio;
    let meses = inicio ? mesesEntre(inicio, fim) : [];
    if (meses.length === 0) meses = ['Sem data'];
    const valorPorMes = valor / meses.length;
    for (const m of meses) acumPorMes[m] = (acumPorMes[m] || 0) + valorPorMes;
  }

  const nomeMes = (chave) => {
    if (chave === 'Sem data' || /^P\d+$/.test(chave)) return chave;
    const [y, mm] = chave.split('-');
    return `${mm}/${y}`;
  };

  // Fonte preferencial: distribuição mensal persistida (CronogramaItemPeriodo).
  // Cada registro traz percent e/ou valor; quando só há percent, multiplica pelo
  // valor_total do item do orçamento correspondente (casado pela descrição).
  if (periodosCronograma.length > 0) {
    // Período é a fonte autoritativa: descarta a estimativa por datas.
    for (const k of Object.keys(acumPorMes)) delete acumPorMes[k];
    const valorPorDesc = {};
    for (const it of itens) valorPorDesc[String(it.descricao || '').trim().toLowerCase()] = it.valor_total || 0;
    for (const p of periodosCronograma) {
      const mesKey = p.mes || `P${(p.ordem ?? 0) + 1}`;
      let v = Number(p.valor) || 0;
      if (!v && p.percent) v = (Number(p.percent) / 100) * (valorPorDesc[String(p.atividade || '').trim().toLowerCase()] || 0);
      if (!v) continue;
      acumPorMes[mesKey] = (acumPorMes[mesKey] || 0) + v;
    }
  }

  const cronograma = Object.keys(acumPorMes)
    .sort((a, b) => (a === 'Sem data' ? 1 : b === 'Sem data' ? -1 : a.localeCompare(b)))
    .map((m) => ({
      mes: nomeMes(m),
      valor: acumPorMes[m],
      percentual: (acumPorMes[m] / denom) * 100,
    }));

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl(orcamento.obra_id ? `ObraDetalhes?id=${orcamento.obra_id}` : 'Orcamentos')}
            className="text-gray-500 hover:text-gray-900 flex-shrink-0"
          >
            <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{orcamento.titulo}</h1>
              <Badge className={cn("border", status.color)} variant="outline">
                <StatusIcon className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">{status.label}</span>
                <span className="sm:hidden text-xs">{status.label}</span>
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{obra?.nome || 'Obra não encontrada'} • v{orcamento.versao}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {orcamento.status === 'rascunho' && (
            <Button
              onClick={() => {
                base44.entities.Orcamento.update(orcamentoId, { status: 'em_analise' });
                queryClient.invalidateQueries({ queryKey: ['orcamento', orcamentoId] });
                toast.success('Enviado para análise');
              }}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 text-xs sm:text-sm h-8 sm:h-10"
            >
              <Clock className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Enviar para Análise</span>
              <span className="sm:hidden">Análise</span>
            </Button>
          )}
          {orcamento.status === 'em_analise' && (
            <>
              <Button
                onClick={() => aprovarMutation.mutate()}
                disabled={aprovarMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs sm:text-sm h-8 sm:h-10"
                size="sm"
              >
                <CheckCircle className="w-3 sm:w-4 h-3 sm:h-4" />
                <span className="hidden sm:inline">Aprovar</span>
              </Button>
              <Button
                onClick={() => rejeitarMutation.mutate()}
                disabled={rejeitarMutation.isPending}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 gap-2 text-xs sm:text-sm h-8 sm:h-10"
                size="sm"
              >
                <XCircle className="w-3 sm:w-4 h-3 sm:h-4" />
                <span className="hidden sm:inline">Rejeitar</span>
              </Button>
            </>
          )}
          {orcamento.status === 'aprovado' && (
            <Button
              onClick={() => ativarObraMutation.mutate()}
              disabled={ativarObraMutation.isPending}
              className="bg-gray-900 hover:bg-gray-800 text-white gap-2 text-xs sm:text-sm h-8 sm:h-10"
              size="sm"
            >
              <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">{ativarObraMutation.isPending ? 'Ativando...' : 'Ativar Obra'}</span>
              <span className="sm:hidden">Ativar</span>
            </Button>
          )}
          <Button
            onClick={() => window.location.href = createPageUrl(`OrcamentoForm?id=${orcamento.id}`)}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 text-xs sm:text-sm h-8 sm:h-10"
            size="sm"
          >
            <Edit className="w-3 sm:w-4 h-3 sm:h-4" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="bg-amber-500 hover:bg-amber-600 text-white gap-2 text-xs sm:text-sm h-8 sm:h-10"
            size="sm"
          >
            <Download className="w-3 sm:w-4 h-3 sm:h-4" />
            <span className="hidden sm:inline">{downloadingPDF ? 'Gerando...' : 'PDF'}</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {/* Links Rápidos */}
      <LinkModulos
        tipo="orcamento"
        dados={{
          obra_id: orcamento.obra_id
        }}
      />

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-gray-500 text-xs sm:text-sm mb-1">Valor Total</p>
            <p className="text-gray-900 text-lg sm:text-xl font-bold truncate">
              {fmtBRL(orcamento.valor_total)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-slate-600 text-xs sm:text-sm mb-1">Materiais</p>
            <p className="text-gray-900 text-lg sm:text-xl font-bold truncate">
              {fmtBRL(orcamento.valor_total_materiais)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-emerald-700 text-xs sm:text-sm mb-1">Mão de Obra</p>
            <p className="text-gray-900 text-lg sm:text-xl font-bold truncate">
              {fmtBRL(orcamento.valor_total_mao_obra)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-purple-700 text-xs sm:text-sm mb-1">Equipamentos</p>
            <p className="text-gray-900 text-lg sm:text-xl font-bold truncate">
              {fmtBRL(orcamento.valor_total_equipamentos)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-amber-700 text-xs sm:text-sm mb-1">Valor Proposta</p>
            <p className="text-amber-700 text-lg sm:text-xl font-bold truncate">
              {fmtBRL(orcamento.valor_proposta)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Custo previsto x venda — a linha-base do controle de desvio.
          Só aparece quando o orçamento traz custo próprio: orçamento sem custo
          não deve exibir margem nenhuma, nem 0%, nem 100%. */}
      {itensComCusto.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 sm:p-4">
              <p className="text-blue-700 text-xs sm:text-sm mb-1">Custo Previsto</p>
              <p className="text-gray-900 text-lg sm:text-xl font-bold truncate">{fmtBRL(custoPrevisto)}</p>
              <p className="text-blue-600/70 text-[11px] mt-1">o que a obra deve custar</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-3 sm:p-4">
              <p className="text-gray-500 text-xs sm:text-sm mb-1">Margem Prevista</p>
              <p className={`text-lg sm:text-xl font-bold truncate ${margemPrevista >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {margemPrevista == null ? '—' : `${margemPrevista.toFixed(1)}%`}
              </p>
              <p className="text-gray-400 text-[11px] mt-1">{fmtBRL(vendaComCusto - custoPrevisto)} de resultado</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-3 sm:p-4">
              <p className="text-gray-500 text-xs sm:text-sm mb-1">Cobertura do Custo</p>
              <p className={`text-lg sm:text-xl font-bold truncate ${coberturaCusto >= 99.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {coberturaCusto.toFixed(0)}%
              </p>
              <p className="text-gray-400 text-[11px] mt-1">
                {itensComCusto.length} de {itens.length} {itens.length === 1 ? 'item tem' : 'itens têm'} custo
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs de Análise */}
      <Tabs defaultValue="distribuicao" className="w-full">
        <TabsList className="bg-gray-100 border border-gray-200 overflow-x-auto w-full h-auto flex-wrap">
          <TabsTrigger value="distribuicao" className="text-xs sm:text-sm">Distribuição</TabsTrigger>
          <TabsTrigger value="abc" className="text-xs sm:text-sm">Curva ABC</TabsTrigger>
          <TabsTrigger value="cronograma" className="text-xs sm:text-sm">Cronograma</TabsTrigger>
          <TabsTrigger value="gantt" className="text-xs sm:text-sm">Gantt</TabsTrigger>
          <TabsTrigger value="itens" className="text-xs sm:text-sm">Itens</TabsTrigger>
        </TabsList>

        <TabsContent value="distribuicao">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-base sm:text-lg">Distribuição por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 overflow-x-auto">
              {distribuicaoCategoria.length === 0 ? (
                <div className="h-60 sm:h-80 w-full flex flex-col items-center justify-center text-center gap-2 px-4">
                  <PieChartIcon className="w-10 h-10 text-gray-300" />
                  <p className="text-gray-600 font-medium">Sem distribuição por categoria</p>
                  <p className="text-gray-400 text-sm max-w-md">
                    Este orçamento não tem os totais por categoria (materiais, mão de obra, equipamentos, transporte).
                    A planilha sintética do OrçaFascio não traz essa classificação — os valores estão detalhados nas abas
                    <span className="font-medium"> Curva ABC</span> e <span className="font-medium">Itens</span>.
                  </p>
                </div>
              ) : (
              <div className="h-60 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribuicaoCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${(entry.value / denom * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {distribuicaoCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        color: '#111827'
                      }}
                      formatter={(value) => fmtBRL(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abc">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-base sm:text-lg">Curva ABC - Classificação de Insumos</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-gray-500">Classe</TableHead>
                    <TableHead className="text-gray-500">Descrição</TableHead>
                    <TableHead className="text-gray-500 text-right">Valor</TableHead>
                    <TableHead className="text-gray-500 text-right">% do Total</TableHead>
                    <TableHead className="text-gray-500 text-right">% Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensOrdenados.map((item) => (
                    <TableRow key={item.id} className="border-gray-200">
                      <TableCell>
                        <Badge className={cn(
                          "border",
                          item.classe_abc === 'A' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          item.classe_abc === 'B' && "bg-amber-50 text-amber-700 border-amber-200",
                          item.classe_abc === 'C' && "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {item.classe_abc}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-900">{item.descricao}</TableCell>
                      <TableCell className="text-gray-900 text-right">
                        {fmtBRL(item.valor_total)}
                      </TableCell>
                      <TableCell className="text-gray-900 text-right">
                        {((item.valor_total || 0) / denom * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-gray-900 text-right">
                        {(item.percentual_acumulado || 0).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cronograma">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-base sm:text-lg">Cronograma Físico-Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 overflow-x-auto">
              {cronograma.length === 0 ? (
                <div className="h-60 sm:h-80 w-full flex flex-col items-center justify-center text-center gap-2 px-4">
                  <Calendar className="w-10 h-10 text-gray-300" />
                  <p className="text-gray-600 font-medium">Sem cronograma físico-financeiro</p>
                  <p className="text-gray-400 text-sm max-w-md">
                    Não há datas de execução associadas aos itens deste orçamento. Importe ou cadastre o
                    cronograma da obra para visualizar a distribuição financeira por mês.
                  </p>
                </div>
              ) : (
              <>
              <div className="h-60 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cronograma}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mes" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${(v/1000)}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        color: '#111827'
                      }}
                      formatter={(value) => fmtBRL(value)}
                    />
                    <Bar dataKey="valor" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Tabela de Valores */}
              <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {cronograma.map((mes) => (
                  <div key={mes.mes} className="bg-gray-50 border border-gray-200 p-2 sm:p-4 rounded-xl">
                    <p className="text-gray-500 text-xs sm:text-sm">{mes.mes}</p>
                    <p className="text-gray-900 text-xs sm:text-base font-semibold truncate">
                      {fmtBRL(mes.valor)}
                    </p>
                    <p className="text-amber-600 text-xs">{mes.percentual.toFixed(1)}% do total</p>
                  </div>
                ))}
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gantt">
          <CronogramaGantt
            itens={itens}
            onItensChange={async (novosItens) => {
              // Persiste apenas os itens cujos campos de cronograma mudaram.
              const orig = new Map(itens.map((i) => [i.id, i]));
              const mudados = novosItens.filter((n) => {
                const o = orig.get(n.id);
                if (!o || !n.id) return false;
                return o.data_inicio !== n.data_inicio
                  || o.data_fim !== n.data_fim
                  || o.duracao_dias !== n.duracao_dias
                  || JSON.stringify(o.predecessores || null) !== JSON.stringify(n.predecessores || null);
              });
              if (mudados.length === 0) return;
              try {
                await Promise.all(mudados.map((m) => base44.entities.ItemOrcamento.update(m.id, {
                  data_inicio: m.data_inicio || null,
                  data_fim: m.data_fim || null,
                  duracao_dias: m.duracao_dias || null,
                  predecessores: m.predecessores || null,
                })));
              } catch (e) {
                toast.error('Erro ao salvar o cronograma');
              }
            }}
            onDatasObraChange={async (campo, valor) => {
              if (!obra?.id) return;
              const mapa = { data_inicio: 'data_inicio', data_fim: 'data_prevista_fim' };
              try {
                await base44.entities.Obra.update(obra.id, { [mapa[campo]]: valor || null });
              } catch (e) {
                toast.error('Erro ao salvar as datas da obra');
              }
            }}
            dataInicioObra={obra?.data_inicio}
            dataFimObra={obra?.data_prevista_fim}
          />
        </TabsContent>

        <TabsContent value="itens">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-base sm:text-lg">Todos os Itens do Orçamento</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 overflow-x-auto -mx-4 sm:mx-0">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-gray-500 text-xs">Cat.</TableHead>
                    <TableHead className="text-gray-500 text-xs">Descrição</TableHead>
                    <TableHead className="text-gray-500 text-xs">Un</TableHead>
                    <TableHead className="text-gray-500 text-right text-xs">Qtd</TableHead>
                    <TableHead className="text-gray-500 text-right text-xs hidden lg:table-cell">Custo Unit.</TableHead>
                    <TableHead className="text-gray-500 text-right text-xs hidden sm:table-cell">Unit.</TableHead>
                    <TableHead className="text-gray-500 text-right text-xs">Total</TableHead>
                    <TableHead className="text-gray-500 text-center text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <React.Fragment key={item.id}>
                      <TableRow className="border-gray-200">
                        <TableCell className="text-gray-900 text-xs capitalize truncate max-w-xs">
                          {(item.categoria || '').replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-gray-900 text-xs truncate max-w-xs">{item.descricao}</TableCell>
                        <TableCell className="text-gray-500 text-xs">{item.unidade}</TableCell>
                        <TableCell className="text-gray-900 text-right text-xs">{item.quantidade}</TableCell>
                        {/* Custo unitário: "—" quando desconhecido (custo igual
                            à venda), para não passar por margem zero. */}
                        <TableCell className="text-blue-700 text-right text-xs hidden lg:table-cell">
                          {temCusto(item) ? fmtBRL(item.custo_unitario) : '—'}
                        </TableCell>
                        <TableCell className="text-gray-900 text-right text-xs hidden sm:table-cell">
                          {fmtBRL(item.valor_unitario)}
                        </TableCell>
                        <TableCell className="text-gray-900 text-right text-xs font-semibold">
                          {fmtBRL(item.valor_total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {(item.categoria === 'materiais' || item.categoria === 'equipamentos') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setItemParaComprar(item)}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-6 w-6 p-0"
                              >
                                <ShoppingCart className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setItemCotacoes(itemCotacoes?.id === item.id ? null : item)}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs h-6"
                            >
                              <span className="hidden sm:inline">Cotações</span>
                              <span className="sm:hidden">Cot.</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {itemCotacoes?.id === item.id && (
                        <TableRow className="border-gray-200">
                          <TableCell colSpan={8} className="p-4 bg-gray-50">
                            <CotacoesItem
                              itemId={item.id}
                              valorOrcado={item.valor_unitario}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Converter para Compra */}
      {itemParaComprar && (
        <ConverterParaCompra
          item={itemParaComprar}
          orcamento={orcamento}
          onClose={() => setItemParaComprar(null)}
        />
      )}
    </div>
  );
}
