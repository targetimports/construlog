import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import KPIDashboard from '../obra/KPIDashboard';
import DashboardObraIntegrado from '../obra/DashboardObraIntegrado';
import MarcosTimeline from '../obra/MarcosTimeline';
import AnexosSection from '../obra/AnexosSection';
import PainelDocumentosObra from '../documentos/PainelDocumentosObra';
import DiagnosticoImportacao from '../obra/DiagnosticoImportacao';
import DiagnosticoObra from '../obra/DiagnosticoObra';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { ClipboardList, Users, Camera } from 'lucide-react';

export default function WorkspacePainel({ obra, obraId, contas, user }) {
  const { data: marcos = [] } = useQuery({
    queryKey: ['marcos-obra', obraId],
    queryFn: () => base44.entities.MarcoObra.filter({ obra_id: obraId }, 'data_prevista'),
    enabled: !!obraId,
  });
  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-obra', obraId],
    queryFn: () => base44.entities.DiarioObra.filter({ obra_id: obraId }, '-data', 10),
    enabled: !!obraId,
  });
  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos-obra', obraId],
    queryFn: () => base44.entities.AnexoObra.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId,
  });

  return (
    <div className="space-y-6">
      <KPIDashboard obra={obra} contas={contas || []} />

      <DashboardObraIntegrado obra_id={obraId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarcosTimeline marcos={marcos} obraId={obraId} />

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              Últimas Atividades
            </CardTitle>
            <Link to={createPageUrl('DiarioObra')}>
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-400">
                Ver Todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {diarios.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum registro no diário</p>
            ) : (
              <div className="space-y-3">
                {diarios.slice(0, 4).map(diario => (
                  <div key={diario.id} className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-gray-400 text-xs">
                        {new Date(diario.data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </p>
                      <div className="flex gap-2">
                        {diario.qtd_funcionarios && (
                          <Badge variant="outline" className="border-gray-700 text-gray-400 text-xs">
                            <Users className="w-3 h-3 mr-1" />{diario.qtd_funcionarios}
                          </Badge>
                        )}
                        {diario.fotos?.length > 0 && (
                          <Badge variant="outline" className="border-amber-700 text-amber-400 text-xs">
                            <Camera className="w-3 h-3 mr-1" />{diario.fotos.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-white text-sm line-clamp-2">{diario.atividades_realizadas}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PainelDocumentosObra obraId={obraId} />
      <AnexosSection anexos={anexos} obraId={obraId} />
      {user?.role === 'admin' && <DiagnosticoImportacao obraId={obraId} />}
      <DiagnosticoObra obraId={obraId} user={user} />
    </div>
  );
}