import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { addMonths, format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000000) return `R$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
};

export default function FluxoCaixaProjetadoEmpresa() {
  const [meses, setMeses] = useState('12');
  const [incluirOrcamento, setIncluirOrcamento] = useState(false);
  const [empresaId, setEmpresaId] = useState('__all__');

  const hoje = new Date();

  // Empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-fluxo'],
    queryFn: () => base44.entities.Empresa.list('-updated_date', 100)
  });

  // Obras (filtrando por status)
  const { data: obras = [], isLoading: obrasLoading } = useQuery({
    queryKey: ['obras-fluxo-caixa', incluirOrcamento, empresaId],
    queryFn: async () => {
      const statusPermitidos = ['planejamento', 'em_andamento', 'pausada'];
      if (incluirOrcamento) statusPermitidos.push('orcamento');

      const all = await base44.entities.Obra.list('-updated_date', 1000);
      const filtroEmpresa = empresaId && empresaId !== '__all__' ? empresaId : null;

      return all.filter(o => statusPermitidos.includes(o.status)
        && (!filtroEmpresa || o.empresa_id === filtroEmpresa));
    }
  });

  const obraIds = useMemo(() => obras.map(o => o.id), [obras]);

  // Recebimentos previstos (PREVISTO + FATURADO)
  const { data: recebimentos = [], isLoading: recebLoading } = useQuery({
    queryKey: ['receb-previstos-fluxo', obraIds.join(',')],
    queryFn: async () => {
      if (!obraIds.length) return [];
      const all = await base44.entities.RecebimentoPrevisto.list('-updated_date', 5000);
      return all.filter(r =>
        obraIds.includes(r.obra_id) &&
        (r.status === 'PREVISTO' || r.status === 'FATURADO')
      );
    },
    enabled: obraIds.length > 0
  });

  // Contas a pagar pendentes (PREVISTO / COMPROMETIDO)
  const { data: contasPagar = [], isLoading: contasLoading } = useQuery({
    queryKey: ['contas-pagar-fluxo', obraIds.join(',')],
    queryFn: async () => {
      if (!obraIds.length) return [];
      const all = await base44.entities.ContaFinanceira.list('-updated_date', 5000);
      return all.filter(c =>
        obraIds.includes(c.obra_id) &&
        c.tipo === 'pagar' &&
        (c.status === 'pendente' || c.status === 'aprovado')
      );
    },
    enabled: obraIds.length > 0
  });

  // Contas a receber pendentes (entram na projeção de entradas)
  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-fluxo', obraIds.join(',')],
    queryFn: async () => {
      if (!obraIds.length) return [];
      const all = await base44.entities.ContaFinanceira.list('-updated_date', 5000);
      return all.filter(c =>
        obraIds.includes(c.obra_id) && c.tipo === 'receber' &&
        (c.status === 'pendente' || c.status === 'aprovado' || c.status === 'parcial')
      );
    },
    enabled: obraIds.length > 0
  });

  // Saldo atual (contas de tesouraria ativas — caixa/bancos/obras)
  const { data: contasTesouraria = [] } = useQuery({
    queryKey: ['contas-tesouraria-saldo'],
    queryFn: () => base44.entities.ContaTesouraria.list('-updated_date', 200)
  });

  const saldoAtual = useMemo(() =>
    contasTesouraria
      .filter(c => !c.status || c.status === 'ativa')
      .reduce((s, c) => s + (c.saldo_atual || 0), 0),
    [contasTesouraria]
  );

  // Gerar projeção mensal
  const projecao = useMemo(() => {
    const qtdMeses = parseInt(meses);
    const resultado = [];
    let saldoAcumulado = saldoAtual;

    for (let i = 0; i < qtdMeses; i++) {
      const mesRef = addMonths(hoje, i);
      const inicio = startOfMonth(mesRef);
      const fim = endOfMonth(mesRef);
      const chave = format(mesRef, 'MMM/yy', { locale: ptBR });

      // Entradas previstas no mês = recebimentos previstos + contas a receber pendentes
      const entradasMes = recebimentos
        .filter(r => r.data_prevista && isWithinInterval(parseISO(r.data_prevista), { start: inicio, end: fim }))
        .reduce((s, r) => s + (r.valor_previsto || 0), 0)
        + contasReceber
          .filter(c => c.data_vencimento && isWithinInterval(parseISO(c.data_vencimento), { start: inicio, end: fim }))
          .reduce((s, c) => s + (c.valor || 0), 0);

      // Saídas previstas no mês
      const saidasMes = contasPagar
        .filter(c => c.data_vencimento && isWithinInterval(parseISO(c.data_vencimento), { start: inicio, end: fim }))
        .reduce((s, c) => s + (c.valor || 0), 0);

      const saldoMes = entradasMes - saidasMes;
      saldoAcumulado += saldoMes;

      resultado.push({
        mes: chave,
        mesRef,
        entradas: entradasMes,
        saidas: saidasMes,
        saldo_mes: saldoMes,
        saldo_acumulado: saldoAcumulado,
        negativo: saldoAcumulado < 0
      });
    }

    return resultado;
  }, [recebimentos, contasReceber, contasPagar, saldoAtual, meses]);

  const isLoading = obrasLoading || recebLoading || contasLoading;

  const totalEntradas = projecao.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = projecao.reduce((s, m) => s + m.saidas, 0);
  const mesesNegativos = projecao.filter(m => m.negativo).length;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-white mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    );
  };

  const CustomBar = (props) => {
    const { x, y, width, height, payload, dataKey } = props;
    const negativo = payload?.negativo;
    const fill = dataKey === 'entradas' ? '#10b981'
      : dataKey === 'saidas' ? '#ef4444'
      : negativo ? '#ef4444' : '#3b82f6';
    return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={fill} rx={2} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fluxo de Caixa Projetado</h1>
        <p className="text-gray-500 text-sm mt-1">Projeção consolidada por empresa — entradas e saídas previstas</p>
      </div>

      {/* Filtros */}
      <Card className="shadow-none">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Empresa */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Empresa</label>
              <ComboboxBusca
                options={[{ value: '__all__', label: 'Todas as empresas' }, ...empresas.map(e => ({ value: e.id, label: e.nome || e.razao_social }))]}
                value={empresaId}
                onSelect={setEmpresaId}
                placeholder="Todas as empresas"
                searchPlaceholder="Buscar empresa..."
                emptyMessage="Nenhuma empresa."
              />
            </div>

            {/* Período */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Horizonte</label>
              <Select value={meses} onValueChange={setMeses}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="18">18 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Incluir obras em orçamento */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <Switch
                checked={incluirOrcamento}
                onCheckedChange={setIncluirOrcamento}
              />
              <Label className="text-gray-700 text-sm cursor-pointer">
                Incluir obras em Orçamento
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border border-gray-200 rounded-lg shadow-none">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-gray-500">Saldo Atual</span>
                </div>
                <p title={fmt(saldoAtual)} className={`text-lg sm:text-2xl font-bold tabular-nums truncate ${saldoAtual >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {fmtCompactBRL(saldoAtual)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 rounded-lg shadow-none">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-gray-500">Entradas Previstas</span>
                </div>
                <p title={fmt(totalEntradas)} className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate">{fmtCompactBRL(totalEntradas)}</p>
                <p className="text-xs text-gray-500 mt-1">{meses} meses</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 rounded-lg shadow-none">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-medium text-gray-500">Saídas Previstas</span>
                </div>
                <p title={fmt(totalSaidas)} className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate">{fmtCompactBRL(totalSaidas)}</p>
                <p className="text-xs text-gray-500 mt-1">{meses} meses</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 rounded-lg shadow-none">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`w-4 h-4 ${mesesNegativos > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                  <span className="text-xs font-medium text-gray-500">Meses Negativos</span>
                </div>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums ${mesesNegativos > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {mesesNegativos}
                </p>
                <p className="text-xs text-gray-500 mt-1">saldo acumulado &lt; 0</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Projeção Mensal — Entradas vs Saídas vs Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={projecao} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" opacity={0.85} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" opacity={0.85} radius={[2, 2, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="saldo_acumulado"
                    name="Saldo Acumulado"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={`dot-${payload.mes}`}
                          cx={cx} cy={cy} r={4}
                          fill={payload.negativo ? '#ef4444' : '#3b82f6'}
                          stroke="none"
                        />
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela Mensal */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Tabela Mensal Detalhada</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {projecao.map((m, idx) => (
                  <div key={`mc-${idx}`} className={`p-3 rounded-lg border space-y-2 ${m.negativo ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 capitalize">{m.mes}</p>
                      {m.negativo
                        ? <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Déficit</Badge>
                        : <Badge className="bg-green-100 text-green-700 border-0 text-xs">OK</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div><p className="text-xs text-gray-500">Entradas</p><p className="font-medium text-green-600 break-words">{fmt(m.entradas)}</p></div>
                      <div><p className="text-xs text-gray-500">Saídas</p><p className="font-medium text-red-600 break-words">{fmt(m.saidas)}</p></div>
                      <div><p className="text-xs text-gray-500">Saldo do mês</p><p className={`font-semibold break-words ${m.saldo_mes >= 0 ? 'text-gray-700' : 'text-red-600'}`}>{m.saldo_mes >= 0 ? '+' : ''}{fmt(m.saldo_mes)}</p></div>
                      <div><p className="text-xs text-gray-500">Acumulado</p><p className={`font-bold break-words ${m.negativo ? 'text-red-600' : 'text-blue-700'}`}>{fmt(m.saldo_acumulado)}</p></div>
                    </div>
                  </div>
                ))}
                <div className="p-3 rounded-lg border border-gray-300 bg-gray-50 space-y-2">
                  <p className="font-bold text-gray-900">TOTAL</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div><p className="text-xs text-gray-500">Entradas</p><p className="font-bold text-green-700 break-words">{fmt(totalEntradas)}</p></div>
                    <div><p className="text-xs text-gray-500">Saídas</p><p className="font-bold text-red-700 break-words">{fmt(totalSaidas)}</p></div>
                    <div><p className="text-xs text-gray-500">Resultado</p><p className={`font-bold break-words ${totalEntradas - totalSaidas >= 0 ? 'text-gray-700' : 'text-red-600'}`}>{fmt(totalEntradas - totalSaidas)}</p></div>
                    <div><p className="text-xs text-gray-500">Acumulado final</p><p className={`font-bold break-words ${projecao.at(-1)?.saldo_acumulado >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(projecao.at(-1)?.saldo_acumulado)}</p></div>
                  </div>
                </div>
              </div>

              {/* Tabela (desktop) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="p-3 text-left text-xs font-semibold text-gray-500">Mês</th>
                      <th className="p-3 text-right text-xs font-semibold text-gray-500">Entradas</th>
                      <th className="p-3 text-right text-xs font-semibold text-gray-500">Saídas</th>
                      <th className="p-3 text-right text-xs font-semibold text-gray-500">Saldo do Mês</th>
                      <th className="p-3 text-right text-xs font-semibold text-gray-500">Saldo Acumulado</th>
                      <th className="p-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projecao.map((m, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${m.negativo ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                      >
                        <td className="p-3 font-semibold capitalize">{m.mes}</td>
                        <td className="p-3 text-right text-green-600 font-medium">{fmt(m.entradas)}</td>
                        <td className="p-3 text-right text-red-600 font-medium">{fmt(m.saidas)}</td>
                        <td className={`p-3 text-right font-semibold ${m.saldo_mes >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                          {m.saldo_mes >= 0 ? '+' : ''}{fmt(m.saldo_mes)}
                        </td>
                        <td className={`p-3 text-right font-bold ${m.negativo ? 'text-red-600' : 'text-blue-700'}`}>
                          {fmt(m.saldo_acumulado)}
                        </td>
                        <td className="p-3 text-center">
                          {m.negativo ? (
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Déficit
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                              OK
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-gray-50">
                      <td className="p-3 font-bold">TOTAL</td>
                      <td className="p-3 text-right font-bold text-green-700">{fmt(totalEntradas)}</td>
                      <td className="p-3 text-right font-bold text-red-700">{fmt(totalSaidas)}</td>
                      <td className={`p-3 text-right font-bold ${totalEntradas - totalSaidas >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                        {fmt(totalEntradas - totalSaidas)}
                      </td>
                      <td className={`p-3 text-right font-bold ${projecao.at(-1)?.saldo_acumulado >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                        {fmt(projecao.at(-1)?.saldo_acumulado)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Alerta de obras sem recebimentos */}
          {obras.length > 0 && recebimentos.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
              Nenhum recebimento previsto cadastrado para as obras filtradas. Cadastre recebimentos previstos (ou contas a receber) nas obras para uma projeção completa.
            </div>
          )}
        </>
      )}
    </div>
  );
}