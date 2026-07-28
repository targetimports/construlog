import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, 
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  Upload,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';

export default function Engenharia() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="ENGENHARIA_VIEW">
      <EngenhariContent />
    </RouteGuardFinalV2>
  );
}

function EngenhariContent() {
  const statusProjetoConfig = {
    em_elaboracao: { label: 'Em Elaboração', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    em_analise: { label: 'Em Análise', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    aprovado: { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    reprovado: { label: 'Reprovado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    revisao: { label: 'Revisão', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
  };

  const tipoNCConfig = {
    menor: { label: 'Menor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    maior: { label: 'Maior', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    critica: { label: 'Crítica', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [obraFilter, setObraFilter] = useState('todas');

  const { data: projetos = [], isLoading: loadingProjetos } = useQuery({
    queryKey: ['projetos-tecnicos'],
    queryFn: () => base44.entities.ProjetoTecnico.list('-created_date', 100)
  });

  const { data: checklists = [], isLoading: loadingChecklists } = useQuery({
    queryKey: ['checklists-qualidade'],
    queryFn: () => base44.entities.ChecklistQualidade.list('-created_date', 100)
  });

  const { data: naoConformidades = [], isLoading: loadingNCs } = useQuery({
    queryKey: ['nao-conformidades'],
    queryFn: () => base44.entities.NaoConformidade.list('-created_date', 100)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Stats
  const projetosAprovados = projetos.filter(p => p.status === 'aprovado').length;
  const checklistsPendentes = checklists.filter(c => ['pendente', 'em_andamento'].includes(c.status)).length;
  const ncsAbertas = naoConformidades.filter(nc => ['aberta', 'em_correcao'].includes(nc.status)).length;
  const ncsCriticas = naoConformidades.filter(nc => nc.tipo === 'critica' && nc.status !== 'fechada').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engenharia & Qualidade"
        subtitle="Projetos técnicos, checklists e controle de qualidade"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Projetos Aprovados"
          value={projetosAprovados}
          subtitle={`${projetos.length} total`}
          icon={FileText}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Checklists Pendentes"
          value={checklistsPendentes}
          subtitle={`${checklists.length} total`}
          icon={CheckCircle}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="NCs Abertas"
          value={ncsAbertas}
          subtitle={`${naoConformidades.length} total`}
          icon={AlertTriangle}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
        />
        <StatCard
          title="NCs Críticas"
          value={ncsCriticas}
          subtitle="Atenção imediata"
          icon={AlertTriangle}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projetos" className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
          <TabsTrigger value="projetos">Projetos Técnicos</TabsTrigger>
          <TabsTrigger value="checklists">Checklists de Qualidade</TabsTrigger>
          <TabsTrigger value="naoconformidades">Não Conformidades</TabsTrigger>
        </TabsList>

        {/* Projetos Tab */}
        <TabsContent value="projetos" className="mt-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2 flex-1 max-w-md">
              <Input
                placeholder="Buscar projetos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <Link to={createPageUrl('ProjetoTecnicoForm')}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Projeto
              </Button>
            </Link>
          </div>

          {loadingProjetos ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : projetos.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum projeto técnico criado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projetos.map(projeto => (
                <Link key={projeto.id} to={createPageUrl(`ProjetoTecnicoDetalhes?id=${projeto.id}`)}>
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{projeto.titulo}</h3>
                        <p className="text-sm text-gray-600 mt-1">{projeto.descricao}</p>
                      </div>
                      <Badge 
                        className={cn(
                          'px-3 py-1 text-xs font-medium',
                          statusProjetoConfig[projeto.status]?.color || 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {statusProjetoConfig[projeto.status]?.label || projeto.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Checklists Tab */}
        <TabsContent value="checklists" className="mt-6">
          <div className="flex justify-end mb-6">
            <Link to={createPageUrl('ChecklistQualidadeForm')}>
              <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900">
                <Plus className="w-4 h-4 mr-2" />
                Novo Checklist
              </Button>
            </Link>
          </div>

          {loadingChecklists ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : checklists.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum checklist criado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {checklists.map(checklist => (
                <Link key={checklist.id} to={createPageUrl(`ChecklistQualidadeDetalhes?id=${checklist.id}`)}>
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-amber-500 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{checklist.titulo}</h3>
                        <p className="text-sm text-gray-600 mt-1">Obra: {obras.find(o => o.id === checklist.obra_id)?.nome || 'N/A'}</p>
                      </div>
                      <Badge 
                        className={cn(
                          'px-3 py-1 text-xs font-medium',
                          checklist.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-700' : 
                          checklist.status === 'em_andamento' ? 'bg-amber-500/10 text-amber-700' : 
                          'bg-gray-100 text-gray-700'
                        )}
                      >
                        {checklist.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Não Conformidades Tab */}
        <TabsContent value="naoconformidades" className="mt-6">
          <div className="flex justify-end mb-6">
            <Link to={createPageUrl('NaoConformidadeForm')}>
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Nova NC
              </Button>
            </Link>
          </div>

          {loadingNCs ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : naoConformidades.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma não-conformidade registrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {naoConformidades.map(nc => (
                <Link key={nc.id} to={createPageUrl(`NaoConformidadeDetalhes?id=${nc.id}`)}>
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-red-500 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{nc.titulo}</h3>
                        <p className="text-sm text-gray-600 mt-1">{nc.descricao}</p>
                      </div>
                      <Badge 
                        className={cn(
                          'px-3 py-1 text-xs font-medium',
                          tipoNCConfig[nc.tipo]?.color || 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {tipoNCConfig[nc.tipo]?.label || nc.tipo}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}