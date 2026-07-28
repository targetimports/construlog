import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit2, AlertTriangle, Calendar, MapPin, User, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function AcidenteDetalhes() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Obter ID da URL
  const acidenteId = new URLSearchParams(window.location.search).get('id');

  // Buscar acidente
  const { data: acidente, isLoading, error } = useQuery({
    queryKey: ['acidente', acidenteId],
    queryFn: () => acidenteId ? base44.entities.AcidenteTrabalho.filter({ id: acidenteId }) : Promise.resolve([]),
    enabled: !!acidenteId,
    staleTime: 2 * 60 * 1000
  });

  const acidentoData = acidente?.[0];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageSkeleton kpis={2} rows={6} cols={4} />
      </div>
    );
  }

  if (!acidentoData) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600 font-semibold">Acidente não encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const severidadeConfig = {
    leve: { label: 'Leve', color: 'bg-yellow-100 text-yellow-800' },
    moderada: { label: 'Moderada', color: 'bg-orange-100 text-orange-800' },
    grave: { label: 'Grave', color: 'bg-red-100 text-red-800' },
    fatal: { label: 'Fatal', color: 'bg-red-200 text-red-900' }
  };

  const config = severidadeConfig[acidentoData.severidade] || severidadeConfig.leve;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="page-title">Detalhes do Acidente</h1>
            <p className="page-subtitle">Informações e análise do incidente</p>
          </div>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant="outline"
          className="gap-2"
        >
          <Edit2 className="w-4 h-4" /> Editar
        </Button>
      </div>

      {/* Informações Principais */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Informações do Acidente
            </CardTitle>
            <span className={`px-3 py-1 rounded text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Data e Local */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Calendar className="w-4 h-4" />
                Data do Acidente
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {acidentoData.data_acidente 
                  ? new Date(acidentoData.data_acidente).toLocaleDateString('pt-BR')
                  : '-'
                }
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4" />
                Local
              </div>
              <p className="text-lg font-semibold text-gray-900">{acidentoData.local || '-'}</p>
            </div>
          </div>

          {/* Colaborador Envolvido */}
          {acidentoData.colaborador_id && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <User className="w-4 h-4" />
                Colaborador Envolvido
              </div>
              <p className="text-lg font-semibold text-gray-900">{acidentoData.colaborador_nome || '-'}</p>
              {acidentoData.colaborador_cargo && (
                <p className="text-sm text-gray-600">{acidentoData.colaborador_cargo}</p>
              )}
            </div>
          )}

          {/* Descrição */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <FileText className="w-4 h-4" />
              Descrição
            </div>
            <p className="text-gray-700 leading-relaxed">
              {acidentoData.descricao || 'Sem descrição'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Classificação e Consequências */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Classificação e Consequências</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tipo</p>
              <p className="font-semibold text-gray-900">{acidentoData.tipo || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Severidade</p>
              <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
            </div>
          </div>

          {acidentoData.afastamento && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Afastamento Necessário</p>
              <p className="font-semibold text-gray-900">
                {acidentoData.dias_afastamento ? `${acidentoData.dias_afastamento} dias` : 'Sim'}
              </p>
            </div>
          )}

          {acidentoData.consequencias && (
            <div className="col-span-full">
              <p className="text-sm text-gray-600 mb-2">Consequências</p>
              <p className="text-gray-700">{acidentoData.consequencias}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investigação e Medidas */}
      {(acidentoData.causa_raiz || acidentoData.medidas_preventivas) && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Investigação e Medidas Preventivas</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {acidentoData.causa_raiz && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Causa Raiz</p>
                <p className="text-gray-700">{acidentoData.causa_raiz}</p>
              </div>
            )}
            {acidentoData.medidas_preventivas && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Medidas Preventivas</p>
                <p className="text-gray-700">{acidentoData.medidas_preventivas}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações de Auditoria */}
      <Card className="bg-gray-50">
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Informações de Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 text-xs text-gray-600 space-y-2">
          <div>Criado em: {new Date(acidentoData.created_date).toLocaleString('pt-BR')}</div>
          <div>Última atualização: {new Date(acidentoData.updated_date).toLocaleString('pt-BR')}</div>
          {acidentoData.created_by && <div>Criado por: {acidentoData.created_by}</div>}
        </CardContent>
      </Card>
    </div>
  );
}