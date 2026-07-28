import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PrinterIcon, Download } from 'lucide-react';
import { toast } from 'sonner';
import FiltrosDesempenhoProfissional from '../components/relatorios-rh/FiltrosDesempenhoProfissional';
import ResumoDesempenhoProfissional from '../components/relatorios-rh/ResumoDesempenhoProfissional';
import TabelaDesempenhoProfissional from '../components/relatorios-rh/TabelaDesempenhoProfissional';
import { parseISO, isBefore, isAfter, startOfDay, endOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable } from '@/lib/pdfBrand';

export default function RelatorioDesempenhoProfissional() {
  const [filtro, setFiltro] = useState({
    profissionalId: null,
    obraId: null,
    dataInicio: null,
    dataFim: null
  });

  // Branding no nível do grupo (matriz) — padrão dos relatórios do sistema.
  const { empresa, branding } = useEmpresaBranding(undefined);

  // Buscar profissional para info
  const { data: profissional } = useQuery({
    queryKey: ['profissional-relatorio', filtro.profissionalId],
    queryFn: () => base44.entities.Colaborador.filter({ id: filtro.profissionalId }),
    enabled: !!filtro.profissionalId,
    select: (data) => data[0]
  });

  // Buscar registros de presença — fonte única: ApontamentoMaoObra (por profissional).
  // Normaliza para o formato do relatório (presente/falta derivados de `presenca`).
  const { data: registrosPresenca = [], isLoading: registrosLoading } = useQuery({
    queryKey: ['diario-equipe-profissional', filtro.profissionalId],
    queryFn: () =>
      base44.entities.ApontamentoMaoObra.filter({ profissional_id: filtro.profissionalId }),
    enabled: !!filtro.profissionalId,
    select: (data) => data
      .map((p) => ({
        ...p,
        colaborador_id: p.profissional_id,
        presente: p.presenca === 'presente',
        falta: p.presenca === 'falta',
      }))
      .sort((a, b) => new Date(b.data) - new Date(a.data))
  });

  // Buscar todas as obras para mapear IDs
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-map'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000)
  });

  // Criar mapa de obras
  const obraMap = useMemo(() => {
    const mapa = {};
    obras.forEach((obra) => {
      mapa[obra.id] = obra;
    });
    return mapa;
  }, [obras]);

  // Filtrar registros por período e obra
  const dadosFiltrados = useMemo(() => {
    let registrosFiltered = registrosPresenca;

    // Filtro por período
    if (filtro.dataInicio || filtro.dataFim) {
      registrosFiltered = registrosFiltered.filter((r) => {
        const dataR = parseISO(r.data);

        if (filtro.dataInicio) {
          const dataInicio = parseISO(filtro.dataInicio);
          if (isBefore(dataR, startOfDay(dataInicio))) return false;
        }

        if (filtro.dataFim) {
          const dataFim = parseISO(filtro.dataFim);
          if (isAfter(dataR, endOfDay(dataFim))) return false;
        }

        return true;
      });
    }

    // Filtro por obra (se especificada)
    if (filtro.obraId) {
      registrosFiltered = registrosFiltered.filter((r) => r.obra_id === filtro.obraId);
    }

    return registrosFiltered;
  }, [registrosPresenca, filtro]);

  const handleImprimir = () => {
    window.print();
  };

  const fmtDataPt = (d) => {
    if (!d) return '—';
    try {
      return format(parseISO(String(d)), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return String(d);
    }
  };

  const handleExportarPDF = async () => {
    try {
      const registros = dadosFiltrados;
      if (!filtro.profissionalId || registros.length === 0) {
        toast.info('Selecione um profissional com registros no período.');
        return;
      }

      // KPIs — mesma lógica dos cards de resumo (ResumoDesempenhoProfissional).
      const totalDias = registros.length;
      const presentes = registros.filter((r) => r.presente).length;
      const faltas = registros.filter((r) => r.falta).length;
      const totalHE = registros.reduce((sum, r) => sum + (r.horas_extra || 0), 0);
      const percentualPresenca = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;

      const periodoTxt = (filtro.dataInicio || filtro.dataFim)
        ? `${fmtDataPt(filtro.dataInicio)} a ${fmtDataPt(filtro.dataFim)}`
        : 'Todo o período';
      const nomeProf = profissional?.nome || 'Profissional';
      const subtitulo = [nomeProf, periodoTxt].filter(Boolean).join(' · ');

      const doc = novoPDF();
      let y = await cabecalhoPDF(doc, {
        empresa,
        branding,
        titulo: 'Desempenho do Profissional',
        subtitulo,
      });

      // ── Resumo (Indicador / Valor) ──────────────────────────────────────
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Profissional', nomeProf],
          ['Cargo', profissional?.cargo || '—'],
          ['Período', periodoTxt],
          ['Dias registrados', String(totalDias)],
          ['Presenças', `${presentes} (${percentualPresenca}% de presença)`],
          ['Faltas', String(faltas)],
          ['Horas extras (total)', `${totalHE.toFixed(1)} h`],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
      }));
      y = doc.lastAutoTable.finalY + 10;

      // ── Histórico detalhado (dia a dia) ─────────────────────────────────
      const registrosOrdenados = [...registros].sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      );
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Data', 'Obra', 'Status', 'HE', 'Observação']],
        body: registrosOrdenados.map((reg) => [
          fmtDataPt(reg.data),
          obraMap[reg.obra_id]?.nome || 'N/A',
          reg.falta ? 'Falta' : reg.presente ? 'Presente' : 'Indefinido',
          reg.horas_extra && reg.horas_extra > 0 ? `${reg.horas_extra.toFixed(1)}h` : '—',
          reg.observacao || '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
      }));

      rodapePDF(doc, {
        empresa,
        branding,
        titulo: `Desempenho do Profissional — ${nomeProf}`.trim(),
      });
      doc.save(`desempenho-${nomeProf.toString().slice(0, 30).replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Relatório de Desempenho do Profissional</h1>
        <p className="text-gray-400 mt-1">
          Histórico de presenças, faltas e horas extras
        </p>
      </div>

      {/* Filtros */}
      <FiltrosDesempenhoProfissional
        {...filtro}
        onFiltro={setFiltro}
        onLimpar={() =>
          setFiltro({
            profissionalId: null,
            obraId: null,
            dataInicio: null,
            dataFim: null
          })
        }
      />

      {/* Conteúdo */}
      {filtro.profissionalId ? (
        <div className="space-y-6">
          {/* Info do profissional */}
          {profissional && (
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                {profissional.nome}
                {profissional.cargo && ` • ${profissional.cargo}`}
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
          <ResumoDesempenhoProfissional
            registros={dadosFiltrados}
            profissional={profissional}
          />

          {/* Tabela detalhada */}
          <TabelaDesempenhoProfissional
            registros={dadosFiltrados}
            obraMap={obraMap}
            isLoading={registrosLoading}
          />
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          Selecione um profissional acima para visualizar o relatório
        </div>
      )}
    </div>
  );
}