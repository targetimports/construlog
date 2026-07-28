import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Package, Warehouse, Truck } from 'lucide-react';
import MateriaisObraKPIs from './MateriaisObraKPIs';
import MateriaisPlanejadoTab from './MateriaisPlanejadoTab';
import MateriaisSolicitacoesTab from './MateriaisSolicitacoesTab';
import MateriaisEstoqueObraTab from './MateriaisEstoqueObraTab';
import ReceberMaterialTab from './ReceberMaterialTab';

export default function MateriaisObraSection({ obraId, podeEditar = false }) {
  // Contador de material a receber — vira o badge na aba, para o responsável saber
  // que tem coisa esperando conferência sem precisar abrir.
  const { data: aReceber = 0 } = useQuery({
    queryKey: ['requisicoes-em-transito-count', obraId],
    queryFn: async () => {
      const reqs = await base44.entities.RequisicaoObra.filter({ obra_id: obraId, status: 'EM_TRANSITO' }).catch(() => []);
      return (reqs || []).length;
    },
    enabled: !!obraId,
  });
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <MateriaisObraKPIs obraId={obraId} />

      {/* Abas */}
      <Tabs defaultValue="planejado">
        {/* Mobile: barra rolável horizontal (abas com largura natural); desktop: abas esticadas. */}
        <TabsList className="bg-gray-50 border border-gray-200 w-full overflow-x-auto justify-start md:justify-center">
          <TabsTrigger value="planejado" className="flex-none md:flex-1 gap-2 whitespace-nowrap data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-400">
            <Package className="w-4 h-4" />
            Planejado
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="flex-none md:flex-1 gap-2 whitespace-nowrap data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-400">
            <ClipboardList className="w-4 h-4" />
            Requisições
          </TabsTrigger>
          <TabsTrigger value="receber" className="flex-none md:flex-1 gap-2 whitespace-nowrap data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-400">
            <Truck className="w-4 h-4" />
            Receber
            {aReceber > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                {aReceber}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="estoque" className="flex-none md:flex-1 gap-2 whitespace-nowrap data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-400">
            <Warehouse className="w-4 h-4" />
            Estoque da Obra
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planejado" className="mt-4">
          <MateriaisPlanejadoTab obraId={obraId} />
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <MateriaisSolicitacoesTab obraId={obraId} podeEditar={podeEditar} />
        </TabsContent>

        <TabsContent value="receber" className="mt-4">
          <ReceberMaterialTab obraId={obraId} podeEditar={podeEditar} />
        </TabsContent>

        <TabsContent value="estoque" className="mt-4">
          <MateriaisEstoqueObraTab obraId={obraId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}