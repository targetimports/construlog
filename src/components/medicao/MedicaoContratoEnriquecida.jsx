import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function MedicaoContratoEnriquecida({ contratoId, medicaoData, onValidacao }) {
  const [validacao, setValidacao] = useState(null);
  const [loading, setLoading] = useState(false);

  const validarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('validadorMedicaoContrato', {
        contratoId,
        medicaoData
      });
      return response.data;
    },
    onSuccess: (data) => {
      setValidacao(data);
      onValidacao?.(data);
      
      if (data.erros.length === 0) {
        toast.success('Medição validada com sucesso');
      } else {
        toast.error(`${data.erros.length} erro(s) encontrado(s)`);
      }
    }
  });

  return (
    <div className="space-y-4">
      {/* Botão validar */}
      <Button
        onClick={() => validarMutation.mutate()}
        disabled={validarMutation.isPending}
        className="w-full gap-2"
      >
        {validarMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        Validar Medição
      </Button>

      {validacao && (
        <div className="space-y-3">
          {/* Status Geral */}
          <Alert className={validacao.valido ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            {validacao.valido ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <div className="ml-2">
              <p className={`font-medium ${validacao.valido ? 'text-green-900' : 'text-red-900'}`}>
                {validacao.valido ? '✓ Medição válida' : '✗ Erros encontrados'}
              </p>
            </div>
          </Alert>

          {/* Erros */}
          {validacao.erros.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-900">Erros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {validacao.erros.map((erro, i) => (
                  <div key={i} className="text-xs p-2 bg-white rounded border-l-2 border-red-500">
                    <p className="text-red-900 font-medium">{erro.tipo}</p>
                    <p className="text-red-700">{erro.mensagem}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Avisos */}
          {validacao.avisos.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-900">Avisos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {validacao.avisos.map((aviso, i) => (
                  <div key={i} className="text-xs p-2 bg-white rounded border-l-2 border-yellow-500">
                    <p className="text-yellow-900 font-medium">{aviso.tipo}</p>
                    <p className="text-yellow-700">{aviso.mensagem}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sugestões */}
          {validacao.sugestoes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-700">Sugestões:</p>
              {validacao.sugestoes.map((sug, i) => (
                <p key={i} className="text-xs text-gray-600">• {sug}</p>
              ))}
            </div>
          )}

          {/* Resumo Financeiro */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Valor Bruto:</span>
                <Badge variant="outline">R$ {validacao.resumo_financeiro.valor_bruto.toFixed(2)}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Descontos:</span>
                <span className="text-red-600">-R$ {validacao.resumo_financeiro.total_descontos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retenções:</span>
                <span className="text-red-600">-R$ {validacao.resumo_financeiro.total_retencoes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Valor Líquido:</span>
                <span className="text-green-600">R$ {validacao.resumo_financeiro.valor_liquido.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>% Acumulado:</span>
                <span>{validacao.resumo_financeiro.percentual_acumulado}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}