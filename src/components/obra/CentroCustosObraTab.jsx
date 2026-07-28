import React, { useState, useMemo } from 'react';
import { PageSkeleton } from '@/components/shared/Skeletons';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Package, Users, Wrench, LayoutList, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const CATEGORIAS = {
  material:    { label: 'Material',      color: 'bg-blue-100 text-blue-800',   icon: Package,    bg: 'bg-blue-50 border-blue-200' },
  mao_de_obra: { label: 'Mão de Obra',   color: 'bg-green-100 text-green-800', icon: Users,      bg: 'bg-green-50 border-green-200' },
  servico:     { label: 'Serviços',      color: 'bg-purple-100 text-purple-800', icon: Wrench,   bg: 'bg-purple-50 border-purple-200' },
  outro:       { label: 'Outros',        color: 'bg-gray-100 text-gray-700',   icon: LayoutList, bg: 'bg-gray-50 border-gray-200' },
};

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function CentroCustosObraTab({ obraId }) {
  const anoAtual = new Date().getFullYear();
  const [filtroAno, setFiltroAno] = useState(anoAtual);
  const [filtroMes, setFiltroMes] = useState(''); // '' = todos

  // Obra (nome p/ subtítulo + empresa_id p/ o branding do Excel)
  const { data: obra } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.get(obraId),
    enabled: !!obraId,
  });
  const { empresa, branding } = useEmpresaBranding(obra?.empresa_id);

  // ── Fontes de dados ──────────────────────────────────────────
  // 1) LancamentoCustoObra — fonte principal (material via estoque, NF, etc.)
  const { data: lancamentos = [], isLoading: loadL } = useQuery({
    queryKey: ['lancamentos-custo-obra', obraId],
    queryFn: () => base44.entities.LancamentoCustoObra.filter({ obra_id: obraId }, '-data_lancamento', 2000),
    enabled: !!obraId,
  });

  // 2) ApontamentoMaoObra — mão de obra diária
  const { data: apontamentos = [], isLoading: loadA } = useQuery({
    queryKey: ['apontamentos-custo', obraId],
    queryFn: () => base44.entities.ApontamentoMaoObra.filter({ obra_id: obraId, status: 'APROVADO' }, '-data', 2000),
    enabled: !!obraId,
  });

  // 3) BM (Boletim de Medição) — serviços/medição canônica da obra.
  //    Fonte única: BM APROVADAS da obra (sem fan-out por contrato). Cada BM
  //    traz total_periodo já consolidado.
  const { data: bms = [], isLoading: loadM } = useQuery({
    queryKey: ['bms-custo-obra', obraId],
    queryFn: () => base44.entities.BM.filter({ obra_id: obraId }, '-created_date', 500),
    enabled: !!obraId,
  });

  const isLoading = loadL || loadA || loadM;

  // ── Normalizar tudo para linhas unificadas ──────────────────
  const linhas = useMemo(() => {
    const resultado = [];

    // Lançamentos (material/nf/frota/aluguel/outro)
    lancamentos.forEach(l => {
      const dt = l.data_lancamento ? l.data_lancamento.substring(0, 10) : null;
      resultado.push({
        id: `l_${l.id}`,
        data: dt,
        categoria: l.categoria === 'mao_de_obra' ? 'mao_de_obra' :
                   l.categoria === 'servico' ? 'servico' :
                   l.categoria === 'material' ? 'material' : 'outro',
        descricao: l.descricao || `${l.origem_tipo} — ${l.referencia_numero || ''}`,
        valor: l.valor || 0,
        status: l.status || 'lançado',
        origem: l.origem_tipo,
      });
    });

    // Apontamentos MO
    apontamentos.forEach(a => {
      resultado.push({
        id: `a_${a.id}`,
        data: a.data,
        categoria: 'mao_de_obra',
        descricao: `${a.profissional_nome || a.profissional_id} — diária`,
        valor: a.total || a.valor_diaria || 0,
        status: 'realizado',
        origem: 'mao_de_obra',
      });
    });

    // BMs aprovadas (serviços / medição canônica)
    bms.forEach(b => {
      if (b.status !== 'APROVADA') return;
      const valor = Number(b.total_periodo) || 0;
      if (valor <= 0) return;
      const dtRaw = b.data_fim || b.data_inicio || b.created_date;
      resultado.push({
        id: `bm_${b.id}`,
        data: dtRaw ? String(dtRaw).substring(0, 10) : null,
        categoria: 'servico',
        descricao: `Boletim de Medição — ${b.numero != null ? `Nº ${b.numero}` : b.id}`,
        valor,
        status: 'realizado',
        origem: 'medicao',
      });
    });

    return resultado;
  }, [lancamentos, apontamentos, bms]);

  // ── Filtrar por ano/mês ──────────────────────────────────────
  const linhasFiltradas = useMemo(() => {
    return linhas.filter(l => {
      if (!l.data) return true; // sem data: inclui sempre
      const [y, m] = l.data.split('-');
      if (Number(y) !== filtroAno) return false;
      if (filtroMes && Number(m) !== Number(filtroMes)) return false;
      return true;
    });
  }, [linhas, filtroAno, filtroMes]);

  // ── Totais por categoria ─────────────────────────────────────
  const totais = useMemo(() => {
    const t = { material: 0, mao_de_obra: 0, servico: 0, outro: 0 };
    linhasFiltradas.forEach(l => { t[l.categoria] = (t[l.categoria] || 0) + l.valor; });
    t.geral = Object.values(t).reduce((s, v) => s + v, 0);
    return t;
  }, [linhasFiltradas]);

  // ── Agrupamento por mês (para tabela) ───────────────────────
  const porMes = useMemo(() => {
    const m = {};
    linhasFiltradas.forEach(l => {
      const key = l.data ? l.data.substring(0, 7) : 'sem-data';
      if (!m[key]) m[key] = { mes: key, material: 0, mao_de_obra: 0, servico: 0, outro: 0 };
      m[key][l.categoria] += l.valor;
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [linhasFiltradas]);

  // ── Exportar Excel branded ───────────────────────────────────
  const exportarExcel = () => {
    if (!linhasFiltradas.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      // Data 'YYYY-MM-DD' → 'dd/mm/aaaa' (sem Date p/ evitar fuso).
      const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');
      const periodo = `${filtroMes ? MESES[Number(filtroMes) - 1] + '/' : ''}${filtroAno}`;
      const rows = linhasFiltradas.map((l) => [
        dataBR(l.data),
        CATEGORIAS[l.categoria]?.label || l.categoria,
        l.descricao || '',
        Number(l.valor) || 0,
        (l.origem || '').replace(/_/g, ' '),
        l.status || '',
      ]);
      // Subtotais por categoria + total geral como linhas finais.
      rows.push(
        ['', '', '', '', '', ''],
        ['TOTAL MATERIAL', '', '', Number(totais.material) || 0, '', ''],
        ['TOTAL MÃO DE OBRA', '', '', Number(totais.mao_de_obra) || 0, '', ''],
        ['TOTAL SERVIÇOS', '', '', Number(totais.servico) || 0, '', ''],
        ['TOTAL OUTROS', '', '', Number(totais.outro) || 0, '', ''],
        ['TOTAL GERAL', '', '', Number(totais.geral) || 0, '', ''],
      );
      exportarXLSXBranded(`centro_custos_${filtroAno}${filtroMes ? '_' + String(filtroMes).padStart(2, '0') : ''}`, [{
        nome: 'Centro de Custos',
        titulo: 'Centro de Custos da Obra',
        subtitulo: `${obra?.nome ? obra.nome + ' · ' : ''}${periodo}`,
        headers: ['Data', 'Categoria', 'Descrição', 'Valor', 'Origem', 'Status'],
        rows,
        moeda: [3],
        larguras: [12, 16, 50, 14, 16, 14],
      }], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  if (isLoading) {
    return <PageSkeleton kpis={4} rows={8} cols={5} />;
  }

  return (
    <div className="space-y-6 text-gray-700">
      {/* Header + Filtros */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Centro de Custos</h2>
          <p className="text-sm text-gray-500 hidden sm:block">Material · Mão de Obra · Serviços · Outros</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end w-full sm:w-auto">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ano</label>
            <input
              type="number"
              value={filtroAno}
              onChange={e => setFiltroAno(Number(e.target.value))}
              className="bg-white border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 w-20 h-9"
              min="2020" max="2030"
            />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="text-xs text-gray-500 block mb-1">Mês</label>
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 w-full sm:w-auto h-9"
            >
              <option value="">Todos</option>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <Button onClick={exportarExcel} variant="outline" size="sm" className="gap-1 border-gray-300 text-gray-700 hover:text-gray-900 w-full sm:w-auto h-9" disabled={linhasFiltradas.length === 0}>
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(CATEGORIAS).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500 font-medium">{cfg.label}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{fmt(totais[key])}</p>
              {totais.geral > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {((totais[key] / totais.geral) * 100).toFixed(1)}% do total
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Total Geral */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <p className="text-blue-700 text-sm font-medium">CUSTO TOTAL DO PERÍODO</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 break-words">{fmt(totais.geral)}</p>
        </div>
        <Badge className="bg-blue-600 text-white text-sm px-3 py-1 self-start sm:self-auto shrink-0">{linhasFiltradas.length} lançamentos</Badge>
      </div>

      {/* Tabela por mês */}
      {porMes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Evolução por Mês</h3>
          </div>

          {/* Mobile: cards por mês */}
          <div className="md:hidden divide-y divide-gray-100">
            {porMes.map((r) => {
              const total = r.material + r.mao_de_obra + r.servico + r.outro;
              const label = r.mes === 'sem-data' ? 'Sem data' : (() => {
                const [y, m] = r.mes.split('-');
                return `${MESES[Number(m) - 1]}/${y}`;
              })();
              return (
                <div key={r.mes} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{label}</span>
                    <span className="font-bold text-gray-900 whitespace-nowrap">{fmt(total)}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {r.material > 0 && <div className="flex justify-between gap-2"><span className="text-gray-500">Material</span><span className="text-blue-700 whitespace-nowrap">{fmt(r.material)}</span></div>}
                    {r.mao_de_obra > 0 && <div className="flex justify-between gap-2"><span className="text-gray-500">Mão de Obra</span><span className="text-green-700 whitespace-nowrap">{fmt(r.mao_de_obra)}</span></div>}
                    {r.servico > 0 && <div className="flex justify-between gap-2"><span className="text-gray-500">Serviços</span><span className="text-purple-700 whitespace-nowrap">{fmt(r.servico)}</span></div>}
                    {r.outro > 0 && <div className="flex justify-between gap-2"><span className="text-gray-500">Outros</span><span className="text-gray-600 whitespace-nowrap">{fmt(r.outro)}</span></div>}
                  </div>
                </div>
              );
            })}
            <div className="p-3 bg-gray-100 flex items-center justify-between font-bold text-gray-900">
              <span>TOTAL</span>
              <span className="whitespace-nowrap">{fmt(totais.geral)}</span>
            </div>
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="p-3 text-left text-gray-500 font-medium">Mês</th>
                  <th className="p-3 text-right text-gray-500 font-medium">Material</th>
                  <th className="p-3 text-right text-gray-500 font-medium">Mão de Obra</th>
                  <th className="p-3 text-right text-gray-500 font-medium">Serviços</th>
                  <th className="p-3 text-right text-gray-500 font-medium">Outros</th>
                  <th className="p-3 text-right text-gray-900 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {porMes.map((r, idx) => {
                  const total = r.material + r.mao_de_obra + r.servico + r.outro;
                  const label = r.mes === 'sem-data' ? 'Sem data' : (() => {
                    const [y, m] = r.mes.split('-');
                    return `${MESES[Number(m) - 1]}/${y}`;
                  })();
                  return (
                    <tr key={r.mes} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="p-3 text-gray-700 font-medium">{label}</td>
                      <td className="p-3 text-right text-blue-700">{r.material > 0 ? fmt(r.material) : '—'}</td>
                      <td className="p-3 text-right text-green-700">{r.mao_de_obra > 0 ? fmt(r.mao_de_obra) : '—'}</td>
                      <td className="p-3 text-right text-purple-700">{r.servico > 0 ? fmt(r.servico) : '—'}</td>
                      <td className="p-3 text-right text-gray-600">{r.outro > 0 ? fmt(r.outro) : '—'}</td>
                      <td className="p-3 text-right font-bold text-gray-900">{fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="p-3 text-gray-900">TOTAL</td>
                  <td className="p-3 text-right text-blue-700">{fmt(totais.material)}</td>
                  <td className="p-3 text-right text-green-700">{fmt(totais.mao_de_obra)}</td>
                  <td className="p-3 text-right text-purple-700">{fmt(totais.servico)}</td>
                  <td className="p-3 text-right text-gray-700">{fmt(totais.outro)}</td>
                  <td className="p-3 text-right text-gray-900 text-base">{fmt(totais.geral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tabela detalhada de lançamentos */}
      {linhasFiltradas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Nenhum custo registrado</p>
          <p className="text-gray-400 text-sm">para o período selecionado</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center gap-2">
            <h3 className="font-semibold text-gray-900">Lançamentos Detalhados</h3>
            <span className="text-xs text-gray-500 shrink-0">{linhasFiltradas.length} registros</span>
          </div>

          {/* Mobile: cards de lançamento */}
          <div className="md:hidden max-h-96 overflow-y-auto divide-y divide-gray-100">
            {linhasFiltradas.map((l) => {
              const cfg = CATEGORIAS[l.categoria] || CATEGORIAS.outro;
              return (
                <div key={l.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">{l.descricao}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">{l.data || '—'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">{fmt(l.valor)}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                        l.status === 'realizado' ? 'bg-green-100 text-green-800' :
                        l.status === 'provisionado' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>{l.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="p-3 text-left text-gray-500 font-medium">Data</th>
                  <th className="p-3 text-left text-gray-500 font-medium">Categoria</th>
                  <th className="p-3 text-left text-gray-500 font-medium">Descrição</th>
                  <th className="p-3 text-right text-gray-500 font-medium">Valor</th>
                  <th className="p-3 text-center text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.map((l, idx) => {
                  const cfg = CATEGORIAS[l.categoria] || CATEGORIAS.outro;
                  return (
                    <tr key={l.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="p-3 text-gray-500 whitespace-nowrap">{l.data || '—'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 max-w-xs truncate">{l.descricao}</td>
                      <td className="p-3 text-right font-semibold text-gray-900">{fmt(l.valor)}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          l.status === 'realizado' ? 'bg-green-100 text-green-800' :
                          l.status === 'provisionado' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>{l.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
