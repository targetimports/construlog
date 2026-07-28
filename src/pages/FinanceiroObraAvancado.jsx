import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Search, Building2, ArrowLeft, Activity } from 'lucide-react';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import DashboardFinanceiroObra from '../components/financeiro/DashboardFinanceiroObra';
import SimuladorObra from '../components/financeiro/SimuladorObra';
import ViabilidadeObra from '../components/financeiro/ViabilidadeObra';

const STATUS = {
  orcamento:    { label: 'Orçamento',     cls: 'bg-slate-100 text-slate-700' },
  planejamento: { label: 'Planejamento',  cls: 'bg-slate-100 text-slate-700' },
  a_iniciar:    { label: 'A Iniciar',     cls: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em Andamento',  cls: 'bg-blue-100 text-blue-700' },
  pausada:      { label: 'Pausada',       cls: 'bg-amber-100 text-amber-700' },
  concluida:    { label: 'Finalizada',    cls: 'bg-emerald-100 text-emerald-700' },
  cancelada:    { label: 'Cancelada',     cls: 'bg-red-100 text-red-700' },
};

export default function FinanceiroObraAvancado() {
  const [obraId, setObraId] = useState(null);
  const [busca, setBusca] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-usuario'],
    queryFn: async () => {
      try {
        return await base44.entities.Obra.list('-created_date', 500);
      } catch (err) {
        console.error('Erro ao buscar obras:', err);
        return [];
      }
    }
  });

  const { data: dre } = useQuery({
    queryKey: ['dre-atual', obraId],
    queryFn: async () => {
      if (!obraId) return null;
      const dreBd = await base44.entities.DREObra.filter({ obra_id: obraId });
      const d = dreBd && dreBd.length > 0 ? dreBd[dreBd.length - 1] : null;
      if (d && ((d.receita_faturada || 0) || (d.custo_total || 0))) return d;
      // Fallback: DRE estimada a partir da obra, para o Simulador funcionar
      // mesmo sem DREObra calculada (o backend recalcula de forma consistente).
      const o = await base44.entities.Obra.get(obraId).catch(() => null);
      if (!o) return d;
      const n = (v) => Number(v) || 0;
      const receita = n(o.valor_realizado) || n(o.valor_contrato) || n(o.valor_orcado) || n(o.total_orcamento);
      const custoTotal = n(o.valor_orcado) || n(o.total_final_orcamento) || n(o.total_orcamento);
      const lucro = receita - custoTotal;
      return {
        _estimado: true,
        receita_faturada: receita,
        custo_total: custoTotal,
        custo_materiais: custoTotal * 0.6,
        custo_mao_obra: custoTotal * 0.4,
        lucro_bruto: lucro,
        margem_percentual: receita > 0 ? (lucro / receita) * 100 : 0,
      };
    },
    enabled: !!obraId
  });

  const obrasFiltradas = useMemo(() => {
    if (!busca) return obras;
    const b = busca.toLowerCase();
    return obras.filter((o) => (o.nome || '').toLowerCase().includes(b) || (o.cliente || '').toLowerCase().includes(b));
  }, [obras, busca]);

  const obra = obras.find((o) => o.id === obraId);

  // ── Tela de seleção de obra ────────────────────────────────────────────
  if (!obraId) {
    return (
      <div className="max-w-5xl mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro — Análise da Obra</h1>
          <p className="text-gray-500 mt-1">Dashboard financeiro, simulador de cenários e viabilidade de ativação.</p>
        </div>

        {/* Filtro / combobox */}
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Buscar obra</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input placeholder="Nome ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="h-11 pl-9" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Selecionar obra</label>
                <ComboboxBusca
                  options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                  value={obraId || ''}
                  onSelect={(v) => setObraId(v)}
                  placeholder="Escolha a obra..."
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra encontrada."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {obras.length === 0 ? (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-8">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Nenhuma obra encontrada</p>
                  <p className="text-sm text-amber-700">Crie uma obra para acessar a análise financeira.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {obrasFiltradas.map((o) => {
              const st = STATUS[o.status] || { label: o.status || '—', cls: 'bg-gray-100 text-gray-600' };
              return (
                <button
                  key={o.id}
                  onClick={() => setObraId(o.id)}
                  className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{o.nome}</h3>
                      {o.cliente && <p className="text-sm text-gray-500 truncate mt-0.5">{o.cliente}</p>}
                    </div>
                    <Building2 className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  </div>
                  <Badge className={`mt-3 ${st.cls} text-xs border-0`}>{st.label}</Badge>
                </button>
              );
            })}
            {obrasFiltradas.length === 0 && (
              <div className="md:col-span-2 text-center py-10 text-gray-400 text-sm">Nenhuma obra encontrada com esse filtro.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Tela da obra selecionada ───────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{obra?.nome}</h1>
          <p className="text-gray-500 mt-1">{obra?.cliente || ''}</p>
        </div>
        <Button variant="outline" onClick={() => setObraId(null)} className="gap-2 border-gray-300 text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      <Tabs defaultValue="viabilidade" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="viabilidade" className="gap-1.5"><Activity className="w-4 h-4" /> Viabilidade (Ativação)</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard Financeiro</TabsTrigger>
          <TabsTrigger value="simulador">Simulador de Cenários</TabsTrigger>
        </TabsList>

        <TabsContent value="viabilidade" className="space-y-6">
          <ViabilidadeObra obra_id={obraId} />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardFinanceiroObra obra_id={obraId} />
        </TabsContent>

        <TabsContent value="simulador" className="space-y-6">
          <SimuladorObra obra_id={obraId} dre_atual={dre} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
