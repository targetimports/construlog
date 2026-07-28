import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AnalisadorContratosIA({ contrato, onAnaliseCompleta }) {
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const handleAnalisar = async () => {
    if (!contrato?.id) {
      toast.error('Contrato inválido para análise');
      return;
    }

    setAnalisando(true);
    try {
      // Texto livre quando existir; senão o backend analisa pelos metadados reais
      // do contrato (valores, prazos, tipo, observações).
      const conteudo = contrato.descricao || contrato.observacoes || contrato.observacao || '';
      const resultado = await base44.functions.invoke('analisadorContratosIA', {
        contratoId: contrato.id,
        conteudoContrato: conteudo
      });

      setAnalise(resultado.data.analise);
      if (onAnaliseCompleta) onAnaliseCompleta(resultado.data.analise);
      toast.success('Análise IA concluída!');
    } catch (erro) {
      toast.error('Erro ao analisar: ' + erro.message);
    } finally {
      setAnalisando(false);
    }
  };

  if (analisando) {
    return (
      <Card className="bg-blue-50">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-700">Analisando contrato com IA...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Análise Inteligente de Contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Use IA para analisar cláusulas, identificar riscos, sugerir aditivos e monitorar prazos
          </p>
          <Button onClick={handleAnalisar} disabled={analisando}>
            Iniciar Análise IA
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score de Risco */}
      <Card className={`${analise.score_risco >= 7 ? 'bg-red-50 border-red-200' : analise.score_risco >= 4 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Score de Risco</p>
              <p className="text-2xl font-bold text-gray-900">{analise.score_risco}/10</p>
            </div>
            <div className="text-right">
              {analise.score_risco >= 7 ? <AlertTriangle className="w-12 h-12 text-red-500" /> : analise.score_risco >= 4 ? <AlertCircle className="w-12 h-12 text-yellow-500" /> : <CheckCircle className="w-12 h-12 text-green-500" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avisos Urgentes */}
      {analise.avisos_urgentes?.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Avisos Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analise.avisos_urgentes.map((aviso, idx) => (
              <div key={idx} className="flex gap-3 p-3 bg-red-50 rounded">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{aviso}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Cláusulas Chave</p>
            <p className="text-2xl font-bold text-gray-900">{analise.clausulasChave?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">identificadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Riscos</p>
            <p className="text-2xl font-bold text-orange-600">{analise.riscosIdentificados?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">encontrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase">Aditivos Sugeridos</p>
            <p className="text-2xl font-bold text-blue-600">{analise.sugestoesAditivos?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">recomendados</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes Expandidos */}
      <Button variant="outline" onClick={() => setMostrarDetalhes(!mostrarDetalhes)}>
        {mostrarDetalhes ? 'Ocultar Detalhes' : 'Ver Análise Completa'}
      </Button>

      {mostrarDetalhes && (
        <>
          {/* Riscos Identificados */}
          {analise.riscosIdentificados?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Riscos Identificados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analise.riscosIdentificados.map((risco, idx) => (
                  <div key={idx} className={`p-3 rounded border-l-4 ${risco.severidade === 'alta' ? 'bg-red-50 border-red-500' : risco.severidade === 'média' ? 'bg-yellow-50 border-yellow-500' : 'bg-blue-50 border-blue-500'}`}>
                    <p className="font-semibold text-sm text-gray-900">{risco.tipo}</p>
                    <p className="text-xs text-gray-700 mt-1">{risco.descricao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sugestões de Aditivos */}
          {analise.sugestoesAditivos?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Aditivos Sugeridos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analise.sugestoesAditivos.map((aditivo, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="font-semibold text-sm text-gray-900">{aditivo.tipo}</p>
                    <p className="text-xs text-gray-700 mt-1">{aditivo.descricao}</p>
                    <p className="text-xs text-blue-600 mt-2">{aditivo.motivo}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Datas Críticas */}
          {Object.keys(analise.datas_criticas || {}).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Datas Críticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(analise.datas_criticas).map(([data, valor]) => (
                    <div key={data} className="p-3 bg-gray-50 rounded">
                      <p className="text-xs font-semibold text-gray-700 uppercase">{data}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">{valor}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          {analise.recomendacoes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recomendações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analise.recomendacoes.map((rec, idx) => (
                  <div key={idx} className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Button variant="outline" onClick={handleAnalisar} className="w-full">
        Analisar Novamente
      </Button>
    </div>
  );
}