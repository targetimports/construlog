import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ClipboardList,
  AlertTriangle,
  Camera,
  Users,
  Building2,
  Calendar,
  Cloud,
  Sun,
  CloudRain,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';

const climaConfig = {
  ensolarado: { icon: Sun, color: 'text-amber-400' },
  nublado: { icon: Cloud, color: 'text-gray-400' },
  chuvoso: { icon: CloudRain, color: 'text-blue-400' },
  tempestade: { icon: CloudRain, color: 'text-red-400' }
};

export default function ExecutionDashboard() {
  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-obra'],
    queryFn: () => base44.entities.DiarioObra.list('-data', 50)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const obrasAtivas = obras.filter(o => o.status === 'em_andamento');
  
  // Últimas atividades (últimos 7 dias)
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const ultimasAtividades = diarios.filter(d => 
    new Date(d.data) >= seteDiasAtras
  ).slice(0, 10);

  // Ocorrências em aberto (últimos 30 dias com ocorrências)
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const ocorrencias = diarios.filter(d => 
    d.ocorrencias && 
    d.ocorrencias.trim() !== '' &&
    new Date(d.data) >= trintaDiasAtras
  );

  // Fotos recentes
  const fotosRecentes = diarios
    .filter(d => d.fotos && d.fotos.length > 0)
    .slice(0, 12)
    .flatMap(d => 
      (d.fotos || []).slice(0, 3).map(foto => ({
        foto,
        obra_id: d.obra_id,
        data: d.data
      }))
    )
    .slice(0, 12);

  const totalFuncionarios = diarios
    .slice(0, 7)
    .reduce((acc, d) => acc + (d.qtd_funcionarios || 0), 0);

  const getObra = (id) => obras.find(o => o.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de Execução"
        subtitle="Visão geral de todas as obras em andamento"
        actionIcon={ClipboardList}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Obras em Andamento"
          value={obrasAtivas.length}
          icon={Building2}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Registros (7 dias)"
          value={ultimasAtividades.length}
          icon={ClipboardList}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Ocorrências Recentes"
          value={ocorrencias.length}
          icon={AlertTriangle}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Funcionários Ativos"
          value={totalFuncionarios}
          icon={Users}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas Atividades */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                Últimas Atividades Registradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ultimasAtividades.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma atividade recente</p>
              ) : (
                <div className="space-y-3">
                  {ultimasAtividades.map(diario => {
                    const obra = getObra(diario.obra_id);
                    const clima = climaConfig[diario.clima];
                    const ClimaIcon = clima?.icon;

                    return (
                      <div 
                         key={diario.id}
                         className="p-4 bg-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                       >
                         <div className="flex items-start justify-between mb-2">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                               <p className="text-gray-900 font-medium">{obra?.nome}</p>
                              {ClimaIcon && (
                                <ClimaIcon className={cn("w-3 h-3", clima.color)} />
                              )}
                            </div>
                            <p className="text-gray-600 text-sm line-clamp-2">
                              {diario.atividades_realizadas}
                            </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-3">
                            <span className="text-gray-500 text-xs">
                              {new Date(diario.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                            {diario.qtd_funcionarios && (
                               <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs">
                                 <Users className="w-3 h-3 mr-1" />
                                 {diario.qtd_funcionarios}
                               </Badge>
                             )}
                          </div>
                        </div>
                        {diario.fotos && diario.fotos.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {diario.fotos.slice(0, 3).map((foto, idx) => (
                              <img 
                                key={idx}
                                src={foto}
                                alt="Foto"
                                className="w-12 h-12 object-cover rounded border border-gray-300"
                              />
                            ))}
                            {diario.fotos.length > 3 && (
                              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-600 text-xs">
                                +{diario.fotos.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Geral de Execução */}
        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Status de Execução
              </CardTitle>
            </CardHeader>
            <CardContent>
              {obrasAtivas.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma obra em andamento</p>
              ) : (
                <div className="space-y-4">
                  {obrasAtivas.slice(0, 5).map(obra => (
                    <Link 
                      key={obra.id}
                      to={createPageUrl(`ObraDetalhes?id=${obra.id}`)}
                      className="block"
                    >
                      <div className="p-3 bg-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-gray-900 font-medium text-sm">{obra.nome}</p>
                          <span className="text-emerald-600 text-sm font-bold">
                            {obra.percentual_concluido || 0}%
                          </span>
                        </div>
                        <Progress 
                          value={obra.percentual_concluido || 0} 
                          className="h-2"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ocorrências */}
          {ocorrencias.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Ocorrências Recentes
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 ml-2">
                    {ocorrencias.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ocorrencias.slice(0, 5).map(diario => {
                    const obra = getObra(diario.obra_id);
                    return (
                      <div 
                        key={diario.id}
                        className="p-3 bg-amber-50 border border-amber-200 rounded-xl"
                      >
                        <p className="text-gray-900 text-sm font-medium mb-1">{obra?.nome}</p>
                        <p className="text-gray-600 text-xs line-clamp-2">{diario.ocorrencias}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          {new Date(diario.data).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Galeria de Fotos Recentes */}
      {fotosRecentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-pink-500" />
              Fotos Recentes das Obras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {fotosRecentes.map((item, idx) => {
                const obra = getObra(item.obra_id);
                return (
                  <div key={idx} className="group relative">
                    <img
                       src={item.foto}
                       alt="Foto da obra"
                       className="w-full h-32 object-cover rounded-lg border border-gray-300 group-hover:border-amber-500 transition-colors"
                     />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center p-2">
                       <p className="text-white text-xs font-medium text-center line-clamp-2">
                         {obra?.nome}
                       </p>
                       <p className="text-gray-200 text-xs mt-1">
                        {new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}