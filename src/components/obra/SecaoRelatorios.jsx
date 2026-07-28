import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, FileText, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable, PDF_ACCENT, PDF_INK, PDF_MUTE, PDF_STRIPE, PDF_LINE } from '@/lib/pdfBrand';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

export default function SecaoRelatorios({ obraId, obra }) {
  const [tipoRelatorio, setTipoRelatorio] = useState('resumo');
  const { empresa, branding } = useEmpresaBranding(obra?.empresa_id);

  // Medição canônica = BM (boletins de medição). Só as APROVADAS contam como medição oficial.
  const { data: bms = [], isLoading: loadingBms } = useQuery({
    queryKey: ['bms-relatorio', obraId],
    queryFn: () => base44.entities.BM.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId
  });

  const { data: orcamentos = [], isLoading: loadingOrcamentos } = useQuery({
    queryKey: ['orcamentos-relatorio', obraId],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  if (loadingOrcamentos || loadingBms) {
    return <Skeleton className="h-96 bg-gray-100 rounded-lg" />;
  }

  const orcamentoAtivo = orcamentos[0];

  // Só BMs APROVADAS entram no relatório (ordenadas por número, cronológico).
  const bmsAprovadas = [...bms]
    .filter((b) => b.status === 'APROVADA')
    .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

  const medicoesCount = bmsAprovadas.length;
  const ultimaBM = bmsAprovadas[bmsAprovadas.length - 1];
  const ultimaMedicaoData = ultimaBM ? (ultimaBM.data_fim || ultimaBM.created_date) : null;

  // Base = valor do CONTRATO (padrão do sistema; não valor_orcado).
  const contrato = obra?.valor_contrato || orcamentoAtivo?.valor_total || obra?.valor_orcado || obra?.total_orcamento || 0;
  const realizado = obra?.valor_realizado || (bmsAprovadas.length ? Math.max(...bmsAprovadas.map((b) => Number(b.total_acumulado) || 0)) : 0);
  const pctExec = contrato > 0 ? (realizado / contrato) * 100 : 0;
  const saldo = contrato - realizado;

  // Variáveis usadas pela tela (cards/gráfico) — base = contrato.
  const orcadoBase = contrato;
  const temRealizado = realizado > 0 && orcadoBase > 0;
  const variacao = temRealizado ? ((realizado - orcadoBase) / orcadoBase) * 100 : null;

  const evolutionData = [
    { periodo: 'Planejado', orçado: orcadoBase, realizado: 0 },
    { periodo: 'Atual', orçado: orcadoBase, realizado },
  ];

  const gerarPDF = async () => {
    try {
      const doc = novoPDF();
      const PW = doc.internal.pageSize.getWidth();
      const M = 14;
      let y = await cabecalhoPDF(doc, { empresa, branding, titulo: 'Relatório da Obra', subtitulo: obra?.nome || '' });

      // ── Indicadores principais ──────────────────────────────────────────
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Status', obra?.status || '—'],
          ['Cliente', obra?.cliente || obra?.cliente_nome || '—'],
          ['Período', `${fmtData(obra?.data_inicio)}${obra?.data_fim ? ' – ' + fmtData(obra?.data_fim) : ''}`],
          ['Medições aprovadas', String(medicoesCount)],
          ['Valor do contrato', fmtBRL(contrato)],
          ['Valor medido (realizado)', fmtBRL(realizado)],
          ['% Executado', `${pctExec.toFixed(1)}%`],
          ['Saldo a executar', fmtBRL(saldo)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
      }));
      y = doc.lastAutoTable.finalY + 10;

      // ── Gráfico 1: Execução financeira (barra de progresso) ─────────────
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...PDF_INK);
      doc.text('Execução Financeira', M, y); y += 5;
      const barW = PW - 2 * M, barH = 9;
      doc.setFillColor(...PDF_STRIPE); doc.roundedRect(M, y, barW, barH, 1.5, 1.5, 'F');
      const fillW = Math.max(0, Math.min(1, pctExec / 100)) * barW;
      if (fillW > 0.5) { doc.setFillColor(...PDF_ACCENT); doc.roundedRect(M, y, Math.max(2, fillW), barH, 1.5, 1.5, 'F'); }
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      if (fillW > 22) { doc.setTextColor(255, 255, 255); doc.text(`${pctExec.toFixed(1)}%`, M + fillW - 3, y + barH - 2.6, { align: 'right' }); }
      else { doc.setTextColor(...PDF_INK); doc.text(`${pctExec.toFixed(1)}%`, M + fillW + 3, y + barH - 2.6); }
      y += barH + 5;
      doc.setTextColor(...PDF_MUTE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(`Contrato: ${fmtBRL(contrato)}`, M, y);
      doc.text(`Medido: ${fmtBRL(realizado)}`, PW / 2, y, { align: 'center' });
      doc.text(`Saldo: ${fmtBRL(saldo)}`, PW - M, y, { align: 'right' });
      y += 10;

      // ── Gráfico 2: Avanço físico acumulado por BM (barras verticais) ────
      if (bmsAprovadas.length > 0) {
        if (y > 205) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...PDF_INK);
        doc.text('Avanço Físico Acumulado por BM', M, y); y += 6;
        const axisX = M + 8, chartY = y, chartW = PW - 2 * M - 8, chartH = 38;
        // linhas de grade + rótulos do eixo
        [0, 50, 100].forEach((g) => {
          const gy = chartY + chartH - (g / 100) * chartH;
          doc.setDrawColor(...PDF_LINE); doc.setLineWidth(0.2); doc.line(axisX, gy, axisX + chartW, gy);
          doc.setTextColor(...PDF_MUTE); doc.setFontSize(6.5); doc.text(`${g}%`, axisX - 2, gy + 1.2, { align: 'right' });
        });
        const n = bmsAprovadas.length;
        const slot = chartW / n;
        const bw = Math.min(16, slot * 0.55);
        bmsAprovadas.forEach((b, i) => {
          const pct = Math.max(0, Math.min(100, Number(b.percent_concluida) || 0));
          const bh = (pct / 100) * chartH;
          const bx = axisX + i * slot + (slot - bw) / 2;
          const by = chartY + chartH - bh;
          doc.setFillColor(...PDF_ACCENT); doc.roundedRect(bx, by, bw, Math.max(0.6, bh), 1, 1, 'F');
          doc.setTextColor(...PDF_INK); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
          doc.text(`${pct.toFixed(0)}%`, bx + bw / 2, by - 1.5, { align: 'center' });
          doc.setTextColor(...PDF_MUTE); doc.setFont('helvetica', 'normal');
          doc.text(`BM ${b.numero ?? i + 1}`, bx + bw / 2, chartY + chartH + 4, { align: 'center' });
        });
        y = chartY + chartH + 10;
      }

      // ── Tabela de BMs aprovadas ─────────────────────────────────────────
      if (bmsAprovadas.length > 0) {
        if (y > 235) { doc.addPage(); y = 20; }
        autoTable(doc, temaAutoTable({
          startY: y,
          head: [['BM', 'Período', '% Concl.', 'Total Período', 'Acumulado']],
          body: bmsAprovadas.map((b) => [
            b.numero != null ? `BM ${b.numero}` : '—',
            `${fmtData(b.data_inicio)} – ${fmtData(b.data_fim)}`,
            b.percent_concluida != null ? `${Number(b.percent_concluida).toFixed(1)}%` : '—',
            fmtBRL(b.total_periodo),
            fmtBRL(b.total_acumulado),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        }));
      }

      rodapePDF(doc, { empresa, branding, titulo: `Relatório da Obra — ${obra?.nome || ''}`.trim() });
      doc.save(`relatorio-obra-${(obra?.nome || obraId || 'obra').toString().slice(0, 30).replace(/\s+/g, '-')}.pdf`);
      toast.success('Relatório gerado com sucesso!');
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor de tipo de relatório (mobile: rolável horizontal) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        {[
          { id: 'resumo', label: 'Resumo Executivo' },
          { id: 'desvios', label: 'Análise de Desvios' },
          { id: 'timeline', label: 'Timeline' }
        ].map(tipo => (
          <button
            key={tipo.id}
            onClick={() => setTipoRelatorio(tipo.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-none ${
              tipoRelatorio === tipo.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
          >
            {tipo.label}
          </button>
        ))}
      </div>

      {tipoRelatorio === 'resumo' && (
        <div className="space-y-6">
          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Medições Aprovadas</CardTitle>
                <FileText className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{medicoesCount}</div>
                <p className="text-xs text-gray-400 mt-1">
                  {ultimaMedicaoData ? `Última: ${fmtData(ultimaMedicaoData)}` : 'Nenhuma BM aprovada'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Execução Financeira</CardTitle>
                {pctExec >= 100 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                ) : (
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{pctExec.toFixed(1)}%</div>
                <p className="text-xs text-gray-400 mt-1">
                  Contrato {fmtBRL(contrato)} · Medido {fmtBRL(realizado)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status geral */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-sm">Status da Obra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{obra?.status || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cliente</p>
                  <p className="text-sm font-semibold text-gray-900">{obra?.cliente || obra?.cliente_nome || 'N/A'}</p>
                </div>
              </div>
              {obra?.data_inicio && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Período</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {fmtData(obra.data_inicio)} {obra.data_fim ? `- ${fmtData(obra.data_fim)}` : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tipoRelatorio === 'desvios' && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Análise de Desvios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {variacao === null ? (
              <p className="text-gray-500">Ainda não há medição aprovada para comparar com o contrato.</p>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  A obra tem <span className="font-semibold text-blue-700">{pctExec.toFixed(1)}%</span> do contrato executado (medido), com saldo de <span className="font-semibold text-gray-900">{fmtBRL(saldo)}</span> a executar.
                </p>
                <p className="text-sm text-gray-600">
                  Contrato de {fmtBRL(contrato)} · realizado acumulado de {fmtBRL(realizado)}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tipoRelatorio === 'timeline' && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Timeline da Obra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {obra?.data_inicio ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500">Início Previsto</p>
                  <p className="text-sm font-semibold text-gray-900">{fmtData(obra.data_inicio)}</p>
                </div>
                {obra?.data_fim && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500">Término Previsto</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtData(obra.data_fim)}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500">Duração Prevista</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {obra?.data_fim
                      ? Math.ceil((new Date(obra.data_fim) - new Date(obra.data_inicio)) / (1000 * 60 * 60 * 24))
                      : 'N/A'} dias
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Datas não informadas.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Linha: Evolução Orçado vs Realizado */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Contrato vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="periodo" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} width={44} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8 }}
                formatter={(value) => fmtBRL(value)}
              />
              <Legend />
              <Line type="monotone" dataKey="orçado" stroke="#3B82F6" strokeWidth={2} name="Contrato" />
              <Line type="monotone" dataKey="realizado" stroke="#10B981" strokeWidth={2} name="Realizado" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Botão de download */}
      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={gerarPDF} className="border-gray-300 text-gray-700 hover:text-gray-900 gap-2">
          <Download className="w-4 h-4" />
          Gerar Relatório PDF
        </Button>
      </div>
    </div>
  );
}
