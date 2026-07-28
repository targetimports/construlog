import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import autoTable from 'jspdf-autotable';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable } from '@/lib/pdfBrand';
import { exportarCSV } from '@/lib/csvBR';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

export default function RelatoriosExport() {
  const { empresa, branding } = useEmpresaBranding(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtros, setFiltros] = useState({
    incluirSaldoGeral: true,
    incluirDetalhes: true,
    incluirGraficos: false,
    incluirForecastPDF: false,
    periodo: 'todos',
    formato: 'excel'
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const gerarExcel = () => {
    const abas = [];

    // Resumo
    if (filtros.incluirSaldoGeral) {
      const resumoData = contas.reduce((acc, c) => {
        if (c.tipo === 'receber') acc.aReceber += c.valor || 0;
        if (c.tipo === 'pagar') acc.aPagar += c.valor || 0;
        if (c.status === 'pago') acc.totalPago += c.valor || 0;
        return acc;
      }, { aReceber: 0, aPagar: 0, totalPago: 0 });

      abas.push({
        nome: 'Resumo',
        titulo: 'Relatório Financeiro',
        subtitulo: 'Resumo geral',
        headers: ['Indicador', 'Valor'],
        rows: [
          ['A Receber', resumoData.aReceber],
          ['A Pagar', resumoData.aPagar],
          ['Saldo', resumoData.aReceber - resumoData.aPagar],
          ['Total Pago', resumoData.totalPago],
        ],
        moeda: [1],
        larguras: [24, 20],
      });
    }

    // Detalhes
    if (filtros.incluirDetalhes) {
      abas.push({
        nome: 'Detalhes',
        titulo: 'Relatório Financeiro',
        subtitulo: `Lançamentos (${contas.length})`,
        headers: ['Tipo', 'Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Fornecedor/Cliente', 'Obra'],
        rows: contas.map((c) => [
          c.tipo, c.descricao, c.categoria, Number(c.valor) || 0,
          fmtData(c.data_vencimento), c.status, c.fornecedor_cliente || '', nomeObra(c.obra_id),
        ]),
        moeda: [3],
      });
    }

    // Por Obra
    abas.push({
      nome: 'Por Obra',
      titulo: 'Relatório Financeiro',
      subtitulo: 'Receber × Pagar por obra',
      headers: ['Obra', 'A Receber', 'A Pagar', 'Saldo'],
      rows: obras.map((obra) => {
        const obraContas = contas.filter((c) => c.obra_id === obra.id);
        const rec = obraContas.filter((c) => c.tipo === 'receber').reduce((a, c) => a + (c.valor || 0), 0);
        const pag = obraContas.filter((c) => c.tipo === 'pagar').reduce((a, c) => a + (c.valor || 0), 0);
        return [obra.nome, rec, pag, rec - pag];
      }),
      moeda: [1, 2, 3],
    });

    exportarXLSXBranded(`relatorio-financeiro-${new Date().toISOString().split('T')[0]}`, abas, { empresa, branding });
    toast.success('Relatório exportado com sucesso!');
    setDialogOpen(false);
  };

  // Resolve obra_id -> nome usando a lista de obras que o componente já carrega.
  const nomeObra = (obraId) => obras.find((o) => o.id === obraId)?.nome || '—';

  const gerarPDF = async () => {
    try {
      const doc = novoPDF();
      let y = await cabecalhoPDF(doc, {
        empresa,
        branding,
        titulo: 'Relatório Financeiro',
        subtitulo: `Contas financeiras · ${contas.length} lançamento(s)`,
      });

      // ── Resumo (Indicador/Valor) ────────────────────────────────────────
      const resumo = contas.reduce((acc, c) => {
        if (c.tipo === 'receber') acc.aReceber += Number(c.valor) || 0;
        if (c.tipo === 'pagar') acc.aPagar += Number(c.valor) || 0;
        return acc;
      }, { aReceber: 0, aPagar: 0 });

      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Total a Receber', fmtBRL(resumo.aReceber)],
          ['Total a Pagar', fmtBRL(resumo.aPagar)],
          ['Saldo', fmtBRL(resumo.aReceber - resumo.aPagar)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right' } },
      }));
      y = doc.lastAutoTable.finalY + 10;

      // ── Tabela de lançamentos (ContaFinanceira) ─────────────────────────
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Tipo', 'Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Obra']],
        body: contas.map((c) => [
          c.tipo || '—',
          c.descricao || '—',
          c.categoria || '—',
          fmtBRL(c.valor),
          fmtData(c.data_vencimento),
          c.status || '—',
          nomeObra(c.obra_id),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 3: { halign: 'right' } },
      }));

      rodapePDF(doc, { empresa, branding, titulo: 'Relatório Financeiro' });
      doc.save(`relatorio-financeiro-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Relatório gerado com sucesso!');
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || 'tente novamente'));
    }
  };

  const gerarCSV = () => {
    exportarCSV(
      `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.csv`,
      ['Tipo', 'Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Obra'],
      contas.map((c) => [
        c.tipo || '',
        c.descricao || '',
        c.categoria || '',
        c.valor ?? '',
        c.data_vencimento || '',
        c.status || '',
        nomeObra(c.obra_id),
      ])
    );
    toast.success('CSV exportado!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exportar Relatórios</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            onClick={() => setDialogOpen(true)}
            className="flex flex-col items-center gap-2 h-24"
            variant="outline"
          >
            <Download className="w-6 h-6" />
            <span>Excel</span>
            <span className="text-xs text-gray-500">(Customizável)</span>
          </Button>
          <Button 
            onClick={gerarCSV}
            className="flex flex-col items-center gap-2 h-24"
            variant="outline"
          >
            <Download className="w-6 h-6" />
            <span>CSV</span>
            <span className="text-xs text-gray-500">(Padrão)</span>
          </Button>
          <Button 
            onClick={gerarPDF}
            className="flex flex-col items-center gap-2 h-24"
            variant="outline"
          >
            <Download className="w-6 h-6" />
            <span>PDF</span>
            <span className="text-xs text-gray-500">(Branded)</span>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customizar Relatório Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filtros.incluirSaldoGeral}
                  onCheckedChange={(v) => setFiltros({ ...filtros, incluirSaldoGeral: v })}
                  id="saldo"
                />
                <Label htmlFor="saldo">Incluir resumo de saldo geral</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filtros.incluirDetalhes}
                  onCheckedChange={(v) => setFiltros({ ...filtros, incluirDetalhes: v })}
                  id="detalhes"
                />
                <Label htmlFor="detalhes">Incluir detalhes de todas as contas</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filtros.incluirGraficos}
                  onCheckedChange={(v) => setFiltros({ ...filtros, incluirGraficos: v })}
                  id="graficos"
                  disabled
                />
                <Label htmlFor="graficos" className="text-gray-400">Incluir gráficos (em breve)</Label>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label>Formato</Label>
              <select
                value={filtros.formato}
                onChange={(e) => setFiltros({ ...filtros, formato: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="excel">Excel (.xlsx)</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={gerarExcel}>Gerar Relatório</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}