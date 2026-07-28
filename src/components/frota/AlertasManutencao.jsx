import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, AlertCircle } from 'lucide-react';

export default function AlertasManutencao() {
  const [notificacoes, setNotificacoes] = useState([]);

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes'],
    queryFn: () => base44.entities.ManutencaoVeiculo.filter({ status: 'agendada' }, '-created_date', 100),
    refetchInterval: 60000 // Atualiza a cada minuto
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  useEffect(() => {
    const alertas = [];
    const hoje = new Date();

    manutencoes.forEach(manutencao => {
      const veiculo = veiculos.find(v => v.id === manutencao.veiculo_id);
      if (!veiculo) return;

      // Verificar data
      if (manutencao.data_agendamento) {
        const dataAgendamento = new Date(manutencao.data_agendamento);
        const diasParaVencer = Math.ceil((dataAgendamento - hoje) / (1000 * 60 * 60 * 24));

        if (diasParaVencer <= 3 && diasParaVencer > 0) {
          alertas.push({
            id: `data-${manutencao.id}`,
            tipo: 'vencimento_proximo',
            severidade: 'media',
            icon: Clock,
            titulo: `${veiculo.marca} ${veiculo.modelo} - Manutenção em ${diasParaVencer} dia(s)`,
            descricao: manutencao.descricao,
            veiculo: veiculo.placa,
            data: manutencao.data_agendamento
          });
        }

        if (diasParaVencer < 0) {
          alertas.push({
            id: `data-vencido-${manutencao.id}`,
            tipo: 'vencimento_vencido',
            severidade: 'critica',
            icon: AlertTriangle,
            titulo: `${veiculo.marca} ${veiculo.modelo} - MANUTENÇÃO VENCIDA`,
            descricao: manutencao.descricao,
            veiculo: veiculo.placa,
            dias_atraso: Math.abs(diasParaVencer)
          });
        }
      }

      // Verificar quilometragem
      if (manutencao.km_proximo && veiculo.km_atual) {
        const kmRestantes = manutencao.km_proximo - veiculo.km_atual;

        if (kmRestantes <= 500 && kmRestantes > 0) {
          alertas.push({
            id: `km-${manutencao.id}`,
            tipo: 'proximidade_km',
            severidade: 'media',
            icon: Clock,
            titulo: `${veiculo.marca} ${veiculo.modelo} - ${kmRestantes} km até manutenção`,
            descricao: manutencao.descricao,
            veiculo: veiculo.placa
          });
        }

        if (kmRestantes < 0) {
          alertas.push({
            id: `km-vencido-${manutencao.id}`,
            tipo: 'km_vencido',
            severidade: 'critica',
            icon: AlertTriangle,
            titulo: `${veiculo.marca} ${veiculo.modelo} - KM VENCIDO`,
            descricao: manutencao.descricao,
            veiculo: veiculo.placa,
            km_excedente: Math.abs(kmRestantes)
          });
        }
      }
    });

    setNotificacoes(alertas);
  }, [manutencoes, veiculos]);

  if (notificacoes.length === 0) {
    return (
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="py-4">
          <div className="text-emerald-400 text-sm font-medium">✓ Frota em dia</div>
        </CardContent>
      </Card>
    );
  }

  const criticas = notificacoes.filter(n => n.severidade === 'critica');

  return (
    <div className="space-y-2">
      {criticas.length > 0 && (
        <div className="text-red-400 font-medium text-sm mb-3">
          {criticas.length} ALERTA(S) CRÍTICO(S)
        </div>
      )}
      
      {notificacoes.map((alerta) => {
        const Icon = alerta.icon;
        const bgColor = alerta.severidade === 'critica' 
          ? 'bg-red-500/10 border-red-500/20' 
          : 'bg-amber-500/10 border-amber-500/20';
        const textColor = alerta.severidade === 'critica' ? 'text-red-400' : 'text-amber-400';

        return (
          <Card key={alerta.id} className={`border ${bgColor}`}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textColor}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${textColor}`}>{alerta.titulo}</div>
                  <div className="text-xs text-gray-500 mt-1">{alerta.descricao}</div>
                  <Badge className="mt-2 text-xs bg-gray-700 text-gray-300">
                    {alerta.veiculo}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}