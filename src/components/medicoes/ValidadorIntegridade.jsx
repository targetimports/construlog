import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';

export default function ValidadorIntegridade({ orcamentoId, medicaoId, onValidacaoMudou }) {
  const [resultado, setResultado] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const validar = React.useCallback(async () => {
    if (!orcamentoId) return;
    
    setLoading(true);
    try {
      const res = await base44.functions.invoke('validadorIntegridadeMedicao', {
        orcamentoId,
        medicaoId
      });
      
      setResultado(res.data);
      onValidacaoMudou?.(res.data);
    } catch (error) {
      console.error('Erro na validação:', error);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId, medicaoId, onValidacaoMudou]);

  React.useEffect(() => {
    validar();
  }, [validar]);

  if (!resultado) return null;

  const { alertas = [], avisos = [], resumo = {} } = resultado;
  const temErros = resultado.alertas?.some(a => a.tipo === 'erro') || false;

  return (
    <div className="space-y-4">
      {/* Status Geral */}
      <Card className={resultado.valido ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <CardContent className="py-4 flex items-center gap-3">
          {resultado.valido ? (
            <>
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Integridade Validada</p>
                <p className="text-sm text-green-700">Orçamento e medições estão sincronizadas</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Problemas de Integridade</p>
                <p className="text-sm text-red-700">Verifique os erros abaixo</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-gray-600 text-xs">Orçado</p>
          <p className="font-semibold text-blue-900">R$ {(resumo.total_orcado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-2 bg-green-50 rounded-lg border border-green-200">
          <p className="text-gray-600 text-xs">Medido</p>
          <p className="font-semibold text-green-900">R$ {(resumo.total_medido_aprovado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-gray-600 text-xs">Desvio %</p>
          <p className={`font-semibold ${resumo.diferenca_percentual > 5 ? 'text-red-900' : 'text-orange-900'}`}>
            {resumo.diferenca_percentual}%
          </p>
        </div>
        <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-gray-600 text-xs">Medições Aprovadas</p>
          <p className="font-semibold text-purple-900">{resumo.medicoes_aprovadas}</p>
        </div>
      </div>

      {/* Alertas */}
      {alertas.map((alerta, idx) => (
        <Alert key={idx} className={alerta.severidade === 'critica' ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'}>
          <AlertTriangle className={`h-4 w-4 ${alerta.severidade === 'critica' ? 'text-red-600' : 'text-orange-600'}`} />
          <div className="ml-2 flex-1">
            <p className={`font-medium ${alerta.severidade === 'critica' ? 'text-red-900' : 'text-orange-900'}`}>
              {alerta.mensagem}
            </p>
            {alerta.detalhes && (
              <div className="text-xs mt-2 space-y-1">
                {alerta.detalhes.map((det, i) => (
                  <p key={i} className="text-gray-700">
                    • {det.descricao}: orçado {det.orcado} vs medido {det.medido}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Alert>
      ))}

      {/* Avisos */}
      {avisos.map((aviso, idx) => (
        <Alert key={idx} className="bg-yellow-50 border-yellow-300">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <div className="ml-2">
            <p className="font-medium text-yellow-900">{aviso.mensagem}</p>
          </div>
        </Alert>
      ))}

      {/* Nenhum problema */}
      {alertas.length === 0 && avisos.length === 0 && (
        <Alert className="bg-green-50 border-green-300">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <div className="ml-2">
            <p className="font-medium text-green-900">Nenhum problema detectado</p>
          </div>
        </Alert>
      )}
    </div>
  );
}