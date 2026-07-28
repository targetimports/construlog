import React, { useEffect, useState } from 'react';
import { Send, Eye, CheckCircle2, XCircle, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function RastreamentoProposta({ propostaId }) {
  const { data: versoes = [] } = useQuery({
    queryKey: ['versoes-proposta', propostaId],
    queryFn: () => base44.entities.VersaoProposta.filter({
      proposta_id: propostaId
    }, '-numero_versao')
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'enviada':
        return <Send className="w-5 h-5 text-blue-600" />;
      case 'visualizada':
        return <Eye className="w-5 h-5 text-purple-600" />;
      case 'aceita':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'recusada':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'nao_enviada':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <MessageSquare className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'nao_enviada': 'bg-gray-100 text-gray-800',
      'enviada': 'bg-blue-100 text-blue-800',
      'visualizada': 'bg-purple-100 text-purple-800',
      'aceita': 'bg-green-100 text-green-800',
      'recusada': 'bg-red-100 text-red-800',
      'expirada': 'bg-orange-100 text-orange-800'
    };

    const labels = {
      'nao_enviada': 'Não enviada',
      'enviada': 'Enviada',
      'visualizada': 'Visualizada',
      'aceita': 'Aceita',
      'recusada': 'Recusada',
      'expirada': 'Expirada'
    };

    return (
      <Badge className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const versaoAtiva = versoes.find(v => v.ativa);

  return (
    <div className="space-y-6">
      {/* Status Atual */}
      {versaoAtiva && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Status Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(versaoAtiva.status_cliente)}
                <div>
                  <p className="font-medium text-gray-900">
                    Versão {versaoAtiva.numero_versao}
                  </p>
                  <p className="text-xs text-gray-600">
                    Para: {versaoAtiva.cliente_email || 'Não atribuído'}
                  </p>
                </div>
              </div>
              {getStatusBadge(versaoAtiva.status_cliente)}
            </div>

            {/* Timeline do Status */}
            <div className="mt-4 space-y-2 text-sm">
              {versaoAtiva.data_envio && (
                <p className="text-gray-600">
                  ✓ Enviada em {new Date(versaoAtiva.data_envio).toLocaleDateString('pt-BR')}
                </p>
              )}
              {versaoAtiva.data_visualizacao && (
                <p className="text-gray-600">
                  Visualizada em {new Date(versaoAtiva.data_visualizacao).toLocaleDateString('pt-BR')}
                </p>
              )}
              {versaoAtiva.data_resposta && (
                <p className={cn(
                  versaoAtiva.status_cliente === 'aceita' ? 'text-green-600' : 'text-red-600'
                )}>
                  {versaoAtiva.status_cliente === 'aceita' ? '✓' : '✗'} 
                  {' '}Resposta em {new Date(versaoAtiva.data_resposta).toLocaleDateString('pt-BR')}
                </p>
              )}
              {versaoAtiva.motivo_recusa && (
                <p className="text-red-600 text-xs">
                  Motivo: {versaoAtiva.motivo_recusa}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Versões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de Versões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {versoes.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma versão criada ainda</p>
            ) : (
              versoes.map((versao, idx) => (
                <div
                  key={versao.id}
                  className={cn(
                    'border-l-4 p-3 rounded',
                    versao.ativa ? 'border-l-blue-500 bg-blue-50' : 'border-l-gray-300 bg-gray-50'
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded">
                        v{versao.numero_versao}
                      </span>
                      {versao.ativa && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          Ativa
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(versao.status_cliente)}
                      {getStatusBadge(versao.status_cliente)}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mb-2">
                    {new Date(versao.data_criacao).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(versao.data_criacao).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>

                  <p className="text-sm text-gray-700 mb-2">
                    {versao.descricao_alteracao}
                  </p>

                  <div className="text-xs bg-white rounded p-2 space-y-1">
                    <p>
                      <strong>Valor:</strong> R${' '}
                      {versao.dados_proposta_snapshot.valor_final.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2
                      })}
                    </p>
                    {versao.cliente_email && (
                      <p>
                        <strong>Cliente:</strong> {versao.cliente_email}
                      </p>
                    )}
                    {versao.criado_por && (
                      <p>
                        <strong>Criado por:</strong> {versao.criado_por}
                      </p>
                    )}
                  </div>

                  {versao.motivo_recusa && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                      <strong>Motivo da recusa:</strong> {versao.motivo_recusa}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informações de Envio */}
      {versaoAtiva && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Informações de Envio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{versaoAtiva.cliente_email || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium">{versaoAtiva.status_cliente}</span>
            </div>
            {versaoAtiva.data_envio && (
              <div className="flex justify-between">
                <span className="text-gray-600">Enviada em:</span>
                <span className="font-medium">
                  {new Date(versaoAtiva.data_envio).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
            {versaoAtiva.data_visualizacao && (
              <div className="flex justify-between">
                <span className="text-gray-600">Visualizada em:</span>
                <span className="font-medium">
                  {new Date(versaoAtiva.data_visualizacao).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}