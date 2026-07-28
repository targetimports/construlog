import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Award, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function RankingMargensObra() {
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  const { data: rankings = [] } = useQuery({
    queryKey: ['ranking-margens'],
    queryFn: () => base44.entities.RankingMargemObra.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const rankingsFiltrados = tipoFiltro === 'todos' 
    ? rankings 
    : rankings.filter(r => r.tipo_obra === tipoFiltro);

  const rankingsOrdenados = [...rankingsFiltrados].sort((a, b) => 
    (b.margem_liquida || 0) - (a.margem_liquida || 0)
  );

  const mediaMargemPorTipo = rankingsFiltrados.reduce((acc, r) => {
    if (!acc[r.tipo_obra]) {
      acc[r.tipo_obra] = { soma: 0, count: 0 };
    }
    acc[r.tipo_obra].soma += r.margem_liquida || 0;
    acc[r.tipo_obra].count += 1;
    return acc;
  }, {});

  const tiposObra = [
    'edificacao', 'pavimentacao', 'saneamento', 
    'drenagem', 'ponte', 'reforma', 'infraestrutura'
  ];

  const tipoLabels = {
    edificacao: 'Edificação',
    pavimentacao: 'Pavimentação',
    saneamento: 'Saneamento',
    drenagem: 'Drenagem',
    ponte: 'Ponte',
    reforma: 'Reforma',
    infraestrutura: 'Infraestrutura'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ranking de Margens por Obra"
        subtitle="Análise de lucratividade por tipo de obra"
      />

      {/* Filtro */}
      <Card>
         <CardContent className="p-5">
           <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
             <SelectTrigger>
               <SelectValue placeholder="Filtrar por tipo..." />
             </SelectTrigger>
             <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tiposObra.map(tipo => (
                <SelectItem key={tipo} value={tipo}>{tipoLabels[tipo]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Média por Tipo */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(mediaMargemPorTipo).slice(0, 4).map(([tipo, data]) => {
          const media = data.soma / data.count;
          return (
            <Card key={tipo}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-10 h-10 text-emerald-600" />
                  <div>
                    <p className="text-gray-600 text-sm">{tipoLabels[tipo]}</p>
                    <p className="text-2xl font-bold text-gray-900">{media.toFixed(1)}%</p>
                    <p className="text-gray-500 text-xs">{data.count} obras</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rankingsOrdenados.map((rank, index) => {
              const obra = obras.find(o => o.id === rank.obra_id);
              const margemBoa = rank.margem_liquida >= 15;
              const margemMedia = rank.margem_liquida >= 8 && rank.margem_liquida < 15;
              const margemBaixa = rank.margem_liquida < 8;

              return (
                <div 
                  key={rank.id}
                  className="bg-gray-100 p-5 rounded-lg border border-gray-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600">
                      {index === 0 && <Award className="w-6 h-6 text-yellow-400" />}
                      {index !== 0 && <span className="text-white font-bold">#{index + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-gray-900 font-semibold">{obra?.nome || 'Obra não identificada'}</p>
                        <Badge className="bg-gray-300 text-gray-900">{tipoLabels[rank.tipo_obra]}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-700">Contrato:</span>{' '}
                          <span className="text-gray-900">R$ {rank.valor_contrato?.toLocaleString('pt-BR')}</span>
                        </div>
                        <div>
                          <span className="text-gray-700">Custo Real:</span>{' '}
                          <span className="text-gray-900">R$ {rank.custo_real?.toLocaleString('pt-BR')}</span>
                        </div>
                        <div>
                          <span className="text-gray-700">Lucro Líquido:</span>{' '}
                          <span className="text-emerald-600">R$ {rank.lucro_liquido?.toLocaleString('pt-BR')}</span>
                        </div>
                        <div>
                          <span className="text-gray-700">Executado:</span>{' '}
                          <span className="text-gray-900">{rank.percentual_executado}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      {margemBoa && <TrendingUp className="w-5 h-5 text-emerald-600" />}
                      {margemMedia && <TrendingUp className="w-5 h-5 text-amber-600" />}
                      {margemBaixa && <AlertTriangle className="w-5 h-5 text-red-600" />}
                      <p className={`text-3xl font-bold ${
                        margemBoa ? 'text-emerald-600' : 
                        margemMedia ? 'text-amber-600' : 
                        'text-red-600'
                      }`}>
                        {rank.margem_liquida?.toFixed(1)}%
                      </p>
                    </div>
                    <p className="text-gray-600 text-sm">Margem Líquida</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">
                        Bruta: {rank.margem_bruta?.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600">
                        Impostos: R$ {rank.impostos?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {rankingsOrdenados.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600">Nenhum dado de margem disponível ainda.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}