import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, TrendingUp, Filter, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const probabilidadeNivel = {
  muito_baixa: 1,
  baixa: 2,
  media: 3,
  alta: 4,
  muito_alta: 5
};

const impactoNivel = {
  muito_baixo: 1,
  baixo: 2,
  medio: 3,
  alto: 4,
  muito_alto: 5
};

const statusConfig = {
  identificado: { label: 'Identificado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  em_analise: { label: 'Em Análise', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  mitigando: { label: 'Mitigando', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  monitorando: { label: 'Monitorando', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  resolvido: { label: 'Resolvido', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  materializado: { label: 'Materializado', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

const classificacaoConfig = {
  baixo: { label: 'Baixo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: '' },
  medio: { label: 'Médio', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '' },
  alto: { label: 'Alto', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: '' },
  critico: { label: 'Crítico', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: '' }
};

export default function MatrizRiscos({ riscos }) {
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Calcular nível e classificação para cada risco
  const riscosProcessados = riscos.map(risco => {
    const probNivel = probabilidadeNivel[risco.probabilidade] || 3;
    const impNivel = impactoNivel[risco.impacto] || 3;
    const nivel = probNivel * impNivel;
    
    let classificacao = 'baixo';
    if (nivel >= 15) classificacao = 'critico';
    else if (nivel >= 10) classificacao = 'alto';
    else if (nivel >= 5) classificacao = 'medio';

    return { ...risco, nivelCalculado: nivel, classificacaoCalculada: classificacao };
  });

  // Filtros
  const riscosFiltrados = riscosProcessados.filter(r => {
    const matchCategoria = categoriaFilter === 'todas' || r.categoria === categoriaFilter;
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchCategoria && matchStatus;
  });

  // Agrupar por classificação
  const porClassificacao = {
    critico: riscosFiltrados.filter(r => r.classificacaoCalculada === 'critico'),
    alto: riscosFiltrados.filter(r => r.classificacaoCalculada === 'alto'),
    medio: riscosFiltrados.filter(r => r.classificacaoCalculada === 'medio'),
    baixo: riscosFiltrados.filter(r => r.classificacaoCalculada === 'baixo')
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-800 border-gray-700 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="todas">Todas Categorias</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="contratual">Contratual</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="juridico">Jurídico</SelectItem>
                <SelectItem value="reputacional">Reputacional</SelectItem>
                <SelectItem value="ambiental">Ambiental</SelectItem>
                <SelectItem value="seguranca">Segurança</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="identificado">Identificado</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="mitigando">Mitigando</SelectItem>
                <SelectItem value="monitorando">Monitorando</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>

            <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900 ml-auto">
              <Plus className="w-4 h-4 mr-2" />
              Novo Risco
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Matriz por Classificação */}
      {['critico', 'alto', 'medio', 'baixo'].map(classe => {
        const riscosClasse = porClassificacao[classe];
        if (riscosClasse.length === 0) return null;

        const config = classificacaoConfig[classe];

        return (
          <Card key={classe} className={cn("border", config.color.replace('text-', 'border-').replace('/10', '/20'))}>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span className="text-2xl">{config.icon}</span>
                Riscos {config.label}
                <Badge className={config.color}>{riscosClasse.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {riscosClasse.map(risco => (
                <div key={risco.id} className="p-4 bg-gray-800/50 rounded-xl">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{risco.titulo}</h3>
                      <p className="text-gray-400 text-sm mb-2">{risco.descricao}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                          {risco.categoria}
                        </Badge>
                        <Badge className={cn("border text-xs", statusConfig[risco.status]?.color)}>
                          {statusConfig[risco.status]?.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-gray-400">
                          Nível: {risco.nivelCalculado}/25
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Probabilidade:</span>
                      <span className="text-white ml-2 capitalize">{risco.probabilidade?.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Impacto:</span>
                      <span className="text-white ml-2 capitalize">{risco.impacto?.replace('_', ' ')}</span>
                    </div>
                    {risco.responsavel && (
                      <div>
                        <span className="text-gray-500">Responsável:</span>
                        <span className="text-white ml-2">{risco.responsavel}</span>
                      </div>
                    )}
                    {risco.impacto_financeiro_estimado > 0 && (
                      <div>
                        <span className="text-gray-500">Impacto $:</span>
                        <span className="text-red-400 ml-2">
                          {risco.impacto_financeiro_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {risco.plano_mitigacao && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-gray-400 text-xs mb-1">Plano de Mitigação:</p>
                      <p className="text-gray-300 text-sm">{risco.plano_mitigacao}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {riscosFiltrados.length === 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Nenhum risco encontrado</h3>
            <p className="text-gray-500">Ajuste os filtros ou cadastre um novo risco</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}