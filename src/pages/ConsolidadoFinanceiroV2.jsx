import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'];
const fmtFull = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const TIPOS = [
  { value: 'REALIZADO', label: 'Realizado' },
  { value: 'PREVISTO', label: 'Previsto' },
  { value: 'AMBOS', label: 'Ambos' },
];

function ConsolidadoFinanceiroV2Content() {
  // Filtros com localStorage
  const [filtros, setFiltros] = useState(() => {
    const saved = localStorage.getItem('consolidado_filtros');
    return saved ? JSON.parse(saved) : {
      obra_id: '',
      data_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      data_fim: new Date().toISOString().split('T')[0],
      tipo: 'AMBOS'
    };
  });

  const [consolidacao, setConsolidacao] = useState(null);
  const [carregando, setCarregando] = useState(false);

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(null, 100)
  });

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra selecionada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obras.find((o) => o.id === filtros.obra_id)?.empresa_id);

  // Salvar filtros no localStorage
  useEffect(() => {
    localStorage.setItem('consolidado_filtros', JSON.stringify(filtros));
  }, [filtros]);

  // Atualizar filtro
  const handleFiltroChange = (chave, valor) => {
    setFiltros(prev => ({ ...prev, [chave]: valor }));
  };

  // Limpar filtros
  const handleLimpar = () => {
    setFiltros({
      obra_id: '',
      data_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      data_fim: new Date().toISOString().split('T')[0],
      tipo: 'AMBOS'
    });
    setConsolidacao(null);
  };

  // Consolidar
  const handleConsolidar = async () => {
    if (!filtros.obra_id) {
      toast.error('Selecione uma obra');
      return;
    }

    setCarregando(true);
    try {
      const res = await base44.functions.invoke('consolidarFinanceiroCompleto', {
        obra_id: filtros.obra_id,
        data_inicio: filtros.data_inicio,
        data_fim: filtros.data_fim,
        tipo: filtros.tipo
      });

      if (res.data.success) {
        setConsolidacao(res.data);
        toast.success('Consolidação calculada!');
      }
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // Exporta EXCEL branded com a consolidação exibida na tela.
  const exportarExcel = () => {
    if (!consolidacao) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    try {
      const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
      const obraNome = obras.find((o) => o.id === filtros.obra_id)?.nome || '';
      const num = (v) => Number(v) || 0;

      const abas = [{
        nome: 'Consolidado',
        titulo: 'Consolidado Financeiro',
        subtitulo: `${obraNome} · ${dataBR(filtros.data_inicio)} a ${dataBR(filtros.data_fim)} · ${filtros.tipo}`,
        headers: ['Indicador', 'Valor'],
        rows: [
          ['Receita Realizada', num(consolidacao.receita_realizada)],
          ['Receita Prevista', num(consolidacao.receita_prevista)],
          ['Receita Total', num(consolidacao.receita_total)],
          ['Despesa Realizada', num(consolidacao.despesa_realizada)],
          ['Despesa Prevista', num(consolidacao.despesa_prevista)],
          ['Despesa Total', num(consolidacao.despesa_total)],
          ['Saldo Realizado', num(consolidacao.saldo_realizado)],
          ['Saldo Previsto', num(consolidacao.saldo_previsto)],
          ['Saldo Total', num(consolidacao.saldo_total)],
          ['Margem Realizada', `${consolidacao.margem_realizada}%`],
          ['Status da Margem', consolidacao.margem_status || ''],
        ],
        moeda: [1],
        larguras: [28, 20],
      }];

      // Bônus: 2ª aba com o breakdown de despesas por categoria (se houver).
      if (consolidacao.despesa_por_categoria && Object.keys(consolidacao.despesa_por_categoria).length > 0) {
        abas.push({
          nome: 'Despesas por Categoria',
          titulo: 'Despesas por Categoria',
          subtitulo: `${obraNome} · ${dataBR(filtros.data_inicio)} a ${dataBR(filtros.data_fim)}`,
          headers: ['Categoria', 'Valor'],
          rows: Object.entries(consolidacao.despesa_por_categoria).map(([categoria, valor]) => [
            categoria,
            num(valor),
          ]),
          moeda: [1],
          larguras: [28, 20],
        });
      }

      exportarXLSXBranded(`consolidado_financeiro_${new Date().toISOString().split('T')[0]}`, abas, { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  // KPIs (formato compacto do sistema; cor semântica). Título com valor cheio no hover.
  const kpis = consolidacao ? [
    { label: 'Receita Realizada', valor: consolidacao.receita_realizada, cor: 'text-green-600', sub: consolidacao.receita_prevista > 0 ? `+ ${fmtCompactBRL(consolidacao.receita_prevista)} previsto` : null },
    { label: 'Despesa Realizada', valor: consolidacao.despesa_realizada, cor: 'text-red-600', sub: consolidacao.despesa_prevista > 0 ? `+ ${fmtCompactBRL(consolidacao.despesa_prevista)} previsto` : null },
    { label: 'Saldo Realizado', valor: consolidacao.saldo_realizado, cor: consolidacao.saldo_realizado >= 0 ? 'text-blue-600' : 'text-red-600' },
    { label: 'Saldo Total', valor: consolidacao.saldo_total, cor: consolidacao.saldo_total >= 0 ? 'text-blue-600' : 'text-red-600' },
  ] : [];

  const statusCor = {
    excelente: 'text-green-600', normal: 'text-blue-600', alerta: 'text-amber-600',
  }[consolidacao?.margem_status] || 'text-red-600';

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consolidado Financeiro por Obra</h1>
        <p className="text-gray-500 text-sm mt-1">Realizado vs Previsto | Receita, Despesa e Caixa</p>
      </div>

      {/* Filtros (painel de configuração + ação — sempre visível) */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Obra *</label>
              <ComboboxBusca
                options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                value={filtros.obra_id}
                onSelect={(v) => handleFiltroChange('obra_id', v || '')}
                placeholder="Selecione"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Data Início</label>
              <Input className="h-11" type="date" value={filtros.data_inicio} onChange={(e) => handleFiltroChange('data_inicio', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Data Fim</label>
              <Input className="h-11" type="date" value={filtros.data_fim} onChange={(e) => handleFiltroChange('data_fim', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo</label>
              <ComboboxBusca
                options={TIPOS}
                value={filtros.tipo}
                onSelect={(v) => handleFiltroChange('tipo', v || 'AMBOS')}
                placeholder="Ambos"
                searchPlaceholder="Buscar..."
              />
            </div>

            <div className="flex gap-2 items-end">
              <Button onClick={handleConsolidar} disabled={carregando || !filtros.obra_id} className="flex-1 h-11 gap-2 bg-blue-600 hover:bg-blue-700">
                <Search className="w-4 h-4" /> {carregando ? 'Carregando...' : 'Consolidar'}
              </Button>
              <Button onClick={handleLimpar} variant="outline" className="h-11 w-11 p-0 border-gray-300 text-gray-700" title="Limpar">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {consolidacao && (
        <>
          {/* Cards de Totalizações */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {kpis.map((k) => (
              <Card key={k.label} className="bg-white border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500">{k.label}</p>
                  <p className={`text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate ${k.cor}`} title={fmtFull(k.valor)}>{fmtCompactBRL(k.valor)}</p>
                  {k.sub && <p className="text-xs text-gray-400 mt-2 truncate">{k.sub}</p>}
                </CardContent>
              </Card>
            ))}

            {/* Margem (percentual + status) */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-gray-500">Margem Realizada</p>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums mt-1 ${consolidacao.margem_realizada >= 15 ? 'text-green-600' : 'text-amber-600'}`}>
                  {consolidacao.margem_realizada}%
                </p>
                <p className={`text-xs mt-2 font-semibold capitalize truncate ${statusCor}`}>
                  {consolidacao.margem_status}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Receita x Despesa (Fluxo de Caixa)</CardTitle>
              </CardHeader>
              <CardContent>
                {consolidacao.caixa_diario && consolidacao.caixa_diario.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={consolidacao.caixa_diario}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtCompactBRL(v).replace('R$ ', '')} />
                      <Tooltip formatter={(value) => fmtFull(value)} />
                      <Legend />
                      <Bar dataKey="entrada" fill="#10b981" name="Entrada" />
                      <Bar dataKey="saida" fill="#ef4444" name="Saída" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Breakdown de Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                {consolidacao.despesa_por_categoria && Object.keys(consolidacao.despesa_por_categoria).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(consolidacao.despesa_por_categoria).map(([k, v]) => ({
                          name: k,
                          value: v
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {Object.entries(consolidacao.despesa_por_categoria).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => fmtFull(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Fornecedores e Centros de Custo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Top 5 Fornecedores</CardTitle>
              </CardHeader>
              <CardContent>
                {consolidacao.top_fornecedores && consolidacao.top_fornecedores.length > 0 ? (
                  <div className="space-y-2">
                    {consolidacao.top_fornecedores.map((f, i) => (
                      <div key={i} className="flex justify-between items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700 truncate min-w-0">{f.fornecedor_nome}</span>
                        <span className="font-semibold text-blue-700 tabular-nums shrink-0" title={fmtFull(f.valor)}>{fmtCompactBRL(f.valor)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Sem dados</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Top 5 Centros de Custo</CardTitle>
              </CardHeader>
              <CardContent>
                {consolidacao.top_centros_custo && consolidacao.top_centros_custo.length > 0 ? (
                  <div className="space-y-2">
                    {consolidacao.top_centros_custo.map((cc, i) => (
                      <div key={i} className="flex justify-between items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700 truncate min-w-0">{cc.centro_custo_nome}</span>
                        <span className="font-semibold text-gray-900 tabular-nums shrink-0" title={fmtFull(cc.valor)}>{fmtCompactBRL(cc.valor)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Sem dados</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Botão de exportação */}
          <div className="flex sm:justify-end">
            <Button onClick={exportarExcel} className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
          </div>
        </>
      )}

      {!consolidacao && !carregando && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-8 text-center text-gray-500">
            Selecione os filtros e clique em <span className="font-medium text-gray-700">"Consolidar"</span> para visualizar os dados.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ConsolidadoFinanceiroV2() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="FINANCEIRO_VIEW">
      <ConsolidadoFinanceiroV2Content />
    </RouteGuardFinalV2>
  );
}
