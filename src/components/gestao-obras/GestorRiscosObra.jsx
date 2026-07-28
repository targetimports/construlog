import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Shield, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function GestorRiscosObra({ obraId }) {
  const [analisando, setAnalisando] = useState(false);
  const [riscos, setRiscos] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [filtroSeveridade, setFiltroSeveridade] = useState('todos');
  const [expandidos, setExpandidos] = useState({});

  const handleAnalisar = async () => {
    setAnalisando(true);
    try {
      const resultado = await base44.functions.invoke('analisadorRiscosObraIA', {
        obraId
      });
      setRiscos(resultado.data.riscos);
      setMetricas(resultado.data.metricas);
      toast.success('Análise de riscos concluída!');
    } catch (erro) {
      toast.error('Erro: ' + erro.message);
    } finally {
      setAnalisando(false);
    }
  };

  if (analisando) {
    return (
      <Card className="bg-blue-50">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-700">Analisando potenciais riscos...</p>
        </CardContent>
      </Card>
    );
  }

  if (!riscos || !metricas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Gestor de Riscos Proativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Identifica riscos em cronogramas, orçamentos e fornecedores, sugerindo ações preventivas
          </p>
          <Button onClick={handleAnalisar} disabled={analisando}>
            Iniciar Análise
          </Button>
        </CardContent>
      </Card>
    );
  }

  const riscosFiltrados = riscos.riscos_identificados?.filter(r => 
    filtroSeveridade === 'todos' || 
    (filtroSeveridade === 'crítico' && r.severidade >= 8) ||
    (filtroSeveridade === 'alto' && r.severidade >= 5 && r.severidade < 8) ||
    (filtroSeveridade === 'médio' && r.severidade < 5)
  ) || [];

  const toggleExpandido = (id) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getSeveridadeColor = (sev) => {
    if (sev >= 8) return 'bg-red-50 border-red-200 text-red-900';
    if (sev >= 5) return 'bg-yellow-50 border-yellow-200 text-yellow-900';
    return 'bg-orange-50 border-orange-200 text-orange-900';
  };

  const getSeveridadeLabel = (sev) => {
    if (sev >= 8) return 'CRÍTICO';
    if (sev >= 5) return 'ALTO';
    return 'MÉDIO';
  };

  return (
    <div className="space-y-4">
      {/* Métricas Resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Riscos Identificados</p>
            <p className="text-2xl font-bold text-red-600">{riscos.riscos_identificados?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Itens em Risco</p>
            <p className="text-2xl font-bold text-yellow-600">{metricas.total_itens_risco}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Fornecedores em Risco</p>
            <p className="text-2xl font-bold text-orange-600">{metricas.total_contratos_risco}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Contas Atrasadas</p>
            <p className="text-2xl font-bold text-red-600">{metricas.contas_atrasadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {['todos', 'crítico', 'alto', 'médio'].map(sev => (
          <Button
            key={sev}
            variant={filtroSeveridade === sev ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroSeveridade(sev)}
            className="capitalize"
          >
            {sev === 'todos' ? 'Todos' : sev}
          </Button>
        ))}
      </div>

      {/* Lista de Riscos */}
      <div className="space-y-3">
        {riscosFiltrados.length === 0 ? (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-900 font-semibold">Nenhum risco nesta categoria</p>
            </CardContent>
          </Card>
        ) : (
          riscosFiltrados.map(risco => (
            <Card key={risco.id} className={`border ${getSeveridadeColor(risco.severidade)}`}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleExpandido(risco.id)}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <CardTitle className="text-sm">{risco.descricao}</CardTitle>
                    </div>
                    <p className="text-xs mt-1 opacity-75">{risco.tipo} • {risco.area_afetada}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded bg-white`}>
                      {getSeveridadeLabel(risco.severidade)} {risco.severidade}/10
                    </span>
                  </div>
                </div>
              </CardHeader>

              {expandidos[risco.id] && (
                <CardContent className="space-y-4 pt-0">
                  {/* Ações de Mitigação */}
                  {riscos.acoes_mitigacao?.length > 0 && (
                    <div className="bg-white rounded p-3">
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Ações de Mitigação
                      </p>
                      <div className="space-y-2">
                        {riscos.acoes_mitigacao.slice(0, 3).map((acao, idx) => (
                          <div key={idx} className="text-xs p-2 bg-gray-50 rounded border">
                            <p className="font-semibold text-gray-900">{acao.acao}</p>
                            <p className="text-gray-700 mt-1">{acao.responsavel}</p>
                            <div className="flex gap-2 mt-1 text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {acao.prazo}
                              </span>
                              <span>{acao.custo_estimado}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Indicadores de Alerta */}
                  {riscos.indicadores_alerta?.length > 0 && (
                    <div className="bg-white rounded p-3">
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> KPIs para Monitorar
                      </p>
                      <div className="space-y-1">
                        {riscos.indicadores_alerta.slice(0, 2).map((kpi, idx) => (
                          <p key={idx} className="text-xs text-gray-700">✓ {kpi}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Impactos Potenciais */}
                  {riscos.impactos_potenciais?.length > 0 && (
                    <div className="bg-white rounded p-3">
                      <p className="text-xs font-semibold mb-2">Impactos Potenciais</p>
                      <ul className="space-y-1">
                        {riscos.impactos_potenciais.slice(0, 2).map((imp, idx) => (
                          <li key={idx} className="text-xs text-gray-700">• {imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Prioridades de Intervenção */}
      {riscos.prioridade_intervencao?.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm">Ordem de Prioridade de Intervenção</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {riscos.prioridade_intervencao.slice(0, 5).map((item, idx) => (
                <li key={idx} className="flex gap-2 text-xs text-gray-700">
                  <span className="font-bold text-blue-600 w-5">{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={handleAnalisar} className="w-full">
        Atualizar Análise de Riscos
      </Button>
    </div>
  );
}