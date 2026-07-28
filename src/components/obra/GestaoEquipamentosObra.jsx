import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EquipamentosUtilizados from './EquipamentosUtilizados';
import SolicitarEquipamento from './SolicitarEquipamento';
import HistoricoEquipamento from './HistoricoEquipamento';

export default function GestaoEquipamentosObra({ obraId }) {
  const [tab, setTab] = useState('utilizados');

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
        <TabsTrigger value="utilizados">Equipamentos Utilizados</TabsTrigger>
        <TabsTrigger value="solicitar">Solicitar Equipamento</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="utilizados" className="mt-4">
        <EquipamentosUtilizados obraId={obraId} />
      </TabsContent>

      <TabsContent value="solicitar" className="mt-4">
        <SolicitarEquipamento 
          obraId={obraId} 
          onBack={() => setTab('historico')}
        />
      </TabsContent>

      <TabsContent value="historico" className="mt-4">
        <HistoricoEquipamento obraId={obraId} />
      </TabsContent>
    </Tabs>
  );
}