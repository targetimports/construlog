import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Calendar, CheckCircle2, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MarcoStatusActions from '../cronograma/MarcoStatusActions';
import AtividadeManualModal from '../cronograma/AtividadeManualModal';
import AtividadeManualActions from '../cronograma/AtividadeManualActions';

export default function CronogramaObraTab({ obraId, user }) {
  const [cronogramaItems, setCronogramaItems] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filtro, setFiltro] = useState('todos'); // 'todos' | 'importados' | 'manuais'

  const PERFIS_EDIT = ['admin', 'programador', 'engenharia', 'engenheiro', 'supervisor', 'encarregado', 'gestor', 'mestre', 'mestre_obra', 'mestre_de_obra', 'owner', 'superadmin'];
  const canEdit = !user || PERFIS_EDIT.includes(user?.role) || PERFIS_EDIT.includes(user?.perfil_acesso);

  // Buscar CronogramaItem do banco
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cronograma-items', obraId],
    queryFn: async () => {
      console.log('[CronogramaObraTab] Buscando cronograma para obraId:', obraId);
      
      try {
        const items = await base44.entities.CronogramaItem.filter(
          { obra_id: obraId },
          '-created_date',
          100
        );
        
        console.log('[CronogramaObraTab] Items encontrados:', items);
        
        // Atualizar debug info
        setDebugInfo({
          obraId,
          source: 'CronogramaItem',
          found: items?.length || 0,
          firstIds: items?.slice(0, 3)?.map(i => i.id) || [],
          error: null
        });
        
        return items || [];
      } catch (err) {
        console.error('[CronogramaObraTab] Erro ao buscar:', err);
        
        // Atualizar debug info com erro
        setDebugInfo({
          obraId,
          source: 'CronogramaItem',
          found: 0,
          firstIds: [],
          error: err.message
        });
        
        return [];
      }
    },
    enabled: !!obraId
  });

  useEffect(() => {
    if (data) {
      setCronogramaItems(data);
    }
  }, [data]);

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Carregando cronograma...</div>;
  }

  if (error) {
    return (
      <Card className="bg-red-50 border border-red-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Erro ao carregar cronograma</p>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const itensFiltrados = cronogramaItems.filter(item => {
    if (filtro === 'importados') return item.origem !== 'MANUAL' && !item.manual;
    if (filtro === 'manuais') return item.origem === 'MANUAL' || item.manual === true;
    return true;
  });

  const HeaderBar = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      {/* Filtros */}
      <div className="flex gap-1">
        {[['todos','Todos'], ['importados','Importados'], ['manuais','Manuais']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltro(val)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filtro === val
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-1 h-8">
          <RefreshCw className="w-3 h-3" />
        </Button>
        {canEdit && (
          <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1 h-8">
            <Plus className="w-4 h-4" />
            Adicionar Atividade
          </Button>
        )}
      </div>
    </div>
  );

  if (!cronogramaItems || cronogramaItems.length === 0) {
    return (
      <div className="space-y-4">
        <HeaderBar />

        {/* MENSAGEM VAZIO */}
        <Card className="bg-blue-50 border border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-800 font-medium">Nenhum cronograma importado</p>
                <p className="text-blue-700 text-sm">Importe pelo OrçaFascio ou adicione atividades manualmente.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {canEdit && (
          <AtividadeManualModal
            open={showAddModal}
            onClose={() => setShowAddModal(false)}
            obraId={obraId}
            existingItems={cronogramaItems}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderBar />

      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Cronograma da Obra</CardTitle>
        </CardHeader>
        <CardContent>
          {itensFiltrados.length === 0 && (
            <p className="text-center text-gray-500 py-6 text-sm">Nenhuma atividade nesta categoria.</p>
          )}
          <div className="space-y-3">
            {itensFiltrados.map((item) => {
              const isManual = item.origem === 'MANUAL' || item.manual === true;
              const dataInicio = item.dataInicioPlanejada ? new Date(item.dataInicioPlanejada) : null;
              const dataFim = item.dataFimPlanejada ? new Date(item.dataFimPlanejada) : null;
              const percentualConcluido = item.percentualConcluido || 0;
              const diasRestantes = dataFim 
                ? Math.ceil((dataFim - new Date()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {/* Cabeçalho */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900">{item.nomeAtividade || 'Atividade'}</h4>
                        {isManual && (
                          <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50">
                            Manual
                          </Badge>
                        )}
                        {item.item && (
                          <span className="text-xs text-gray-400 font-mono">{item.item}</span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        {dataInicio && (
                          <span>
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Início: {dataInicio.toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {dataFim && (
                          <span>
                            Fim: {dataFim.toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {percentualConcluido === 100 && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      <MarcoStatusActions
                        item={item}
                        obraId={obraId}
                        canEdit={canEdit}
                      />
                      {isManual && canEdit && (
                        <AtividadeManualActions
                          item={item}
                          obraId={obraId}
                          existingItems={cronogramaItems}
                        />
                      )}
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Quantidade</p>
                      <p className="font-semibold text-gray-900">
                        {item.quantidadePlanejada || 0} {item.und || 'un'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Progresso</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${Math.min(percentualConcluido, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 min-w-fit">
                          {percentualConcluido || 0}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="font-semibold text-gray-900 capitalize">
                        {item.status || 'Não iniciado'}
                      </p>
                    </div>
                    {diasRestantes !== null && (
                      <div>
                        <p className="text-xs text-gray-500">Dias Restantes</p>
                        <p className={`font-semibold ${diasRestantes <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {diasRestantes > 0 ? `${diasRestantes} dias` : 'Atrasado'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Observações */}
                  {item.observacoes && (
                    <p className="text-xs text-gray-600 mt-3 p-2 bg-white rounded border border-gray-200">
                      <strong>Obs:</strong> {item.observacoes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <AtividadeManualModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          obraId={obraId}
          existingItems={cronogramaItems}
        />
      )}

      {/* Resumo */}
      {cronogramaItems.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600">Total de Atividades</p>
                <p className="text-2xl font-bold text-gray-900">{cronogramaItems.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">
                  {cronogramaItems.filter(i => i.percentualConcluido === 100).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-600">
                  {cronogramaItems.filter(i => i.percentualConcluido > 0 && i.percentualConcluido < 100).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Progresso Médio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(
                    cronogramaItems.reduce((sum, i) => sum + (i.percentualConcluido || 0), 0) /
                    cronogramaItems.length
                  )}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}