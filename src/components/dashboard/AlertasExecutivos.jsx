import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  ExternalLink,
  Filter } from
'lucide-react';
import { useNavigate } from 'react-router-dom';

const severidadeConfig = {
  critico: {
    label: 'Crítico',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: AlertTriangle,
    iconColor: 'text-red-600'
  },
  alto: {
    label: 'Alto',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: AlertCircle,
    iconColor: 'text-orange-600'
  },
  medio: {
    label: 'Médio',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Info,
    iconColor: 'text-yellow-600'
  }
};

const tipoConfig = {
  desvio_orcamento: { icon: TrendingUp, label: 'Desvio Orçamentário' },
  receber_vencida: { icon: DollarSign, label: 'Receber Vencida' },
  receber_vencendo: { icon: DollarSign, label: 'Receber Vencendo' },
  pagar_vencida: { icon: DollarSign, label: 'Pagar Vencida' },
  pagar_vencendo: { icon: DollarSign, label: 'Pagar Vencendo' },
  estoque_negativo: { icon: Package, label: 'Estoque Negativo' },
  estoque_baixo: { icon: Package, label: 'Estoque Baixo' },
  estoque_abaixo_minimo: { icon: Package, label: 'Estoque Abaixo do Mínimo' },
  estoque_em_ponto_reposicao: { icon: Package, label: 'Estoque no Ponto de Reposição' },
  oc_sem_recebimento: { icon: ShoppingCart, label: 'OC Sem Recebimento' },
  oc_recebimento_parcial: { icon: ShoppingCart, label: 'OC Recebimento Parcial' }
};

export default function AlertasExecutivos() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState(15);
  const [obraId, setObraId] = useState(null);
  const [tabAtiva, setTabAtiva] = useState('todos');

  // Buscar obras para filtro
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' })
  });

  // Buscar alertas com fallback resiliente
  const { data: resultado, isLoading, refetch } = useQuery({
    queryKey: ['alertas-executivos', periodo, obraId],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getAlertasExecutivos', { periodo, obra_id: obraId });
        return res.data;
      } catch (error) {
        // Fallback seguro: não quebrar dashboard se alertas falharem
        console.warn('[AlertasExecutivos] Erro ao carregar alertas:', error.message);
        return { alertas: [], error: true, message: 'Alertas indisponíveis' };
      }
    },
    refetchInterval: 60000, // Atualiza a cada 1 minuto
    retry: 2 // Tentar 2 vezes antes de falhar
  });

  const alertas = resultado?.alertas || [];
  const totais = {
    criticos: resultado?.criticos || 0,
    altos: resultado?.altos || 0,
    medios: resultado?.medios || 0
  };

  // Filtrar por severidade
  const alertasFiltrados = tabAtiva === 'todos' ?
  alertas :
  alertas.filter((a) => a.severidade === tabAtiva);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Alertas Executivos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Alertas Executivos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={periodo.toString()} onValueChange={(v) => setPeriodo(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={obraId || 'todas'} onValueChange={(v) => setObraId(v === 'todas' ? null : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas as obras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as obras</SelectItem>
                {obras.map((obra) =>
                <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-4 mb-4">
            <TabsTrigger value="critico" className="relative">
              Críticos
              {totais.criticos > 0 &&
              <Badge className="ml-2 bg-red-600 text-white">{totais.criticos}</Badge>
              }
            </TabsTrigger>
            <TabsTrigger value="alto" className="relative">
              Altos
              {totais.altos > 0 &&
              <Badge className="ml-2 bg-orange-600 text-white">{totais.altos}</Badge>
              }
            </TabsTrigger>
            <TabsTrigger value="medio" className="relative">
              Médios
              {totais.medios > 0 &&
              <Badge className="ml-2 bg-yellow-600 text-white">{totais.medios}</Badge>
              }
            </TabsTrigger>
            <TabsTrigger value="todos">
              Todos ({alertas.length})
            </TabsTrigger>
          </TabsList>

          {['critico', 'alto', 'medio', 'todos'].map((tab) =>
          <TabsContent key={tab} value={tab} className="space-y-3">
              {alertasFiltrados.length === 0 ?
            <div className="text-center py-8 text-gray-500">
                  <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Nenhum alerta encontrado</p>
                </div> :

            alertasFiltrados.map((alerta, idx) => {
              const config = severidadeConfig[alerta.severidade];
              const tipoInfo = tipoConfig[alerta.tipo];
              const IconSeveridade = config.icon;
              const IconTipo = tipoInfo?.icon || AlertCircle;

              return (
                <div
                  key={idx} className={`p-4 rounded-lg border hover:shadow-md transition-shadow ${config.color}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <IconSeveridade className={`w-5 h-5 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <IconTipo className="w-4 h-4" />
                              <h4 className="font-semibold text-sm">{alerta.titulo}</h4>
                            </div>
                            <Badge variant="outline" className={`${config.color} px-2.5 py-0.5 text-xs font-semibold rounded-md border flex-shrink-0`}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm mb-2">{alerta.descricao}</p>
                          {alerta.obra_nome &&
                      <p className="text-xs text-gray-600 mb-2">
                              Obra: {alerta.obra_nome}
                            </p>
                      }
                          <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => navigate(alerta.rota)}>

                            Ver detalhes <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>);

            })
            }
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>);

}