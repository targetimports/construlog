import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';

const motivoConfig = {
  controle_critico: { label: 'Controle Crítico', color: 'bg-red-100 text-red-700' },
  alto_custo: { label: 'Alto Custo', color: 'bg-amber-100 text-amber-700' },
  risco_seguranca: { label: 'Risco de Segurança', color: 'bg-orange-100 text-orange-700' },
  rotacao_rapida: { label: 'Rotação Rápida', color: 'bg-blue-100 text-blue-700' },
  outro: { label: 'Outro', color: 'bg-gray-100 text-gray-600' },
};

const categoriaConfig = {
  cimento: 'Cimento', areia: 'Areia', brita: 'Brita', aco: 'Aço', madeira: 'Madeira',
  eletrico: 'Elétrico', hidraulico: 'Hidráulico', acabamento: 'Acabamento',
  epi: 'EPI', ferramentas: 'Ferramentas', outros: 'Outros',
};

function TabelaMateriais({ itens, obras, statusBadge }) {
  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(itens, 20);

  return (
    <>
      {/* Mobile: cards */}
      <div className="md:hidden flex flex-col gap-2 p-2">
        {paginatedItems.map((m) => {
          const obra = obras.find((o) => o.id === m.obra_id);
          const motivo = motivoConfig[m.motivo_apontamento];
          return (
            <div key={m.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.nome}</p>
                  <p className="text-xs text-gray-500 truncate">{m.categoria ? (categoriaConfig[m.categoria] || m.categoria) : '—'}{obra?.nome ? ` · ${obra.nome}` : ''}</p>
                </div>
                {statusBadge}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                <span>Estoque: {m.estoque_atual != null ? `${m.estoque_atual} ${m.unidade || ''}` : '—'}</span>
                {motivo && <Badge className={`border-0 ${motivo.color}`}>{motivo.label}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-3 font-semibold text-gray-600">Material</th>
              <th className="text-left p-3 font-semibold text-gray-600">Categoria</th>
              <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
              <th className="text-right p-3 font-semibold text-gray-600">Estoque</th>
              <th className="text-left p-3 font-semibold text-gray-600">Motivo</th>
              <th className="text-left p-3 font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedItems.map((m) => {
              const obra = obras.find((o) => o.id === m.obra_id);
              const motivo = motivoConfig[m.motivo_apontamento];
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">{m.nome}</td>
                  <td className="p-3 text-gray-600">{m.categoria ? (categoriaConfig[m.categoria] || m.categoria) : '—'}</td>
                  <td className="p-3 text-gray-600">{obra?.nome || <span className="text-gray-400">—</span>}</td>
                  <td className="p-3 text-right text-gray-600">{m.estoque_atual != null ? `${m.estoque_atual} ${m.unidade || ''}` : '—'}</td>
                  <td className="p-3">{motivo ? <Badge className={`border-0 ${motivo.color}`}>{motivo.label}</Badge> : <span className="text-gray-400">—</span>}</td>
                  <td className="p-3">{statusBadge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
      />
    </>
  );
}

export default function ApontamentosObrigatorios() {
  const [filtroObra, setFiltroObra] = useState('todos');

  const { data: materiais = [] } = useQuery({ queryKey: ['materiais'], queryFn: () => base44.entities.Material.list('-created_date', 500) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });
  const { data: apontamentos = [] } = useQuery({ queryKey: ['apontamentos-materiais'], queryFn: () => base44.entities.ApontamentoMateriaisSemanal.list('-created_date', 100) });

  const materiaisObrigatorios = useMemo(() => materiais.filter((m) => m.requer_apontamento_semanal), [materiais]);
  const materiaisObraSelecionada = useMemo(
    () => (filtroObra === 'todos' ? materiaisObrigatorios : materiaisObrigatorios.filter((m) => m.obra_id === filtroObra)),
    [materiaisObrigatorios, filtroObra]
  );

  // Apontamentos da semana atual
  const apontamentosSemana = useMemo(() => {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    inicioSemana.setHours(0, 0, 0, 0);
    return apontamentos.filter((apt) => {
      const d = new Date(apt.data_apontamento);
      return d >= inicioSemana && d <= hoje;
    });
  }, [apontamentos]);

  const materiaisApontados = useMemo(() => {
    const set = new Set();
    apontamentosSemana.forEach((apt) => (apt.materiais || []).forEach((m) => set.add(m.material_id)));
    return set;
  }, [apontamentosSemana]);

  const faltando = materiaisObraSelecionada.filter((m) => !materiaisApontados.has(m.id));
  const apontados = materiaisObraSelecionada.filter((m) => materiaisApontados.has(m.id));
  const pctConcluido = materiaisObraSelecionada.length > 0 ? Math.round((apontados.length / materiaisObraSelecionada.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Apontamentos Obrigatórios" subtitle="Materiais que exigem controle semanal" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm text-gray-500 mb-2">Materiais Obrigatórios</div><div className="text-2xl font-bold text-gray-900">{materiaisObraSelecionada.length}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm text-gray-500 mb-2">Apontados Esta Semana</div><div className="text-2xl font-bold text-emerald-600">{apontados.length}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm text-gray-500 mb-2">Faltando Apontar</div><div className="text-2xl font-bold text-red-600">{faltando.length}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm text-gray-500 mb-2">Concluído</div><div className="text-2xl font-bold text-amber-600">{pctConcluido}%</div></CardContent></Card>
      </div>

      {/* Filtro de obra */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="max-w-sm">
            <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
            <ComboboxBusca
              options={[{ value: 'todos', label: 'Todas as obras' }, ...obras.map((o) => ({ value: o.id, label: o.nome }))]}
              value={filtroObra}
              onSelect={(v) => setFiltroObra(v || 'todos')}
              placeholder="Todas as obras"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra."
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerta */}
      {faltando.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {faltando.length} material(is) ainda precisa(m) ser apontado(s) esta semana.
        </div>
      )}

      {/* Abas */}
      <Tabs defaultValue="faltando" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="faltando" className="gap-2"><Clock className="w-4 h-4" /> Faltando Apontar{faltando.length > 0 && <Badge className="ml-1 bg-red-600 text-white border-0">{faltando.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="apontados" className="gap-2"><CheckCircle2 className="w-4 h-4" /> Já Apontados{apontados.length > 0 && <Badge className="ml-1 bg-emerald-600 text-white border-0">{apontados.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="faltando">
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {faltando.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Tudo em dia</h3>
                  <p className="text-sm text-gray-500">{materiaisObraSelecionada.length === 0 ? 'Nenhum material exige apontamento semanal.' : 'Todos os apontamentos da semana foram realizados.'}</p>
                </div>
              ) : (
                <TabelaMateriais itens={faltando} obras={obras} statusBadge={<Badge className="bg-amber-100 text-amber-700 border-0">Aguardando</Badge>} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apontados">
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {apontados.length === 0 ? (
                <div className="p-12 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhum material apontado</h3>
                  <p className="text-sm text-gray-500">Ainda não houve apontamento de materiais obrigatórios nesta semana.</p>
                </div>
              ) : (
                <TabelaMateriais itens={apontados} obras={obras} statusBadge={<Badge className="bg-emerald-100 text-emerald-700 border-0">Apontado</Badge>} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
