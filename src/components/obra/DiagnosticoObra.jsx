import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Package, ShoppingCart, CreditCard, Users, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DiagnosticoObra({ obraId, user }) {
  // Só mostrar para admins
  if (user?.role !== 'admin') return null;

  const { data: demandas = [] } = useQuery({
    queryKey: ['demandas-diagnostico', obraId],
    queryFn: () => base44.entities.DemandaEstoqueObra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-diagnostico', obraId],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens-diagnostico', obraId],
    queryFn: () => base44.entities.OrdemCompra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const { data: recebimentos = [] } = useQuery({
    queryKey: ['recebimentos-diagnostico', obraId],
    queryFn: async () => {
      const ordensIds = ordens.map((o) => o.id);
      if (ordensIds.length === 0) return [];
      const todos = await base44.entities.RecebimentoMaterial.list('-created_date', 1000);
      return todos.filter((r) => ordensIds.includes(r.ordem_compra_id));
    },
    enabled: !!obraId && ordens.length > 0
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-diagnostico', obraId],
    queryFn: () => base44.entities.ContaFinanceira.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const metricas = [
  { label: 'Demandas Planejadas', valor: demandas.length, icon: Package, cor: 'blue' },
  { label: 'Requisições Criadas', valor: requisicoes.length, icon: ShoppingCart, cor: 'amber' },
  { label: 'Ordens Emitidas', valor: ordens.length, icon: FileText, cor: 'purple' },
  { label: 'Recebimentos', valor: recebimentos.length, icon: CheckCircle2, cor: 'green' },
  { label: 'Contas Financeiras', valor: contas.length, icon: CreditCard, cor: 'red' }];


  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="bg-gray-500 p-6 flex flex-col space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          Diagnóstico da Obra (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-gray-500 text-zinc-950 pt-0 p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {metricas.map((metrica, idx) => {
            const Icon = metrica.icon;
            const temDados = metrica.valor > 0;
            const colorMap = {
              blue: 'border-blue-200 bg-blue-50',
              amber: 'border-amber-200 bg-amber-50',
              purple: 'border-purple-200 bg-purple-50',
              green: 'border-emerald-200 bg-emerald-50',
              red: 'border-red-200 bg-red-50'
            };

            return (
              <div key={idx} className={cn('p-3 rounded-lg border', colorMap[metrica.cor])}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3 h-3" />
                  <p className="text-xs font-semibold text-gray-600">{metrica.label}</p>
                </div>
                <p className="text-zinc-950 text-lg font-bold">
                  {metrica.valor}
                </p>
              </div>);

          })}
        </div>
        <p className="text-neutral-950 mt-3 text-xs">Use este diagnóstico para verificar se os dados estão sendo salvos corretamente (deve aparecer > 0 após importação).

        </p>
      </CardContent>
    </Card>);

}