import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, AlertTriangle, Package, Plus, Filter } from 'lucide-react';

const STATUS_CONFIG = {
  SUFICIENTE: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Suficiente' },
  PARCIAL: { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle, label: 'Parcial' },
  EM_FALTA: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Em Falta' },
  NAO_MAPEADO: { color: 'bg-gray-100 text-gray-800', icon: Package, label: 'ⓘ Não Mapeado' },
};

function MaterialCard({ necessidade, status, onGerarSolicitacao }) {
  const cfg = STATUS_CONFIG[status?.status || 'NAO_MAPEADO'];
  const Icon = cfg.icon;
  const estadoStatus = status?.status || 'NAO_MAPEADO';

  return (
    <Card className="border-l-4" style={{ borderLeftColor: estadoStatus === 'SUFICIENTE' ? '#10B981' : estadoStatus === 'PARCIAL' ? '#F59E0B' : estadoStatus === 'EM_FALTA' ? '#EF4444' : '#9CA3AF' }}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{necessidade.descricao || `Material #${necessidade.id.substring(0, 8)}`}</p>
            
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div>
                <p className="text-gray-400">Planejado</p>
                <p className="font-semibold text-gray-800">{necessidade.quantidade_prevista} {necessidade.unidade || 'un'}</p>
              </div>
              <div>
                <p className="text-gray-400">Disponível</p>
                <p className="font-semibold text-gray-800">{status?.quantidade_disponivel || 0}</p>
              </div>
              <div>
                <p className="text-gray-400">Faltante</p>
                <p className="font-semibold text-red-600">{status?.quantidade_faltante || 0}</p>
              </div>
            </div>

            {status?.percentual_disponivel !== undefined && (
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all" 
                  style={{
                    width: `${Math.min(100, status.percentual_disponivel)}%`,
                    backgroundColor: estadoStatus === 'SUFICIENTE' ? '#10B981' : estadoStatus === 'PARCIAL' ? '#F59E0B' : '#EF4444'
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge className={cfg.color}>
              <Icon className="w-3 h-3 mr-1" />
              {cfg.label}
            </Badge>

            {/* Botões com base no status */}
            {estadoStatus === 'SUFICIENTE' && (
              <Button 
                size="sm"
                disabled
                variant="ghost"
                className="text-xs text-green-600"
              >
                ✓ Material OK
              </Button>
            )}

            {(estadoStatus === 'EM_FALTA' || estadoStatus === 'PARCIAL') && (
              <Button 
                size="sm"
                onClick={() => onGerarSolicitacao(necessidade)}
                className="bg-blue-600 hover:bg-blue-700 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Solicitar
              </Button>
            )}

            {estadoStatus === 'NAO_MAPEADO' && (
              <Button 
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Mapear
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MaterialesObraTab({ obra_id }) {
  const [statuses, setStatuses] = useState({});
  const [filtro, setFiltro] = useState('todos'); // todos, ok, parciais, emFalta, naoMapeados, aSolicitar

  // Verificar se a obra possui orçamento vinculado
  const { data: orcamentos = [], isLoading: loadingOrcamento } = useQuery({
    queryKey: ['orcamento-obra-materiais', obra_id],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id }),
    enabled: !!obra_id,
    staleTime: 60000,
  });

  // Verificar se existem composições de insumos (analítico)
  const orcamentoAtivo = orcamentos[0] || null;
  const { data: composicoes = [], isLoading: loadingComposicoes } = useQuery({
    queryKey: ['composicoes-orc-materiais', orcamentoAtivo?.id],
    queryFn: () => base44.entities.ComposicaoInsumo.filter({ orcamento_id: orcamentoAtivo.id }),
    enabled: !!orcamentoAtivo?.id,
    staleTime: 60000,
  });

  // Buscar necessidades da obra
  const { data: necessidades = [], isLoading: loadingNecessidades } = useQuery({
    queryKey: ['necessidades_obra', obra_id],
    queryFn: () => base44.entities.NecessidadeMaterialObra.filter({ obra_id }),
    staleTime: 60000,
  });

  // Calcular status para cada necessidade
  useEffect(() => {
    if (necessidades.length === 0) return;

    const calcularTodos = async () => {
      const novosStatuses = {};
      for (const nec of necessidades) {
        try {
          const res = await base44.functions.invoke('calcularStatusMaterialNecessidade', {
            obra_id,
            necessidade_id: nec.id
          });
          novosStatuses[nec.id] = res.data;
        } catch (err) {
          console.warn('Erro ao calcular status:', nec.id, err.message);
          novosStatuses[nec.id] = { status: 'NAO_MAPEADO', quantidade_disponivel: 0, quantidade_faltante: nec.quantidade_prevista };
        }
      }
      setStatuses(novosStatuses);
    };

    calcularTodos();
  }, [necessidades, obra_id]);

  // Mutation para gerar solicitação
  const gerarSolicitacao = useMutation({
    mutationFn: async (necessidade) => {
      const status = statuses[necessidade.id];
      if (!status || status.quantidade_faltante <= 0) {
        throw new Error('Nenhuma quantidade a solicitar');
      }
      
      // Criar RequisicaoCompra com item faltante
      return base44.entities.RequisicaoCompra.create({
        titulo: `Solicitação - ${necessidade.descricao || 'Material'}`,
        obra_id,
        data_solicitacao: new Date().toISOString().split('T')[0],
        data_necessidade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        prioridade: status.status === 'EM_FALTA' ? 'alta' : 'normal',
        status: 'aguardando_aprovacao',
        itens: [{
          insumo_id: necessidade.insumo_id || '',
          descricao: necessidade.descricao || 'Material',
          unidade: necessidade.unidade || 'un',
          quantidade_solicitada: status.quantidade_faltante,
          quantidade_aprovada: status.quantidade_faltante,
          valor_estimado: (status.quantidade_faltante || 0) * (necessidade.valor_unitario_previsto || 0)
        }],
        qtd_itens: 1,
        valor_total_estimado: (status.quantidade_faltante || 0) * (necessidade.valor_unitario_previsto || 0),
      });
    },
    onSuccess: () => {
      toast.success('Solicitação de compra criada');
    },
    onError: (err) => toast.error(`Erro: ${err.message || err.response?.data?.error}`)
  });

  if (loadingNecessidades || loadingOrcamento || loadingComposicoes) {
    return <div className="text-center py-8 text-gray-500">Carregando materiais...</div>;
  }

  const temOrcamento = orcamentos.length > 0;
  const temComposicoes = composicoes.length > 0;

  if (necessidades.length === 0) {
    // Caso 1: Sem orçamento vinculado
    if (!temOrcamento) {
      return (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-700">Esta obra ainda não possui orçamento vinculado.</p>
            <p className="text-xs mt-2">Importe ou crie um orçamento para esta obra.</p>
          </CardContent>
        </Card>
      );
    }

    // Caso 2: Orçamento sintético (sem composição de insumos)
    if (temOrcamento && !temComposicoes) {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-400 opacity-70" />
            <p className="font-medium text-gray-700">Esta obra possui orçamento sintético.</p>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              Para gerar materiais planejados automaticamente é necessário um orçamento analítico com composição de insumos.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Orçamento: {orcamentoAtivo?.titulo || 'Sem título'} — Versão {orcamentoAtivo?.versao || '1'}
            </p>
          </CardContent>
        </Card>
      );
    }

    // Caso 3: Orçamento analítico mas sem necessidades geradas ainda
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-700">Nenhum material planejado gerado ainda.</p>
          <p className="text-xs mt-2">O orçamento analítico está vinculado. Gere o planejamento de materiais a partir das composições.</p>
        </CardContent>
      </Card>
    );
  }

  const resumo = {
    total: necessidades.length,
    suficiente: Object.values(statuses).filter(s => s.status === 'SUFICIENTE').length,
    parcial: Object.values(statuses).filter(s => s.status === 'PARCIAL').length,
    emFalta: Object.values(statuses).filter(s => s.status === 'EM_FALTA').length,
    naoMapeado: Object.values(statuses).filter(s => s.status === 'NAO_MAPEADO').length,
  };

  // Aplicar filtro
  const necessidadesFiltradas = necessidades.filter(nec => {
    const st = statuses[nec.id]?.status || 'NAO_MAPEADO';
    
    switch (filtro) {
      case 'ok': return st === 'SUFICIENTE';
      case 'parciais': return st === 'PARCIAL';
      case 'emFalta': return st === 'EM_FALTA';
      case 'naoMapeados': return st === 'NAO_MAPEADO';
      case 'aSolicitar': return st === 'EM_FALTA' || st === 'PARCIAL';
      default: return true; // todos
    }
  });

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Total', value: resumo.total, color: 'text-gray-700' },
          { label: 'OK', value: resumo.suficiente, color: 'text-green-600' },
          { label: 'Parcial', value: resumo.parcial, color: 'text-yellow-600' },
          { label: 'Falta', value: resumo.emFalta, color: 'text-red-600' },
          { label: 'Não Mape.', value: resumo.naoMapeado, color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap bg-gray-50 p-3 rounded-lg">
        <Filter className="w-4 h-4 text-gray-500" />
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'ok', label: 'OK' },
          { key: 'parciais', label: 'Parciais' },
          { key: 'emFalta', label: 'Em Falta' },
          { key: 'naoMapeados', label: 'ⓘ Não Mapeados' },
          { key: 'aSolicitar', label: 'A Solicitar' },
        ].map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={filtro === key ? 'default' : 'outline'}
            onClick={() => setFiltro(key)}
            className="text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Materiais Filtrados */}
      {necessidadesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum material nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {necessidadesFiltradas.map(nec => (
            <MaterialCard 
              key={nec.id}
              necessidade={nec}
              status={statuses[nec.id]}
              onGerarSolicitacao={(n) => gerarSolicitacao.mutate(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}