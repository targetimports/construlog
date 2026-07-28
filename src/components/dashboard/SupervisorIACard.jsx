import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function SupervisorIACard() {
  const navigate = useNavigate();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.OrcamentoObra.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.MedicaoObra.list()
  });

  const { data: alertasSupervisor = [] } = useQuery({
    queryKey: ['alertas-supervisor-resumo'],
    queryFn: () => base44.entities.AlertaSupervisor.filter({ 
      funcao_alvo: 'admin',
      status: 'OPEN' 
    }),
    refetchInterval: 30000
  });

  // Análise rápida
  const obrasSemOrcamento = obras.filter(obra => {
    const temOrcamento = orcamentos.some(orc => orc.obra_id === obra.id);
    return !temOrcamento && obra.status !== 'cancelada';
  }).length;

  const obrasAtivas = obras.filter(o => o.status === 'em_andamento');
  const obrasSemColaboradores = obrasAtivas.filter(obra => {
    const temColaborador = colaboradores.some(col => 
      col.obra_atual_id === obra.id && col.status === 'ativo'
    );
    return !temColaborador;
  }).length;

  const medicoesPendentes = medicoes.filter(m => m.status === 'pendente').length;

  // Usar alertas do banco se disponíveis, senão calcular local
  const alertasAtivos = alertasSupervisor.length > 0 
    ? alertasSupervisor
        .sort((a, b) => {
          const severityOrder = { CRITICO: 4, ALTO: 3, MEDIO: 2, BAIXO: 1 };
          const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
          if (severityDiff !== 0) return severityDiff;
          return new Date(b.last_seen_at) - new Date(a.last_seen_at);
        })
    : [];

  const totalAlertas = alertasAtivos.length || (obrasSemOrcamento + obrasSemColaboradores + medicoesPendentes);

  const alertas = alertasAtivos.length > 0
    ? alertasAtivos.map(a => ({
        title: a.title,
        message: a.message,
        occurrences_count: a.occurrences_count,
        type: a.type
      }))
    : [
        obrasSemOrcamento > 0 && { title: `${obrasSemOrcamento} obra(s) sem orçamento`, type: 'warning' },
        obrasSemColaboradores > 0 && { title: `${obrasSemColaboradores} obra(s) sem equipe`, type: 'critical' },
        medicoesPendentes > 0 && { title: `${medicoesPendentes} medição(ões) pendente(s)`, type: 'warning' }
      ].filter(Boolean);

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="text-blue-900">Supervisor Operacional IA</span>
            {totalAlertas > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 ml-2">
                {totalAlertas}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1.5"></div>
            Ativo
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Status Operacional</p>
            <p className="text-2xl font-bold text-gray-900">{totalAlertas === 0 ? '' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Alertas</p>
            <p className={`text-2xl font-bold ${totalAlertas > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {totalAlertas}
            </p>
          </div>
        </div>

        {/* Alertas resumidos */}
        {totalAlertas > 0 ? (
          <div className="space-y-2">
            {alertas.slice(0, 3).map((alerta, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{typeof alerta === 'string' ? alerta : alerta.title}</p>
                  {alerta.occurrences_count > 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Detectado {alerta.occurrences_count}x hoje
                    </p>
                  )}
                </div>
              </div>
            ))}
            {alertas.length > 3 && (
              <div className="text-center pt-2">
                <button
                  onClick={() => navigate(createPageUrl('SupervisorOperacional'))}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  +{alertas.length - 3} mais alerta{alertas.length - 3 > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>Tudo em ordem! Nenhum alerta detectado.</span>
          </div>
        )}

        {/* Botão de ação */}
        <Button
          onClick={() => navigate(createPageUrl('SupervisorOperacional'))}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {totalAlertas > 0 ? 'Ver todos os alertas' : 'Abrir painel completo'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}