import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FluxoAprovacao({ requisicao }) {
  if (!requisicao?.workflow_aprovacao) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          Nenhum fluxo de aprovação configurado
        </CardContent>
      </Card>
    );
  }

  const workflow = requisicao.workflow_aprovacao;
  const etapas = workflow.etapas || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'aprovada':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'rejeitada':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'pendente':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'aprovada':
        return { label: 'Aprovada', bg: 'bg-green-100', text: 'text-green-800' };
      case 'rejeitada':
        return { label: 'Rejeitada', bg: 'bg-red-100', text: 'text-red-800' };
      case 'pendente':
        return { label: 'Pendente', bg: 'bg-yellow-100', text: 'text-yellow-800' };
      default:
        return { label: 'Aguardando', bg: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  return (
    <div className="space-y-4">
      {etapas.map((etapa, index) => {
        const statusLabel = getStatusLabel(etapa.status);
        const aprovadores = etapa.aprovadores_pendentes || [];
        const aprovadosCount = aprovadores.filter(a => a.aprovado).length;
        const totalAprovadores = aprovadores.length;

        return (
          <div key={index}>
            <Card className={etapa.status === 'rejeitada' ? 'border-red-200 bg-red-50' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(etapa.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Etapa {etapa.numero}: {etapa.alcada_nome}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {etapa.requer_todos_aprovadores 
                          ? `Requer aprovação de TODOS (${aprovadosCount}/${totalAprovadores})`
                          : `Requer aprovação de QUALQUER UM (${aprovadosCount}/${totalAprovadores})`
                        }
                      </p>
                    </div>
                  </div>
                  <Badge className={`${statusLabel.bg} ${statusLabel.text}`}>
                    {statusLabel.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Lista de Aprovadores */}
                <div className="space-y-2">
                  {aprovadores.map((aprv, idx) => (
                    <div 
                      key={idx}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{aprv.nome}</p>
                        <p className="text-xs text-gray-500">{aprv.user_email}</p>
                        {aprv.comentario && (
                          <p className="text-sm text-gray-700 mt-2 italic">
                            "{aprv.comentario}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {aprv.aprovado ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <p className="text-xs text-green-600 font-medium">Aprovado</p>
                            {aprv.data_aprovacao && (
                              <p className="text-xs text-gray-500">
                                {format(new Date(aprv.data_aprovacao), "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                            )}
                          </>
                        ) : etapa.status === 'pendente' ? (
                          <>
                            <Clock className="w-5 h-5 text-yellow-600" />
                            <p className="text-xs text-yellow-600 font-medium">Pendente</p>
                          </>
                        ) : etapa.status === 'rejeitada' ? (
                          <>
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-xs text-red-600 font-medium">Rejeitado</p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info de Rejeição */}
                {etapa.status === 'rejeitada' && etapa.motivo_rejeicao && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-900">Motivo da Rejeição:</p>
                    <p className="text-sm text-red-800 mt-1">{etapa.motivo_rejeicao}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seta conectando etapas */}
            {index < etapas.length - 1 && (
              <div className="flex justify-center py-2">
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>
        );
      })}

      {/* Resumo Final */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <h4 className="font-semibold text-blue-900">Status Geral da Aprovação</h4>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {etapas.filter(e => e.status === 'aprovada').length}
              </p>
              <p className="text-xs text-blue-600">Etapas Aprovadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {etapas.filter(e => e.status === 'pendente').length}
              </p>
              <p className="text-xs text-yellow-600">Etapas Pendentes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {etapas.filter(e => e.status === 'rejeitada').length}
              </p>
              <p className="text-xs text-red-600">Etapas Rejeitadas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}