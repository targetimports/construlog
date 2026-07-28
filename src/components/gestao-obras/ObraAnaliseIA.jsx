import React from 'react';
import { AlertTriangle, Lightbulb, Zap, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ObraAnaliseIA({ analise }) {
  if (!analise) return null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            KPIs Críticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 whitespace-pre-line">{analise.kpis}</p>
        </CardContent>
      </Card>

      {/* Análise de Custos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            Análise de Custos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 whitespace-pre-line">{analise.analise_custos}</p>
        </CardContent>
      </Card>

      {/* Riscos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Riscos Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analise.riscos?.map((risco, idx) => (
            <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-semibold text-red-900">{risco.risco}</p>
              <p className="text-sm text-red-700 mt-1"><strong>Impacto:</strong> {risco.impacto}</p>
              <p className="text-sm text-red-700"><strong>Mitigação:</strong> {risco.mitigacao}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Oportunidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Oportunidades de Economia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analise.oportunidades?.map((oport, idx) => (
            <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-900">{oport.oportunidade}</p>
              <p className="text-sm text-yellow-700 mt-1"><strong>Economia:</strong> {oport.economia}</p>
              <p className="text-sm text-yellow-700"><strong>Implementação:</strong> {oport.implementacao}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Otimização de Recursos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Estratégias de Otimização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analise.otimizacao_recursos?.map((otim, idx) => (
            <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-semibold text-green-900">{otim.area}</p>
              <p className="text-sm text-green-700 mt-1"><strong>Sugestão:</strong> {otim.sugestao}</p>
              <p className="text-sm text-green-700"><strong>Benefício:</strong> {otim.beneficio}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recomendações Imediatas */}
      {analise.recomendacoes?.length > 0 && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Recomendações para Próximos 30 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analise.recomendacoes.map((rec, idx) => (
                <li key={idx} className="flex gap-3 text-blue-800">
                  <span className="text-blue-600 font-bold">{idx + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}