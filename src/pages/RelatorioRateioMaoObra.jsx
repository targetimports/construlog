import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, BarChart3, Users, Building2 } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtN = (v) => (v || 0).toFixed(2);

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export default function RelatorioRateioMaoObra() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [modo, setModo] = useState('obra'); // 'obra' | 'profissional'

  // Data início/fim do mês selecionado
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ['apontamentos-rateio', mes, ano],
    queryFn: () => base44.entities.ApontamentoMaoObra.list(),
    // Só apontamentos APROVADOS entram no custo (rascunho não vira despesa no financeiro).
    select: (data) => data.filter(a => {
      if (!a.data || a.status !== 'APROVADO') return false;
      return a.data >= dataInicio && a.data <= dataFim;
    }),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-rateio'],
    queryFn: () => base44.entities.Obra.list(),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-rateio'],
    queryFn: () => base44.entities.Colaborador.list(),
  });

  const obraMap = useMemo(() => Object.fromEntries(obras.map(o => [o.id, o])), [obras]);
  const colMap = useMemo(() => Object.fromEntries(colaboradores.map(c => [c.id, c])), [colaboradores]);

  // Empresa/branding p/ o cabeçalho do Excel (tela agrega todas as obras → matriz).
  const { empresa, branding } = useEmpresaBranding();

  // Agrupamento POR OBRA
  const porObra = useMemo(() => {
    const map = {};
    apontamentos.forEach(a => {
      if (!a.obra_id) return;
      if (!map[a.obra_id]) map[a.obra_id] = { obra_id: a.obra_id, dias: 0, total_diarias: 0, total_horas_extra: 0, total_valor_he: 0, total_custo: 0 };
      const r = map[a.obra_id];
      r.dias += 1;
      r.total_diarias += (a.valor_diaria || 0);
      r.total_horas_extra += (a.horas_extra || 0);
      r.total_valor_he += (a.total_horas_extra || 0);
      r.total_custo += (a.total || 0);
    });
    return Object.values(map).sort((a, b) => b.total_custo - a.total_custo);
  }, [apontamentos]);

  // Agrupamento POR PROFISSIONAL → por obra
  const porProfissional = useMemo(() => {
    const map = {};
    apontamentos.forEach(a => {
      const pid = a.profissional_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { profissional_id: pid, obras: {}, total_dias: 0, total_diarias: 0, total_custo: 0 };
      const r = map[pid];
      if (!r.obras[a.obra_id]) r.obras[a.obra_id] = { dias: 0, total_diarias: 0, total_custo: 0, valor_diaria: 0 };
      const ro = r.obras[a.obra_id];
      ro.dias += 1;
      ro.total_diarias += (a.valor_diaria || 0);
      ro.total_custo += (a.total || 0);
      ro.valor_diaria = a.valor_diaria || ro.valor_diaria;
      r.total_dias += 1;
      r.total_diarias += (a.valor_diaria || 0);
      r.total_custo += (a.total || 0);
    });
    return Object.values(map).sort((a, b) => b.total_custo - a.total_custo);
  }, [apontamentos]);

  const totalGeral = useMemo(() => porObra.reduce((s, o) => s + o.total_custo, 0), [porObra]);
  const totalDias = useMemo(() => porObra.reduce((s, o) => s + o.dias, 0), [porObra]);

  // Exporta EXCEL branded com o modo ativo (por obra ou por profissional).
  const exportarExcel = () => {
    const linhas = modo === 'obra' ? porObra : porProfissional;
    if (!linhas.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const subtitulo = `${MESES[mes - 1]}/${ano}`;
      let aba;
      if (modo === 'obra') {
        const rows = porObra.map((r) => [
          obraMap[r.obra_id]?.nome || r.obra_id,
          r.dias,
          Number(r.total_diarias) || 0,
          Number(r.total_horas_extra) || 0,
          Number(r.total_valor_he) || 0,
          Number(r.total_custo) || 0,
        ]);
        rows.push([
          'TOTAL GERAL',
          totalDias,
          porObra.reduce((s, r) => s + (r.total_diarias || 0), 0),
          porObra.reduce((s, r) => s + (r.total_horas_extra || 0), 0),
          porObra.reduce((s, r) => s + (r.total_valor_he || 0), 0),
          totalGeral,
        ]);
        aba = {
          nome: 'Por Obra',
          titulo: 'Rateio de Mão de Obra',
          subtitulo,
          headers: ['Obra', 'Dias', 'Total Diárias', 'Horas Extra', 'Valor HE', 'Total Custo'],
          rows,
          moeda: [2, 4, 5],
        };
      } else {
        const rows = [];
        porProfissional.forEach((r) => {
          const col = colMap[r.profissional_id] || { nome: r.profissional_id, cargo: '' };
          Object.entries(r.obras).forEach(([obraId, ro]) => {
            rows.push([
              col.nome,
              col.cargo || '',
              obraMap[obraId]?.nome || obraId,
              ro.dias,
              Number(ro.valor_diaria) || 0,
              Number(ro.total_diarias) || 0,
              '',
              Number(ro.total_custo) || 0,
            ]);
          });
          rows.push([`${col.nome} - TOTAL`, '', '', r.total_dias, '', Number(r.total_diarias) || 0, '', Number(r.total_custo) || 0]);
        });
        rows.push([
          'TOTAL GERAL', '', '',
          totalDias, '',
          porProfissional.reduce((s, r) => s + (r.total_diarias || 0), 0),
          '',
          totalGeral,
        ]);
        aba = {
          nome: 'Por Profissional',
          titulo: 'Rateio de Mão de Obra',
          subtitulo,
          headers: ['Profissional', 'Cargo', 'Obra', 'Dias', 'Valor Diária', 'Total Diárias', 'Total HE', 'Custo Total'],
          rows,
          moeda: [4, 5, 7],
        };
      }
      exportarXLSXBranded(`rateio_mao_obra_${String(mes).padStart(2, '0')}_${ano}`, [aba], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Relatório Mensal de Rateio – Mão de Obra
          </h1>
          <p className="text-gray-500 text-sm mt-1">Apontamentos de diárias por obra e por profissional</p>
        </div>
        <Button onClick={exportarExcel} variant="outline" className="gap-2" disabled={apontamentos.length === 0}>
          <Download className="w-4 h-4" /> Exportar Excel
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Mês</label>
              <select
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="border rounded px-3 py-2 text-sm"
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Ano</label>
              <input
                type="number"
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="border rounded px-3 py-2 text-sm w-24"
                min="2020" max="2030"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={modo === 'obra' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setModo('obra')}
                className="gap-1"
              >
                <Building2 className="w-4 h-4" /> Por Obra
              </Button>
              <Button
                variant={modo === 'profissional' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setModo('profissional')}
                className="gap-1"
              >
                <Users className="w-4 h-4" /> Por Profissional
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {!isLoading && apontamentos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="text-xs text-blue-700 font-medium">Apontamentos</p>
              <p className="text-2xl font-bold text-blue-800">{apontamentos.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <p className="text-xs text-green-700 font-medium">Obras</p>
              <p className="text-2xl font-bold text-green-800">{porObra.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4">
              <p className="text-xs text-purple-700 font-medium">Profissionais</p>
              <p className="text-2xl font-bold text-purple-800">{porProfissional.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-4">
              <p className="text-xs text-orange-700 font-medium">Custo Total</p>
              <p className="text-xl font-bold text-orange-800">{fmt(totalGeral)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton bare rows={6} cols={6} />
          </CardContent>
        </Card>
      )}

      {/* Vazio */}
      {!isLoading && apontamentos.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum apontamento encontrado</p>
            <p className="text-sm">para {MESES[mes - 1]} de {ano}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabela POR OBRA */}
      {!isLoading && apontamentos.length > 0 && modo === 'obra' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resumo por Obra — {MESES[mes - 1]}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="p-3 text-left">Obra</th>
                    <th className="p-3 text-right">Dias</th>
                    <th className="p-3 text-right">Total Diárias</th>
                    <th className="p-3 text-right">Horas Extra</th>
                    <th className="p-3 text-right">Valor HE</th>
                    <th className="p-3 text-right font-bold">Custo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porObra.map((r, idx) => {
                    const obra = obraMap[r.obra_id];
                    const mediaDiaria = r.dias > 0 ? r.total_diarias / r.dias : 0;
                    return (
                      <tr key={r.obra_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{obra?.nome || r.obra_id}</p>
                          <p className="text-xs text-gray-400">{r.dias} dias × {fmt(mediaDiaria)}/dia</p>
                        </td>
                        <td className="p-3 text-right font-semibold">{r.dias}</td>
                        <td className="p-3 text-right text-blue-700">{fmt(r.total_diarias)}</td>
                        <td className="p-3 text-right">{fmtN(r.total_horas_extra)}h</td>
                        <td className="p-3 text-right text-orange-600">{fmt(r.total_valor_he)}</td>
                        <td className="p-3 text-right font-bold text-green-700 text-base">{fmt(r.total_custo)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="p-3 text-right text-gray-700">TOTAL GERAL</td>
                    <td className="p-3 text-right">{totalDias}</td>
                    <td className="p-3 text-right text-blue-700">{fmt(porObra.reduce((s, r) => s + r.total_diarias, 0))}</td>
                    <td className="p-3 text-right">{fmtN(porObra.reduce((s, r) => s + r.total_horas_extra, 0))}h</td>
                    <td className="p-3 text-right text-orange-600">{fmt(porObra.reduce((s, r) => s + r.total_valor_he, 0))}</td>
                    <td className="p-3 text-right text-green-700 text-lg">{fmt(totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela POR PROFISSIONAL */}
      {!isLoading && apontamentos.length > 0 && modo === 'profissional' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rateio por Profissional — {MESES[mes - 1]}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="p-3 text-left">Profissional</th>
                    <th className="p-3 text-left">Obra</th>
                    <th className="p-3 text-right">Dias</th>
                    <th className="p-3 text-right">Valor/Dia</th>
                    <th className="p-3 text-right">Total Diárias</th>
                    <th className="p-3 text-right font-bold">Custo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porProfissional.map((r, idx) => {
                    const col = colMap[r.profissional_id] || { nome: r.profissional_id, cargo: '' };
                    const obraEntries = Object.entries(r.obras);
                    return (
                      <React.Fragment key={r.profissional_id}>
                        {obraEntries.map(([obraId, ro], oIdx) => {
                          const obra = obraMap[obraId];
                          return (
                            <tr key={`${r.profissional_id}-${obraId}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {oIdx === 0 && (
                                <td className="p-3 align-top" rowSpan={obraEntries.length + 1}>
                                  <p className="font-semibold text-gray-900">{col.nome}</p>
                                  <p className="text-xs text-gray-400">{col.cargo}</p>
                                  <Badge variant="outline" className="mt-1 text-xs">{r.total_dias}d total</Badge>
                                </td>
                              )}
                              <td className="p-3 text-gray-700">{obra?.nome || obraId}</td>
                              <td className="p-3 text-right font-semibold">{ro.dias}</td>
                              <td className="p-3 text-right text-gray-600">{fmt(ro.valor_diaria)}</td>
                              <td className="p-3 text-right text-blue-700">{fmt(ro.total_diarias)}</td>
                              <td className="p-3 text-right font-bold text-green-700">{fmt(ro.total_custo)}</td>
                            </tr>
                          );
                        })}
                        {/* Linha de subtotal do profissional */}
                        <tr className="border-b-2 border-gray-300 bg-blue-50 font-bold text-sm">
                          <td className="p-3 text-gray-500 text-xs italic">Subtotal</td>
                          <td className="p-3 text-right text-blue-800">{r.total_dias} dias</td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right text-blue-700">{fmt(r.total_diarias)}</td>
                          <td className="p-3 text-right text-green-700 text-base">{fmt(r.total_custo)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                    <td colSpan={2} className="p-3 text-right text-gray-700">TOTAL GERAL</td>
                    <td className="p-3 text-right">{totalDias}</td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right text-blue-700">{fmt(porProfissional.reduce((s, r) => s + r.total_diarias, 0))}</td>
                    <td className="p-3 text-right text-green-700 text-lg">{fmt(totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}