import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart2, Download, Loader2, Building2, User } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Meses em português
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export default function RelatorioRateioMensal() {
  const [open, setOpen] = useState(false);
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1); // 1-12
  const [ano, setAno] = useState(currentDate.getFullYear());
  const [tab, setTab] = useState('obras');

  // Empresa/branding p/ o cabeçalho do Excel (relatório cruza obras → matriz).
  const { empresa, branding } = useEmpresaBranding();

  // Datas do período selecionado
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const dataFim = (() => {
    const d = new Date(ano, mes, 0); // último dia do mês
    return `${ano}-${String(mes).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Buscar apontamentos do mês
  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ['apontamentos-rateio', mes, ano],
    queryFn: () => base44.entities.ApontamentoMaoObra.filter(
      { status: 'APROVADO' },
      '-data',
      2000
    ),
    enabled: open,
    select: (data) => data.filter(a => a.data >= dataInicio && a.data <= dataFim)
  });

  // Buscar profissionais e obras para lookup de nomes
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-lookup'],
    queryFn: () => base44.entities.Obra.list('-nome', 500),
    enabled: open
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-lookup'],
    queryFn: () => base44.entities.Colaborador.list('-nome', 500),
    enabled: open
  });

  const obraMap = useMemo(() => Object.fromEntries(obras.map(o => [o.id, o.nome || o.codigo || o.id])), [obras]);
  const colaboradorMap = useMemo(() => Object.fromEntries(colaboradores.map(c => [c.id, c.nome || c.id])), [colaboradores]);

  // ──────────────────────────────────────────────────────────
  // CÁLCULOS PRINCIPAIS
  // ──────────────────────────────────────────────────────────

  // Por Obra
  const porObra = useMemo(() => {
    const mapa = {};
    apontamentos.forEach(a => {
      if (!a.obra_id) return;
      if (!mapa[a.obra_id]) {
        mapa[a.obra_id] = {
          obra_id: a.obra_id,
          obra_nome: obraMap[a.obra_id] || a.obra_id,
          total_dias: 0,
          total_diarias: 0,
          total_horas_extra: 0,
          total_custo_horas_extra: 0,
          total_custo: 0,
          profissionais: new Set()
        };
      }
      const o = mapa[a.obra_id];
      o.total_dias += 1;
      o.total_diarias += (a.valor_diaria || 0);
      o.total_horas_extra += (a.horas_extra || 0);
      o.total_custo_horas_extra += (a.total_horas_extra || 0);
      o.total_custo += (a.total || 0);
      if (a.profissional_id) o.profissionais.add(a.profissional_id);
    });
    return Object.values(mapa).sort((a, b) => b.total_custo - a.total_custo);
  }, [apontamentos, obraMap]);

  // Por Profissional (com detalhamento por obra)
  const porProfissional = useMemo(() => {
    const mapa = {};
    apontamentos.forEach(a => {
      const pid = a.profissional_id || 'desconhecido';
      if (!mapa[pid]) {
        mapa[pid] = {
          profissional_id: pid,
          profissional_nome: a.profissional_nome || colaboradorMap[pid] || pid,
          profissional_cargo: a.profissional_cargo || '',
          total_dias: 0,
          total_diarias: 0,
          total_horas_extra: 0,
          total_custo: 0,
          obras: {}
        };
      }
      const p = mapa[pid];
      p.total_dias += 1;
      p.total_diarias += (a.valor_diaria || 0);
      p.total_horas_extra += (a.horas_extra || 0);
      p.total_custo += (a.total || 0);

      // Detalhe por obra
      const oid = a.obra_id || 'sem_obra';
      if (!p.obras[oid]) {
        p.obras[oid] = { obra_nome: obraMap[oid] || oid, dias: 0, custo: 0, valor_diaria: a.valor_diaria || 0 };
      }
      p.obras[oid].dias += 1;
      p.obras[oid].custo += (a.total || 0);
    });
    return Object.values(mapa).sort((a, b) => b.total_custo - a.total_custo);
  }, [apontamentos, obraMap, colaboradorMap]);

  // Totais gerais
  const totais = useMemo(() => ({
    dias: apontamentos.length,
    diarias: apontamentos.reduce((s, a) => s + (a.valor_diaria || 0), 0),
    horas_extra: apontamentos.reduce((s, a) => s + (a.horas_extra || 0), 0),
    custo_horas_extra: apontamentos.reduce((s, a) => s + (a.total_horas_extra || 0), 0),
    custo_total: apontamentos.reduce((s, a) => s + (a.total || 0), 0),
    obras: new Set(apontamentos.map(a => a.obra_id)).size,
    profissionais: new Set(apontamentos.map(a => a.profissional_id)).size
  }), [apontamentos]);

  // ──────────────────────────────────────────────────────────
  // EXPORTAR EXCEL (branded, 2 abas: Por Obra / Por Profissional)
  // ──────────────────────────────────────────────────────────
  const exportarExcel = () => {
    if (!apontamentos.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const subtitulo = `${MESES[mes - 1]} / ${ano}`;

      exportarXLSXBranded(`rateio_mao_obra_${String(mes).padStart(2, '0')}_${ano}`, [
        {
          nome: 'Por Obra',
          titulo: 'Rateio Mensal de Mão de Obra',
          subtitulo,
          headers: ['Obra', 'Qtd Apontamentos', 'Total Diárias (R$)', 'Horas Extra', 'Custo HE (R$)', 'Total Custo (R$)', 'Profissionais'],
          rows: [
            ...porObra.map(o => [
              o.obra_nome,
              o.total_dias,
              Number(o.total_diarias) || 0,
              Number(o.total_horas_extra) || 0,
              Number(o.total_custo_horas_extra) || 0,
              Number(o.total_custo) || 0,
              o.profissionais.size
            ]),
            ['TOTAL', totais.dias, Number(totais.diarias) || 0, Number(totais.horas_extra) || 0, Number(totais.custo_horas_extra) || 0, Number(totais.custo_total) || 0, totais.profissionais]
          ],
          moeda: [2, 4, 5]
        },
        {
          nome: 'Por Profissional',
          titulo: 'Rateio Mensal de Mão de Obra',
          subtitulo,
          headers: ['Profissional', 'Cargo', 'Total Dias', 'Total Diárias (R$)', 'Horas Extra', 'Total Custo (R$)', 'Detalhamento por Obra'],
          rows: porProfissional.map(p => [
            p.profissional_nome,
            p.profissional_cargo,
            p.total_dias,
            Number(p.total_diarias) || 0,
            Number(p.total_horas_extra) || 0,
            Number(p.total_custo) || 0,
            Object.values(p.obras)
              .map(o => `${o.obra_nome}: ${o.dias}d x ${fmtBRL(o.valor_diaria)} = ${fmtBRL(o.custo)}`)
              .join(' | ')
          ]),
          moeda: [3, 5]
        }
      ], { empresa, branding });

      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <BarChart2 className="w-4 h-4" />
        Rateio Mensal
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              Relatório Mensal de Rateio — Mão de Obra
            </DialogTitle>
          </DialogHeader>

          {/* Filtro mês/ano */}
          <div className="flex gap-3 items-end border-b pb-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Mês</label>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Ano</label>
              <select
                className="border rounded px-2 py-1.5 text-sm"
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
              >
                {[2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 self-center">
              Período: <strong>{dataInicio}</strong> a <strong>{dataFim}</strong>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando apontamentos...
            </div>
          ) : apontamentos.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              Nenhum apontamento aprovado encontrado para {MESES[mes - 1]} / {ano}.
            </div>
          ) : (
            <>
              {/* KPIs do mês */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-blue-100 bg-blue-50">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-blue-600 font-medium">Total Apontamentos</p>
                    <p className="text-2xl font-bold text-blue-800">{totais.dias}</p>
                    <p className="text-xs text-blue-500">{totais.profissionais} profissionais · {totais.obras} obras</p>
                  </CardContent>
                </Card>
                <Card className="border-green-100 bg-green-50">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-green-600 font-medium">Total Diárias</p>
                    <p className="text-xl font-bold text-green-800">{fmtBRL(totais.diarias)}</p>
                  </CardContent>
                </Card>
                <Card className="border-orange-100 bg-orange-50">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-orange-600 font-medium">Custo Horas Extra</p>
                    <p className="text-xl font-bold text-orange-800">{fmtBRL(totais.custo_horas_extra)}</p>
                    <p className="text-xs text-orange-500">{fmtN(totais.horas_extra)} horas</p>
                  </CardContent>
                </Card>
                <Card className="border-purple-100 bg-purple-50">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-purple-600 font-medium">Custo Total M.O.</p>
                    <p className="text-xl font-bold text-purple-800">{fmtBRL(totais.custo_total)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs: Por Obra / Por Profissional */}
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="obras" className="flex-1 gap-1">
                    <Building2 className="w-4 h-4" /> Por Obra
                  </TabsTrigger>
                  <TabsTrigger value="profissionais" className="flex-1 gap-1">
                    <User className="w-4 h-4" /> Por Profissional
                  </TabsTrigger>
                </TabsList>

                {/* ── POR OBRA ── */}
                <TabsContent value="obras" className="mt-3">
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Obra</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Qtd Apt.</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Diárias (R$)</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Horas Extra</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Custo HE</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Total Custo</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Profis.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porObra.map((o, idx) => (
                          <tr key={o.obra_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 font-medium text-gray-800">{o.obra_nome}</td>
                            <td className="px-3 py-2 text-right">{o.total_dias}</td>
                            <td className="px-3 py-2 text-right">{fmtBRL(o.total_diarias)}</td>
                            <td className="px-3 py-2 text-right">{fmtN(o.total_horas_extra)}h</td>
                            <td className="px-3 py-2 text-right">{fmtBRL(o.total_custo_horas_extra)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700">{fmtBRL(o.total_custo)}</td>
                            <td className="px-3 py-2 text-right">
                              <Badge variant="secondary">{o.profissionais.size}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 border-t font-bold">
                        <tr>
                          <td className="px-3 py-2">TOTAL</td>
                          <td className="px-3 py-2 text-right">{totais.dias}</td>
                          <td className="px-3 py-2 text-right">{fmtBRL(totais.diarias)}</td>
                          <td className="px-3 py-2 text-right">{fmtN(totais.horas_extra)}h</td>
                          <td className="px-3 py-2 text-right">{fmtBRL(totais.custo_horas_extra)}</td>
                          <td className="px-3 py-2 text-right text-blue-800">{fmtBRL(totais.custo_total)}</td>
                          <td className="px-3 py-2 text-right">{totais.profissionais}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </TabsContent>

                {/* ── POR PROFISSIONAL ── */}
                <TabsContent value="profissionais" className="mt-3 space-y-3">
                  {porProfissional.map((p) => (
                    <Card key={p.profissional_id} className="overflow-hidden">
                      <CardHeader className="py-3 px-4 bg-gray-50 border-b flex-row items-center justify-between space-y-0">
                        <div>
                          <p className="font-semibold text-gray-800">{p.profissional_nome}</p>
                          {p.profissional_cargo && (
                            <p className="text-xs text-gray-500">{p.profissional_cargo}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total mês</p>
                          <p className="font-bold text-blue-700 text-lg">{fmtBRL(p.total_custo)}</p>
                          <p className="text-xs text-gray-500">{p.total_dias} dia(s) · {fmtN(p.total_horas_extra)}h extra</p>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-0">
                        <table className="w-full text-sm">
                          <thead className="border-b">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Obra</th>
                              <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Dias</th>
                              <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Valor/Dia</th>
                              <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.values(p.obras).map((o, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="px-3 py-1.5 text-gray-700">{o.obra_nome}</td>
                                <td className="px-3 py-1.5 text-right">{o.dias}</td>
                                <td className="px-3 py-1.5 text-right text-gray-500">{fmtBRL(o.valor_diaria)}</td>
                                <td className="px-3 py-1.5 text-right font-medium text-green-700">{fmtBRL(o.custo)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          )}

          <DialogFooter className="gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            {apontamentos.length > 0 && (
              <Button onClick={exportarExcel} className="gap-2">
                <Download className="w-4 h-4" />
                Exportar Excel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}