import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConfiguracaoAlcadas from '../components/compras/ConfiguracaoAlcadas';
import ConfiguracaoWorkflows from '../components/compras/ConfiguracaoWorkflows';
import { Settings, GitBranch } from 'lucide-react';

export default function ConfiguracaoFluxoAprovacao() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuração de Fluxos de Aprovação</h1>
        <p className="text-gray-600 mt-1">
          Defina alçadas de aprovação e workflows para requisições de compra com múltiplos níveis
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Como funciona:</span> Configure alçadas (níveis com aprovadores específicos), 
          depois crie workflows que definem quais alçadas são necessárias baseado em critérios como valor da requisição.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="alcadas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="alcadas" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Alçadas</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alcadas" className="mt-6">
          <ConfiguracaoAlcadas />
        </TabsContent>

        <TabsContent value="workflows" className="mt-6">
          <ConfiguracaoWorkflows />
        </TabsContent>
      </Tabs>
    </div>
  );
}