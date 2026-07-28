import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingDown, DollarSign, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AlertasGerenciais({ alertas, obras }) {
  const alertasPorSeveridade = {
    alta: alertas.filter(a => a.severidade === 'alta'),
    media: alertas.filter(a => a.severidade === 'media'),
    baixa: alertas.filter(a => a.severidade === 'baixa')
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'margem_negativa':
      case 'margem_baixa':
        return <TrendingDown className="h-5 w-5" />;
      case 'custo_alto':
        return <DollarSign className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getColorClass = (severidade) => {
    switch (severidade) {
      case 'alta':
        return 'border-red-200 bg-red-50';
      case 'media':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-yellow-200 bg-yellow-50';
    }
  };

  const getTituloSeveridade = (severidade) => {
    switch (severidade) {
      case 'alta':
        return 'Alertas Críticos';
      case 'media':
        return 'Alertas de Atenção';
      default:
        return 'Alertas de Observação';
    }
  };

  if (alertas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum Alerta Detectado</h3>
            <p className="text-gray-600">Todas as obras estão dentro dos parâmetros esperados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{alertasPorSeveridade.alta.length}</div>
              <div className="text-sm text-gray-600 mt-1">Críticos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{alertasPorSeveridade.media.length}</div>
              <div className="text-sm text-gray-600 mt-1">Atenção</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{alertasPorSeveridade.baixa.length}</div>
              <div className="text-sm text-gray-600 mt-1">Observação</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas por Severidade */}
      {['alta', 'media', 'baixa'].map(severidade => {
        const alertasFiltrados = alertasPorSeveridade[severidade];
        if (alertasFiltrados.length === 0) return null;

        return (
          <Card key={severidade} className={getColorClass(severidade)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {getTituloSeveridade(severidade)}
                <Badge variant="secondary" className="ml-2">
                  {alertasFiltrados.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertasFiltrados.map((alerta, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-1 ${
                          severidade === 'alta' ? 'text-red-600' : 
                          severidade === 'media' ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                          {getIcon(alerta.tipo)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{alerta.obra}</h4>
                          <p className="text-sm text-gray-600 mt-1">{alerta.mensagem}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {alerta.tipo.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Link to={createPageUrl('ObraDetalhes') + '?id=' + alerta.obra_id}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}