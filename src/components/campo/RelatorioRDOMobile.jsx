import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Zap, AlertCircle, CloudSun } from 'lucide-react';

export default function RelatorioRDOMobile({ rdo }) {
  const totalMaoObra = rdo.mao_obra?.reduce((acc, m) => acc + (m.quantidade || 1), 0) || 0;
  const ocorrenciasCriticas = rdo.ocorrencias_detalhadas?.filter(o => o.gravidade === 'alta')?.length || 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
        <CardContent className="pt-6">
          <p className="text-sm font-medium opacity-90">RDO #{rdo.numero}</p>
          <p className="text-2xl font-bold">{new Date(rdo.data).toLocaleDateString('pt-BR')}</p>
          <Badge className="mt-2 bg-white/20">{rdo.status}</Badge>
        </CardContent>
      </Card>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-2 gap-2">
        {/* Clima */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-yellow-600" />
              <div className="text-sm">
                <p className="text-xs text-gray-600">Clima</p>
                <p className="font-semibold capitalize">{rdo.clima || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mão de Obra */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div className="text-sm">
                <p className="text-xs text-gray-600">Profissionais</p>
                <p className="font-semibold">{totalMaoObra}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipamentos */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-600" />
              <div className="text-sm">
                <p className="text-xs text-gray-600">Equipamentos</p>
                <p className="font-semibold">{rdo.equipamentos?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ocorrências */}
        <Card className={ocorrenciasCriticas > 0 ? 'bg-red-50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-5 h-5 ${ocorrenciasCriticas > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              <div className="text-sm">
                <p className="text-xs text-gray-600">Ocorrências</p>
                <p className={`font-semibold ${ocorrenciasCriticas > 0 ? 'text-red-600' : ''}`}>
                  {rdo.ocorrencias_detalhadas?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atividades */}
      {rdo.atividades && rdo.atividades.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atividades ({rdo.atividades.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {rdo.atividades.slice(0, 3).map((at, i) => (
              <div key={i} className="text-xs flex justify-between">
                <span className="text-gray-600 truncate">{at.descricao}</span>
                <Badge variant="outline" className="text-xs">{at.status}</Badge>
              </div>
            ))}
            {rdo.atividades.length > 3 && (
              <p className="text-xs text-gray-500 pt-1">+{rdo.atividades.length - 3} mais</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comentários */}
      {rdo.observacoes && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 mb-1">Observações</p>
            <p className="text-sm text-gray-800 line-clamp-2">{rdo.observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}