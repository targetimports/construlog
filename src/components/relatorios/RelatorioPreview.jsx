import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, FileSpreadsheet, FileText, Table2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('pt-BR');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function KPICard({ kpi }) {
  if (kpi.formato === 'distribuicao' && typeof kpi.valor === 'object') {
    return (
      <div className="p-4 bg-white border rounded-lg col-span-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{kpi.label}</p>
        <div className="space-y-1.5">
          {Object.entries(kpi.valor).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <Badge variant="secondary">{k}</Badge>
              <span className="font-bold text-gray-800">{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const fmt = kpi.formato === 'moeda'
    ? Number(kpi.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : kpi.formato === 'percentual'
    ? `${Number(kpi.valor).toFixed(1)}%`
    : formatVal(kpi.valor);
  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{kpi.label}</p>
      <p className="text-2xl font-bold text-blue-800">{fmt}</p>
    </div>
  );
}

async function downloadBlob(relatorio, format) {
  const resp = await base44.functions.invoke('exportarRelatorioCustomizado', { relatorioId: relatorio.id, format });
  let mime = 'text/csv';
  let ext = format;
  if (format === 'pdf') mime = 'application/pdf';
  if (format === 'xlsx') mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([resp.data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${(relatorio.nome || 'relatorio').replace(/\s+/g, '_')}.${ext}`;
  document.body.appendChild(a); a.click();
  URL.revokeObjectURL(url); a.remove();
}

export default function RelatorioPreview({ relatorio, onClose }) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [dados, setDados] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const resp = await base44.functions.invoke('gerarRelatorioCustomizado', { relatorioId: relatorio.id, preview: true });
      setDados(resp.data?.data || resp.data);
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [relatorio.id]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await downloadBlob(relatorio, format);
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch {
      toast.error('Erro ao exportar');
    } finally {
      setExporting('');
    }
  };

  const colHeaders = dados?.colHeaders || [];
  const linhas = dados?.linhas || [];
  const kpis = dados?.kpis || [];

  // dados para gráfico de agrupamento
  const chartData = dados?.agrupado
    ? linhas.slice(0, 20).map(row => ({ name: String(row['_grupo'] || '').slice(0, 20), qtd: Number(row['_count'] || 0) }))
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">{relatorio.nome}</DialogTitle>
              {relatorio.descricao && <p className="text-sm text-gray-500 mt-0.5">{relatorio.descricao}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={() => handleExport('csv')} disabled={!!exporting} className="gap-1.5">
                {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Table2 className="w-3.5 h-3.5 text-green-600" />}
                CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport('xlsx')} disabled={!!exporting} className="gap-1.5">
                {exporting === 'xlsx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} disabled={!!exporting} className="gap-1.5">
                {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-red-500" />}
                PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={carregar} disabled={loading} className="gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-2 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-500">Carregando dados...</p>
            </div>
          ) : dados ? (
            <>
              {/* KPIs */}
              {kpis.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {kpis.map((k, i) => <KPICard key={i} kpi={k} />)}
                </div>
              )}

              {/* Gráfico de agrupamento */}
              {chartData && chartData.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Distribuição por Grupo</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 0, right: 16, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="qtd" fill="#4361EE" radius={[4, 4, 0, 0]} name="Qtd." />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tabela */}
              {linhas.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          {colHeaders.map(h => (
                            <th key={h.key} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            {colHeaders.map(h => (
                              <td key={h.key} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                                {formatVal(row[h.key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 bg-gray-50 border-t flex items-center justify-between text-xs text-gray-500">
                    <span>Exibindo <strong>{linhas.length}</strong> de <strong>{dados.totalRegistros}</strong> registros</span>
                    {dados.totalRaw && <span>Fonte: {dados.totalRaw} registros totais</span>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Table2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>Nenhum dado encontrado com os filtros aplicados.</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-gray-400">Nenhum dado disponível</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}