import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AlertasSST({ colaboradores, asos, treinamentos, acoesCorretivas }) {
  const alertas = [];

  // Colaboradores irregulares
  const irregulares = colaboradores.filter(c => !c.regular);
  if (irregulares.length > 0) {
    alertas.push({
      tipo: 'critico',
      icon: XCircle,
      titulo: `${irregulares.length} colaborador(es) irregular(es)`,
      descricao: 'Colaboradores com ASO vencido ou sem treinamento NR18 válido',
      acao: 'Bloquear acesso às obras'
    });
  }

  // ASOs vencendo em 15 dias
  const asosVencendo15 = asos.filter(a => {
    const validade = new Date(a.data_validade);
    const hoje = new Date();
    const diasRestantes = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
    return diasRestantes > 0 && diasRestantes <= 15;
  });

  if (asosVencendo15.length > 0) {
    alertas.push({
      tipo: 'urgente',
      icon: Clock,
      titulo: `${asosVencendo15.length} ASO(s) vencendo em 15 dias`,
      descricao: 'Agendar exames médicos com urgência',
      acao: 'Agendar exames'
    });
  }

  // Ações corretivas atrasadas
  const acoesAtrasadas = acoesCorretivas.filter(a => {
    if (a.status === 'concluida' || a.status === 'cancelada') return false;
    const prazo = new Date(a.prazo);
    return prazo < new Date();
  });

  if (acoesAtrasadas.length > 0) {
    alertas.push({
      tipo: 'atencao',
      icon: AlertTriangle,
      titulo: `${acoesAtrasadas.length} ação(ões) corretiva(s) atrasada(s)`,
      descricao: 'Verificar pendências e cobrar responsáveis',
      acao: 'Revisar ações'
    });
  }

  if (alertas.length === 0) {
    return null;
  }

  const tipoConfig = {
    critico: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    urgente: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    atencao: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' }
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900 flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Alertas Críticos de SST
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alertas.map((alerta, idx) => {
            const config = tipoConfig[alerta.tipo];
            const Icon = alerta.icon;

            return (
              <div key={idx} className={cn("p-4 rounded-lg border flex items-start gap-4", config.bg, config.border)}>
                <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", config.text)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn("font-semibold", config.text)}>{alerta.titulo}</p>
                    <Badge className={cn("border-0 text-xs", config.badge)}>{alerta.tipo}</Badge>
                  </div>
                  <p className="text-gray-600 text-sm">{alerta.descricao}</p>
                  <p className="text-xs text-gray-400 mt-1">Ação recomendada: {alerta.acao}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}