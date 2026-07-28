import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, DollarSign, TrendingUp, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AlertasFraude({ comprasAnomalas, desvios, materiais }) {
  const alertas = [];

  // Compras com preço muito acima da média
  if (comprasAnomalas.length > 0) {
    alertas.push({
      tipo: 'critico',
      icon: DollarSign,
      titulo: `${comprasAnomalas.length} compra(s) com preço suspeito`,
      descricao: 'Preços 30% ou mais acima da média do mercado',
      acao: 'Investigar fornecedores e cotações'
    });
  }

  // Desvios muito altos sem justificativa
  const desviosSemJustificativa = desvios.filter(d => 
    Math.abs(d.percentual_desvio) > 30 && 
    d.status === 'pendente_justificativa'
  );

  if (desviosSemJustificativa.length > 0) {
    alertas.push({
      tipo: 'urgente',
      icon: TrendingUp,
      titulo: `${desviosSemJustificativa.length} desvio(s) crítico(s) sem justificativa`,
      descricao: 'Desvios acima de 30% precisam de justificativa imediata',
      acao: 'Solicitar justificativa dos responsáveis'
    });
  }

  // Materiais com múltiplos desvios
  const materiaisComProblemas = {};
  desvios.forEach(d => {
    if (!materiaisComProblemas[d.material_id]) {
      materiaisComProblemas[d.material_id] = 0;
    }
    materiaisComProblemas[d.material_id] += 1;
  });

  const materiaisFrequentes = Object.entries(materiaisComProblemas)
    .filter(([_, count]) => count >= 3)
    .length;

  if (materiaisFrequentes > 0) {
    alertas.push({
      tipo: 'atencao',
      icon: AlertTriangle,
      titulo: `${materiaisFrequentes} material(is) com desvios recorrentes`,
      descricao: '3 ou mais desvios no mesmo material podem indicar problema no planejamento',
      acao: 'Revisar orçamento e consumo padrão'
    });
  }

  if (alertas.length === 0) {
    return (
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-emerald-400 font-semibold">Sistema Operando Normalmente</p>
              <p className="text-gray-400 text-sm">Nenhuma anomalia detectada no momento</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tipoConfig = {
    critico: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
    urgente: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
    atencao: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Alertas Antifraude
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alertas.map((alerta, idx) => {
            const config = tipoConfig[alerta.tipo];
            const Icon = alerta.icon;

            return (
              <div key={idx} className={cn(
                "p-4 rounded-xl border flex items-start gap-4",
                config.bg,
                config.border
              )}>
                <Icon className={cn("w-6 h-6 mt-0.5", config.text)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn("font-semibold", config.text)}>{alerta.titulo}</p>
                    <Badge className={cn("border text-xs uppercase", config.badge)}>
                      {alerta.tipo}
                    </Badge>
                  </div>
                  <p className="text-gray-400 text-sm">{alerta.descricao}</p>
                  <p className="text-xs text-gray-500 mt-1">Ação: {alerta.acao}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}