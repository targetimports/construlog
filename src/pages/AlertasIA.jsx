import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Eye, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AlertasIA() {
  const [filterStatus, setFilterStatus] = useState('novo');
  const queryClient = useQueryClient();

  const { data: alertas } = useQuery({
    queryKey: ['alertas-ia', filterStatus],
    queryFn: () => {
      if (filterStatus === '') {
        return base44.entities.AlertaViagemIA.list();
      }
      return base44.entities.AlertaViagemIA.filter({ status: filterStatus });
    }
  });

  const { data: viagens } = useQuery({
    queryKey: ['viagens-para-alertas'],
    queryFn: () => base44.entities.Viagem.list()
  });

  const { data: motoristas } = useQuery({
    queryKey: ['motoristas'],
    queryFn: () => base44.entities.Motorista.list()
  });

  const resolverMutation = useMutation({
    mutationFn: (id) => base44.entities.AlertaViagemIA.update(id, { status: 'resolvido' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas-ia'] })
  });

  const gerarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('gerarAlertasViagemIA', {}),
    onSuccess: (res) => {
      const r = res?.data || {};
      toast.success(
        r.criados > 0
          ? `${r.criados} novo(s) alerta(s) gerado(s) a partir de ${r.analisadas} viagem(ns).`
          : `Nenhuma anomalia nova detectada (${r.analisadas || 0} viagem(ns) analisadas).`
      );
      queryClient.invalidateQueries({ queryKey: ['alertas-ia'] });
    },
    onError: (e) => toast.error('Erro ao analisar viagens: ' + (e?.message || ''))
  });

  const severidadeColors = {
    info: 'bg-blue-100 text-blue-800',
    aviso: 'bg-yellow-100 text-yellow-800',
    critico: 'bg-red-100 text-red-800'
  };

  const tipoAlertas = {
    km_inconsistente: 'KM Inconsistente',
    consumo_anormal: 'Consumo Anormal',
    viagem_incompativel: 'Viagem Incompatível',
    uso_excessivo: 'Uso Excessivo',
    ausencia_foto: 'Falta de Foto',
    desvio_rota: 'Desvio de Rota'
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alertas da IA</h1>
          <p className="text-gray-600">Monitore anomalias e desvios detectados pela IA</p>
        </div>
        <Button
          onClick={() => gerarMutation.mutate()}
          disabled={gerarMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {gerarMutation.isPending
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Sparkles className="w-4 h-4 mr-2" />}
          {gerarMutation.isPending ? 'Analisando...' : 'Analisar viagens'}
        </Button>
      </div>

      {/* Filtro */}
      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2"
      >
        <option value="novo">Novos</option>
        <option value="analisado">Analisados</option>
        <option value="resolvido">Resolvidos</option>
        <option value="">Todos</option>
      </select>

      {/* Alertas */}
      {alertas && alertas.length > 0 ? (
        <div className="grid gap-4">
          {alertas.map(alerta => {
            const viagem = viagens?.find(v => v.id === alerta.viagem_id);
            const motorista = viagens && motoristas
              ? motoristas.find(m => m.user_id === viagens.find(v => v.id === alerta.viagem_id)?.motorista_user_id)
              : null;

            return (
              <Card key={alerta.id} className={`border-l-4 ${
                alerta.severidade === 'critico' ? 'border-l-red-600' :
                alerta.severidade === 'aviso' ? 'border-l-yellow-600' :
                'border-l-blue-600'
              }`}>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-bold px-3 py-1 rounded ${severidadeColors[alerta.severidade]}`}>
                          {alerta.severidade.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium">
                          {tipoAlertas[alerta.tipo_alerta] || alerta.tipo_alerta}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{alerta.descricao}</p>
                      {viagem && (
                        <p className="text-xs text-gray-500">
                          Viagem: <strong>{viagem.numero}</strong>
                          {motorista && ` • Motorista: ${motorista.nome}`}
                        </p>
                      )}
                    </div>

                    {alerta.percentual_desvio && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">
                          {Math.abs(alerta.percentual_desvio).toFixed(0)}%
                        </p>
                        <p className="text-xs text-gray-500">desvio</p>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {(alerta.valor_esperado || alerta.valor_observado) && (
                  <CardContent className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Esperado</p>
                        <p className="font-bold">{alerta.valor_esperado?.toFixed(1) || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Observado</p>
                        <p className="font-bold">{alerta.valor_observado?.toFixed(1) || '-'}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={() => resolverMutation.mutate(alerta.id)}
                        disabled={alerta.status !== 'novo'}
                        variant="outline"
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Resolver
                      </Button>
                      {viagem && (
                        <Button
                          onClick={() => window.location.href = `/MinhasViagens?id=${alerta.viagem_id}`}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Viagem
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            Nenhum alerta neste status
          </CardContent>
        </Card>
      )}
    </div>
  );
}