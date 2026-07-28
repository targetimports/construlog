import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, TrendingUp, Calendar, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OtimizadorCronogramaIA({ obraId, obraDados }) {
  const [otimizando, setOtimizando] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [expandir, setExpandir] = useState(false);

  const handleOtimizar = async () => {
    setOtimizando(true);
    try {
      const resultado = await base44.functions.invoke('otimizadorCronogramaObraIA', {
        obraId
      });
      setAnalise(resultado.data.analise);
      toast.success('Otimização de cronograma concluída!');
    } catch (erro) {
      toast.error('Erro: ' + erro.message);
    } finally {
      setOtimizando(false);
    }
  };

  if (otimizando) {
    return (
      <Card className="bg-blue-50">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-700">Analisando histórico e otimizando cronograma...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Otimizador de Cronograma com IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Analisa histórico de obras, identifica gargalos e sugere otimizações para evitar atrasos
          </p>
          <Button onClick={handleOtimizar} disabled={otimizando}>
            Executar Análise
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dataPrevisao = analise.previsao_conclusao ? format(parseISO(analise.previsao_conclusao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-';
  const riscoCor = analise.risco_atraso >= 7 ? 'text-red-600' : analise.risco_atraso >= 4 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="space-y-4">
      {/* Resumo Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={analise.risco_atraso >= 7 ? 'bg-red-50 border-red-200' : analise.risco_atraso >= 4 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Risco de Atraso</p>
            <p className={`text-3xl font-bold ${riscoCor}`}>{analise.risco_atraso}/10</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Previsão Conclusão</p>
            <p className="text-lg font-bold text-gray-900">{dataPrevisao}</p>
            {analise.dias_atraso_previsto > 0 && (
              <p className="text-xs text-red-600 mt-1">+{analise.dias_atraso_previsto} dias de atraso</p>
            )}
            {analise.dias_atraso_previsto < 0 && (
              <p className="text-xs text-green-600 mt-1">{Math.abs(analise.dias_atraso_previsto)} dias antes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase">Gargalos Críticos</p>
            <p className="text-3xl font-bold text-orange-600">{analise.gargalos_identificados?.length || 0}</p>
            <p className="text-xs text-gray-600 mt-1">identificados</p>
          </CardContent>
        </Card>
      </div>

      {/* Avisos Críticos */}
      {analise.risco_atraso >= 7 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Risco Alto de Atraso Detectado</p>
              <p className="text-sm text-red-800 mt-1">A análise indica probabilidade alta de atrasos. Implementar ações do plano de mitigação é crítico.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparação com Histórico */}
      {analise.metricas_comparativas && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Comparação com Histórico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-700">
              <strong>Média Histórica:</strong> {analise.metricas_comparativas.tempo_medio_historico}
            </p>
            <p className="text-sm text-gray-700">{analise.metricas_comparativas.comparacao}</p>
          </CardContent>
        </Card>
      )}

      {/* Gargalos Identificados */}
      {analise.gargalos_identificados?.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-sm">Gargalos Identificados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analise.gargalos_identificados.map((gargalo, idx) => (
              <div key={idx} className="p-2 bg-orange-50 rounded flex gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{gargalo}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Otimizações Sugeridas */}
      {analise.otimizacoes?.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Otimizações Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analise.otimizacoes.map((opt, idx) => (
              <div key={idx} className="p-3 bg-white rounded border border-blue-200">
                <p className="font-semibold text-sm text-gray-900">{opt.titulo}</p>
                <p className="text-xs text-gray-700 mt-1">{opt.descricao}</p>
                <p className="text-xs text-blue-600 mt-2">Impacto: {opt.impacto}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {expandir && (
        <>
          {/* Recursos Necessários */}
          {analise.recursos_necessarios && Object.keys(analise.recursos_necessarios).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recursos Críticos Recomendados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(analise.recursos_necessarios).map(([recurso, valor]) => (
                    <div key={recurso} className="p-3 bg-gray-50 rounded">
                      <p className="text-xs font-semibold text-gray-700 capitalize">{recurso}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">{valor}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plano de Ação */}
          {analise.plano_acao?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Plano de Ação Prioritário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analise.plano_acao.map((acao, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded">
                    <span className="inline-block w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold text-center flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-gray-700">{acao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setExpandir(!expandir)} className="flex-1">
          {expandir ? 'Ocultar Detalhes' : 'Ver Análise Completa'}
        </Button>
        <Button variant="outline" onClick={handleOtimizar}>
          Atualizar Análise
        </Button>
      </div>
    </div>
  );
}