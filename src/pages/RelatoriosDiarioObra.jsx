import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PrinterIcon, Download } from 'lucide-react';
import { toast } from 'sonner';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable } from '@/lib/pdfBrand';
import FiltrosRelatorioDiario from '../components/relatorios-diario/FiltrosRelatorioDiario';
import ResumoRelatorioDiario from '../components/relatorios-diario/ResumoRelatorioDiario';
import TabelaDiarioDias from '../components/relatorios-diario/TabelaDiarioDias';
import { parseISO, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

const fmtData = (d) => {
  if (!d) return '—';
  try { return parseISO(String(d)).toLocaleDateString('pt-BR'); }
  catch { return String(d); }
};

export default function RelatoriosDiarioObra() {
  const [filtro, setFiltro] = useState({
    obraId: null,
    dataInicio: null,
    dataFim: null
  });

  // Buscar obra para info
  const { data: obra } = useQuery({
    queryKey: ['obra-relatorio', filtro.obraId],
    queryFn: () => base44.entities.Obra.filter({ id: filtro.obraId }),
    enabled: !!filtro.obraId,
    select: (data) => data[0]
  });

  // Branding no nível do grupo (matriz) para o PDF.
  const { empresa, branding } = useEmpresaBranding(obra?.empresa_id);

  // Buscar diários
  const { data: diarios = [], isLoading: diariosLoading } = useQuery({
    queryKey: ['diarios-relatorio', filtro.obraId],
    queryFn: () =>
      base44.entities.DiarioObra.filter({ obra_id: filtro.obraId }),
    enabled: !!filtro.obraId,
    select: (data) => data.sort((a, b) => new Date(b.data) - new Date(a.data))
  });

  // Buscar presença de equipe
  const { data: equipeData = [] } = useQuery({
    queryKey: ['diario-equipe-relatorio', filtro.obraId],
    queryFn: () =>
      base44.entities.DiarioObraEquipe.filter({ obra_id: filtro.obraId }),
    enabled: !!filtro.obraId
  });

  // Buscar motivos
  const { data: motivosData = [] } = useQuery({
    queryKey: ['diario-motivos-relatorio', filtro.obraId],
    queryFn: () =>
      base44.entities.DiarioObraMotivo.list('-created_date', 10000),
    enabled: !!filtro.obraId
  });

  // Buscar mídias
  const { data: mediasData = [] } = useQuery({
    queryKey: ['diario-midias-relatorio', filtro.obraId],
    queryFn: () =>
      base44.entities.DiarioObraMidia.list('-created_date', 10000),
    enabled: !!filtro.obraId
  });

  // Filtrar dados por período
  const dadosFiltrados = useMemo(() => {
    let diariosFiltered = diarios;

    if (filtro.dataInicio || filtro.dataFim) {
      diariosFiltered = diarios.filter((d) => {
        const dataD = parseISO(d.data);

        if (filtro.dataInicio) {
          const dataInicio = parseISO(filtro.dataInicio);
          if (isBefore(dataD, startOfDay(dataInicio))) return false;
        }

        if (filtro.dataFim) {
          const dataFim = parseISO(filtro.dataFim);
          if (isAfter(dataD, endOfDay(dataFim))) return false;
        }

        return true;
      });
    }

    // Filtrar equipe e motivos pelos diários do período
    const diarioIds = new Set(diariosFiltered.map((d) => d.id));
    const equipeFiltered = equipeData.filter((e) => diarioIds.has(e.diario_id));
    const motivosFiltered = motivosData.filter((m) => diarioIds.has(m.diario_id));

    return {
      diarios: diariosFiltered,
      equipe: equipeFiltered,
      motivos: motivosFiltered
    };
  }, [diarios, equipeData, motivosData, filtro]);

  const handleImprimir = () => {
    window.print();
  };

  const handleExportarPDF = async () => {
    try {
      const { diarios: linhas, equipe, motivos } = dadosFiltrados;
      if (!linhas.length) {
        toast.info('Nenhum diário no período selecionado para exportar.');
        return;
      }

      // KPIs iguais aos exibidos no ResumoRelatorioDiario (a partir dos dados já filtrados).
      const totalDias = linhas.length;
      const totalFaltas = equipe.reduce((s, r) => s + (r.falta ? 1 : 0), 0);
      const totalHE = equipe.reduce((s, r) => s + (Number(r.horas_extra) || 0), 0);
      const diasParalisados = linhas.filter((d) => d.status_dia === 'PARALISADO').length;

      // Subtítulo = obra + período (quando houver).
      const periodo = (filtro.dataInicio && filtro.dataFim)
        ? `${fmtData(filtro.dataInicio)} a ${fmtData(filtro.dataFim)}`
        : (filtro.dataInicio ? `A partir de ${fmtData(filtro.dataInicio)}`
          : (filtro.dataFim ? `Até ${fmtData(filtro.dataFim)}` : ''));
      const subtitulo = [obra?.nome, periodo].filter(Boolean).join(' · ');

      const doc = novoPDF();
      let y = await cabecalhoPDF(doc, {
        empresa, branding,
        titulo: 'Relatório de Diário de Obra',
        subtitulo,
      });

      // ── Tabela-resumo (Indicador / Valor) ──────────────────────────────
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Dias registrados', String(totalDias)],
          ['Total de faltas', String(totalFaltas)],
          ['Horas extras', totalHE.toFixed(1)],
          ['Dias paralisados', String(diasParalisados)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
      }));
      y = doc.lastAutoTable.finalY + 10;

      // ── Tabela principal: uma linha por diário ─────────────────────────
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Data', 'Obra', 'Clima', 'Funcionários', 'Atividades Realizadas']],
        body: linhas.map((d) => [
          fmtData(d.data),
          obra?.nome || '—',
          d.clima || '—',
          String(d.qtd_funcionarios ?? 0),
          d.atividades_realizadas || '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 22 },
          2: { cellWidth: 24 },
          3: { halign: 'center', cellWidth: 22 },
        },
      }));

      rodapePDF(doc, { empresa, branding, titulo: 'Relatório de Diário de Obra' });
      const nomeArq = (obra?.nome || 'obra').toString().slice(0, 30).replace(/\s+/g, '-');
      doc.save(`diario-obra-${nomeArq}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Relatório Diário da Obra</h1>
        <p className="text-gray-400 mt-1">
          Acompanhamento detalhado de produção, presença e evidências
        </p>
      </div>

      {/* Filtros */}
      <FiltrosRelatorioDiario
        {...filtro}
        onFiltro={setFiltro}
        onLimpar={() => setFiltro({ obraId: null, dataInicio: null, dataFim: null })}
      />

      {/* Conteúdo */}
      {filtro.obraId ? (
        <div className="space-y-6">
          {/* Info da obra */}
          {obra && (
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                {obra.nome}
                {filtro.dataInicio && filtro.dataFim && (
                  <> • {filtro.dataInicio} a {filtro.dataFim}</>
                )}
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3 justify-end print:hidden">
            <Button
              onClick={handleImprimir}
              variant="outline"
              className="border-gray-600 text-gray-300 gap-2"
            >
              <PrinterIcon className="w-4 h-4" />
              Imprimir
            </Button>
            <Button
              onClick={handleExportarPDF}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>

          {/* Resumo */}
          <ResumoRelatorioDiario
            diarios={dadosFiltrados.diarios}
            equipeData={dadosFiltrados.equipe}
            motivosData={dadosFiltrados.motivos}
          />

          {/* Tabela de dias */}
          <TabelaDiarioDias
            diarios={dadosFiltrados.diarios}
            equipeData={dadosFiltrados.equipe}
            motivosData={dadosFiltrados.motivos}
            isLoading={diariosLoading}
            onVisualizarDiario={(diarioId) => {
              toast.info('Redirecionar para diário completo');
            }}
          />
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          Selecione uma obra acima para visualizar o relatório
        </div>
      )}
    </div>
  );
}