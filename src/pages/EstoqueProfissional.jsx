import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Warehouse, Package, ArrowRightLeft, BarChart3, ClipboardList,
  Loader2
} from 'lucide-react';
import RequireRole from '../components/auth/RequireRole';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';

// Lazy load tabs
const EstoqueKPIsAvancados = React.lazy(() => import('../components/estoque/EstoqueKPIsAvancados'));
const EstoqueMateriais = React.lazy(() => import('../components/estoque/EstoqueMateriais'));
const EstoqueRequisicoes = React.lazy(() => import('../components/estoque/EstoqueRequisicoes'));
const EstoqueGraficosAvancados = React.lazy(() => import('../components/estoque/EstoqueGraficosAvancados'));

// Lazy load existing pages
const DashboardEstoqueProfissional = React.lazy(() => import('../components/estoque/DashboardEstoqueProfissional'));

const Suspense = ({ children }) => (
  <React.Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}>
    {children}
  </React.Suspense>
);

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Atalhos do topo: abrem a própria tela dentro de um modal (emModal esconde o
// header duplicado da página); as rotas seguem existindo normalmente.
const TransferenciaEstoqueObra = React.lazy(() => import('./TransferenciaEstoqueObra'));
const Almoxarifados = React.lazy(() => import('./Almoxarifados'));

function ModalTela({ open, onClose, titulo, children }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {open && <Suspense>{children}</Suspense>}
      </DialogContent>
    </Dialog>
  );
}

function EstoqueProfissionalContent() {
  const [telaModal, setTelaModal] = useState(null); // 'transferir' | 'movimentacoes' | 'almoxarifados'
  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const raw = p.get('tab') || 'materiais';
    // Deep-links antigos (dashboard/alertas/graficos) caem na aba consolidada Análises.
    const MAP = { dashboard: 'analises', alertas: 'analises', graficos: 'analises' };
    return MAP[raw] || raw;
  });

  // Dados compartilhados entre abas
  const { data: locais = [], isLoading: loadLoc } = useQuery({
    queryKey: ['local-estoque'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
    staleTime: 60000
  });

  const { data: saldos = [], isLoading: loadSaldos } = useQuery({
    queryKey: ['saldos-estoque-dash'],
    queryFn: () => base44.entities.SaldoEstoque.list('-updated_date', 5000),
    staleTime: 30000
  });

  const isLoading = loadLoc || loadSaldos;

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Central + Obras — Disponível, Reservado, Em Trânsito</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 h-9" onClick={() => setTelaModal('transferir')}>
            <ArrowRightLeft className="w-4 h-4" />
            Transferir p/ Obra
          </Button>
          <Button variant="outline" className="gap-2 h-9" onClick={() => setTelaModal('almoxarifados')}>
            <Warehouse className="w-4 h-4" />
            Almoxarifados
          </Button>
        </div>
      </div>

      {/* KPIs — sempre visíveis */}
      {isLoading ? (
        <KpiCardsSkeleton count={4} />
      ) : (
        <Suspense>
          <EstoqueKPIsAvancados saldos={saldos} locais={locais} />
        </Suspense>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full overflow-x-auto justify-start bg-gray-100/80 h-auto gap-1 p-1">
          <TabsTrigger value="materiais" className="gap-1.5 text-xs shrink-0 whitespace-nowrap">
            <Package className="w-3.5 h-3.5" />Materiais
          </TabsTrigger>
          <TabsTrigger value="requisicoes" className="gap-1.5 text-xs shrink-0 whitespace-nowrap">
            <ClipboardList className="w-3.5 h-3.5" />Requisições
          </TabsTrigger>
          <TabsTrigger value="analises" className="gap-1.5 text-xs shrink-0 whitespace-nowrap">
            <BarChart3 className="w-3.5 h-3.5" />Análises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materiais" className="mt-4">
          {!isLoading && (
            <Suspense>
              <EstoqueMateriais saldos={saldos} locais={locais} />
            </Suspense>
          )}
        </TabsContent>

        <TabsContent value="requisicoes" className="mt-4">
          <Suspense>
            <EstoqueRequisicoes />
          </Suspense>
        </TabsContent>

        <TabsContent value="analises" className="mt-4">
          <div className="space-y-6">
            <Suspense>
              <DashboardEstoqueProfissional />
            </Suspense>
            {!isLoading && (
              <Suspense>
                <EstoqueGraficosAvancados saldos={saldos} locais={locais} />
              </Suspense>
            )}
          </div>
        </TabsContent>

      </Tabs>

      <ModalTela open={telaModal === 'transferir'} onClose={() => setTelaModal(null)} titulo="Distribuição de Estoque">
        <TransferenciaEstoqueObra emModal />
      </ModalTela>
      <ModalTela open={telaModal === 'almoxarifados'} onClose={() => setTelaModal(null)} titulo="Almoxarifados">
        <Almoxarifados emModal />
      </ModalTela>

    </div>
  );
}

export default function EstoqueProfissional() {
  return (
    <RequireRole allowedRoles={['admin', 'programador', 'admin_empresa', 'diretor', 'almoxarife', 'compras']}>
      <EstoqueProfissionalContent />
    </RequireRole>
  );
}