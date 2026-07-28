import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FileText, Award, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FolhaPagamentoForm from '../components/rh/FolhaPagamentoForm';
import PermissaoGuard from '../components/shared/PermissaoGuard';

export default function RecursosHumanos() {
  const [showFolha, setShowFolha] = useState(false);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const statusConfig = {
    'ativo': { label: 'Ativo', color: 'bg-green-100 text-green-800' },
    'inativo': { label: 'Inativo', color: 'bg-gray-100 text-gray-800' },
    'ferias': { label: 'Férias', color: 'bg-blue-100 text-blue-800' },
    'afastado': { label: 'Afastado', color: 'bg-orange-100 text-orange-800' },
    'desligado': { label: 'Desligado', color: 'bg-red-100 text-red-800' }
  };

  const ativos = colaboradores.filter(c => c.status === 'ativo').length;
  const totalFolha = colaboradores.filter(c => c.status === 'ativo').reduce((sum, c) => sum + (c.salario || 0), 0);
  const emFerias = colaboradores.filter(c => c.status === 'ferias').length;
  const afastados = colaboradores.filter(c => c.status === 'afastado').length;

  const departamentos = [...new Set(colaboradores.map(c => c.departamento))].filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recursos Humanos</h1>
          <p className="text-gray-600 mt-1">Gestão de Pessoas e Folha de Pagamento</p>
        </div>
        <PermissaoGuard acao="criar" modulo="rh">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowFolha(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Nova Folha
          </Button>
        </PermissaoGuard>
      </div>

      {showFolha && <FolhaPagamentoForm onClose={() => setShowFolha(false)} />}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Total</p>
            <p className="text-2xl font-bold">{colaboradores.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Ativos</p>
            <p className="text-2xl font-bold text-green-600">{ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Em Férias</p>
            <p className="text-2xl font-bold text-blue-600">{emFerias}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Afastados</p>
            <p className="text-2xl font-bold text-orange-600">{afastados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <DollarSign className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Folha Mensal</p>
            <p className="text-lg font-bold text-gray-700">R$ {totalFolha.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="colaboradores">
        <TabsList>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="contratos">Tipos de Contrato</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="space-y-3">
          {colaboradores.map(colab => {
            const config = statusConfig[colab.status];
            return (
              <Card key={colab.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold">{colab.nome}</h3>
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                        <div><p className="text-gray-500">Cargo</p><p className="font-semibold">{colab.cargo}</p></div>
                        <div><p className="text-gray-500">Departamento</p><p className="font-semibold">{colab.departamento || 'N/A'}</p></div>
                        <div><p className="text-gray-500">Salário</p><p className="font-semibold">R$ {(colab.salario || 0).toLocaleString('pt-BR')}</p></div>
                        <div><p className="text-gray-500">Contrato</p><p className="font-semibold uppercase text-xs">{colab.tipo_contrato}</p></div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Detalhes</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="departamentos" className="space-y-3">
          {departamentos.map(dept => {
            const deptColabs = colaboradores.filter(c => c.departamento === dept && c.status === 'ativo');
            const deptFolha = deptColabs.reduce((sum, c) => sum + (c.salario || 0), 0);
            return (
              <Card key={dept}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{dept}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                        <div><p className="text-gray-500">Colaboradores</p><p className="font-semibold">{deptColabs.length}</p></div>
                        <div><p className="text-gray-500">Folha</p><p className="font-semibold">R$ {deptFolha.toLocaleString('pt-BR')}</p></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="contratos" className="space-y-3">
          {['clt', 'pj', 'terceirizado', 'temporario'].map(tipo => {
            const tipoColabs = colaboradores.filter(c => c.tipo_contrato === tipo);
            return (
              <Card key={tipo}>
                <CardContent className="pt-6">
                  <div>
                    <h3 className="font-semibold uppercase text-sm">{tipo}</h3>
                    <p className="text-2xl font-bold mt-2">{tipoColabs.length} colaboradores</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}