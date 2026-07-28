import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Building2, Users, Shield, Grid3x3, FileText, History, Lock, Zap, Clock, Database, Bell } from 'lucide-react';
import RequireRole from '../components/auth/RequireRole';

// Importar páginas existentes como componentes
import ConfiguracoesSistema from './ConfiguracoesSistema';
import Empresas from './Empresas';
import CategoriasConfig from './CategoriasConfig';
import Governanca from './Governanca';
import ControleAcessoObras from './ControleAcessoObras';
import Workflows from './Workflows';
import ExpedientePorObra from './ExpedientePorObra';
import Auditoria from './Auditoria';
import PerfisAcesso from './PerfisAcesso';
import ConfiguracaoMenu from './ConfiguracaoMenu';
import AjustesAdministracaoDados from './AjustesAdministracaoDados';
import ConfiguracaoNotificacoes from '../components/ajustes/ConfiguracaoNotificacoes';

function AjustesContent() {
  const [activeTab, setActiveTab] = useState('sistema');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Apenas perfil TI (programador) tem acesso completo
  const isTI = user?.cargo === 'programador' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ajustes do Sistema</h1>
        <p className="text-gray-600 mt-1">Configurações, permissões e parâmetros centralizados</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid ${isTI ? 'grid-cols-5 lg:grid-cols-12' : 'grid-cols-5 lg:grid-cols-8'} w-full`}>
          <TabsTrigger value="sistema" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Sistema</span>
          </TabsTrigger>
          <TabsTrigger value="empresas" className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresas</span>
          </TabsTrigger>
          {isTI && (
            <TabsTrigger value="perfis" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Perfis</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="alcadas" className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Alçadas</span>
          </TabsTrigger>
          {isTI && (
            <TabsTrigger value="acesso-obras" className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Acesso</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="categorias" className="flex items-center gap-1">
            <Grid3x3 className="h-4 w-4" />
            <span className="hidden sm:inline">Categorias</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
          <TabsTrigger value="expedientes" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Expedientes</span>
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Menu</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          {isTI && (
            <TabsTrigger value="admin-dados" className="flex items-center gap-1 border-l-2 border-red-300">
              <Database className="h-4 w-4 text-red-600" />
              <span className="hidden sm:inline text-red-600">Admin Dados</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sistema" className="mt-6">
          <ConfiguracoesSistema />
        </TabsContent>

        <TabsContent value="empresas" className="mt-6">
          <Empresas />
        </TabsContent>

        {isTI && (
          <TabsContent value="perfis" className="mt-6">
            <PerfisAcesso />
          </TabsContent>
        )}

        <TabsContent value="alcadas" className="mt-6">
          <Governanca />
        </TabsContent>

        {isTI && (
          <TabsContent value="acesso-obras" className="mt-6">
            <ControleAcessoObras />
          </TabsContent>
        )}

        <TabsContent value="categorias" className="mt-6">
          <CategoriasConfig />
        </TabsContent>

        <TabsContent value="workflows" className="mt-6">
          <Workflows />
        </TabsContent>

        <TabsContent value="expedientes" className="mt-6">
          <ExpedientePorObra />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <ConfiguracaoMenu />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-6">
          <Auditoria />
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-6">
          <ConfiguracaoNotificacoes />
        </TabsContent>

        {isTI && (
          <TabsContent value="admin-dados" className="mt-6">
            <AjustesAdministracaoDados />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function Ajustes() {
  return (
    <RequireRole allowedRoles={['admin', 'programador']}>
      <AjustesContent />
    </RequireRole>
  );
}