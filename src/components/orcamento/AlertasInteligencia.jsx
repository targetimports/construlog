import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AlertasInteligencia() {
  const navigate = useNavigate();

  const { data: composicoes = [] } = useQuery({
    queryKey: ['composicoes-ia'],
    queryFn: () => base44.entities.Composicao.list('-created_date', 500)
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-ia'],
    queryFn: () => base44.entities.Insumo.list('-created_date', 500)
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos-ia'],
    queryFn: () => base44.entities.OrcamentoItem.list('-created_date', 1000)
  });

  const { data: composicoesInsumos = [] } = useQuery({
    queryKey: ['composicoes-insumos-ia'],
    queryFn: () => base44.entities.ComposicaoInsumo.list('-created_date', 2000)
  });

  // Análise: Composições mais usadas
  const composicoesMaisUsadas = useMemo(() => {
    const contagem = {};
    orcamentos.forEach(item => {
      const compId = item.composicao_id;
      if (compId) {
        contagem[compId] = (contagem[compId] || 0) + 1;
      }
    });

    return Object.entries(contagem)
      .map(([id, count]) => ({
        composicao: composicoes.find(c => c.id === id),
        usos: count
      }))
      .filter(item => item.composicao)
      .sort((a, b) => b.usos - a.usos)
      .slice(0, 5);
  }, [orcamentos, composicoes]);

  // Análise: Composições incompletas (sem insumos ou com poucos insumos)
  const composicoesIncompletas = useMemo(() => {
    const composicoesComInsumos = new Set(
      composicoesInsumos.map(ci => ci.composicao_id)
    );

    const contagemInsumos = composicoesInsumos.reduce((acc, ci) => {
      acc[ci.composicao_id] = (acc[ci.composicao_id] || 0) + 1;
      return acc;
    }, {});

    return composicoes
      .filter(comp => {
        const numInsumos = contagemInsumos[comp.id] || 0;
        return numInsumos === 0 || numInsumos < 3;
      })
      .slice(0, 5);
  }, [composicoes, composicoesInsumos]);

  // Análise: Custos fora da curva (composições com custo muito diferente da média)
  const composicoesCustoAnormal = useMemo(() => {
    if (composicoes.length === 0) return [];

    const custosValidos = composicoes
      .map(c => c.custo_unitario || 0)
      .filter(c => c > 0);

    if (custosValidos.length === 0) return [];

    const media = custosValidos.reduce((a, b) => a + b, 0) / custosValidos.length;
    const desvioPadrao = Math.sqrt(
      custosValidos.reduce((sq, n) => sq + Math.pow(n - media, 2), 0) / custosValidos.length
    );

    return composicoes
      .filter(comp => {
        const custo = comp.custo_unitario || 0;
        if (custo === 0) return false;
        const zScore = Math.abs((custo - media) / desvioPadrao);
        return zScore > 2; // Mais de 2 desvios padrões
      })
      .slice(0, 5);
  }, [composicoes]);

  // Análise: Insumos defasados (sem atualização de preço há mais de 6 meses)
  const insumosDefasados = useMemo(() => {
    const seisMesesAgo = new Date();
    seisMesesAgo.setMonth(seisMesesAgo.getMonth() - 6);

    return insumos
      .filter(ins => {
        if (!ins.data_preco) return true;
        const dataPreco = new Date(ins.data_preco);
        return dataPreco < seisMesesAgo;
      })
      .slice(0, 5);
  }, [insumos]);

  const totalAlertas = 
    composicoesIncompletas.length +
    composicoesCustoAnormal.length +
    insumosDefasados.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">Inteligência Artificial</h3>
              <p className="text-sm text-gray-600">
                Análise automática da base de custos
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-purple-600">{totalAlertas}</p>
              <p className="text-sm text-gray-600">alertas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composições Mais Usadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-amber-600" />
              Composições Mais Usadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {composicoesMaisUsadas.length === 0 ? (
              <p className="text-center py-6 text-gray-500 text-sm">
                Nenhum dado disponível
              </p>
            ) : (
              <div className="space-y-3">
                {composicoesMaisUsadas.map((item, index) => (
                  <div 
                    key={item.composicao.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-amber-600">#{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-gray-600">{item.composicao.codigo}</p>
                      <p className="text-sm text-gray-900 truncate">{item.composicao.descricao}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">
                      {item.usos} usos
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composições Incompletas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Composições Incompletas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {composicoesIncompletas.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-emerald-600 font-semibold">✓ Tudo certo!</p>
                <p className="text-sm text-gray-600 mt-1">Todas as composições estão completas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {composicoesIncompletas.map(comp => {
                  const numInsumos = composicoesInsumos.filter(ci => ci.composicao_id === comp.id).length;
                  
                  return (
                    <div 
                      key={comp.id}
                      className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-gray-600">{comp.codigo}</p>
                        <p className="text-sm text-gray-900 truncate">{comp.descricao}</p>
                        <p className="text-xs text-orange-700 mt-1">
                          {numInsumos === 0 ? 'Sem insumos' : `Apenas ${numInsumos} insumo(s)`}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(createPageUrl('Insumos'))}
                      >
                        Corrigir
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custos Fora da Curva */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-red-600" />
              Custos Fora da Curva
            </CardTitle>
          </CardHeader>
          <CardContent>
            {composicoesCustoAnormal.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-emerald-600 font-semibold">✓ Tudo certo!</p>
                <p className="text-sm text-gray-600 mt-1">Custos dentro do padrão</p>
              </div>
            ) : (
              <div className="space-y-3">
                {composicoesCustoAnormal.map(comp => (
                  <div 
                    key={comp.id}
                    className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-gray-600">{comp.codigo}</p>
                      <p className="text-sm text-gray-900 truncate">{comp.descricao}</p>
                      <p className="text-xs text-red-700 mt-1">
                        Custo: {(comp.custo_unitario || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(createPageUrl('Insumos'))}
                    >
                      Revisar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insumos Defasados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-blue-600" />
              Insumos Desatualizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insumosDefasados.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-emerald-600 font-semibold">✓ Tudo certo!</p>
                <p className="text-sm text-gray-600 mt-1">Preços atualizados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {insumosDefasados.map(ins => {
                  const diasDesatualizados = ins.data_preco 
                    ? Math.floor((new Date() - new Date(ins.data_preco)) / (1000 * 60 * 60 * 24))
                    : 999;

                  return (
                    <div 
                      key={ins.id}
                      className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-gray-600">{ins.codigo}</p>
                        <p className="text-sm text-gray-900 truncate">{ins.descricao}</p>
                        <p className="text-xs text-blue-700 mt-1">
                          {ins.data_preco 
                            ? `${diasDesatualizados} dias sem atualização`
                            : 'Nunca atualizado'
                          }
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(createPageUrl('AtualizarPrecos'))}
                      >
                        Atualizar
                      </Button>
                    </div>
                  );
                })}

                <Button 
                  className="w-full mt-4"
                  onClick={() => navigate(createPageUrl('AtualizarPrecos'))}
                >
                  Atualizar Todos os Preços
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}