import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar, Users, Cloud, AlertCircle, Plus } from 'lucide-react';
import FiltrosDiarioAvancado from '../components/diario/FiltrosDiarioAvancado';
import RelatoriosPainelDiario from '../components/diario/RelatoriosPainelDiario';
import RelatorioRateioMensal from '../components/diario/RelatorioRateioMensal';
import FiltroAplicadoBanner from '../components/shared/FiltroAplicadoBanner';
import DiarioObraFormNovo from '../components/diario/DiarioObraFormNovo';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function DiarioObra() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="DIARIO_CREATE">
      <DiarioObraContent />
    </RouteGuardFinalV2>
  );
}

function DiarioObraContent() {
  const [showFormNovo, setShowFormNovo] = useState(false);
  const [diarioEditando, setDiarioEditando] = useState(null);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [obraBannerNome, setObraBannerNome] = useState('');

  const [filtros, setFiltros] = useState({
    obra_id: '',
    dataInicio: '',
    dataFim: '',
    colaborador_id: '',
    equipamento_id: '',
    temOcorrencias: false,
    status: 'todos',
    busca: ''
  });

  // Ler query params na inicialização (drill-down)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const origem = params.get('origem');
    
    if (origem === 'planejado_vs_real') {
      const obraId = params.get('obra_id');
      
      if (obraId) {
        setFiltros(prev => ({
          ...prev,
          obra_id: obraId
        }));
        setMostrarBanner(true);
      }
    }
  }, []);

  // Construir query para backend (performance)
  const construirQuery = () => {
    const query = {};
    if (filtros.obra_id) query.obra_id = filtros.obra_id;
    if (filtros.status && filtros.status !== 'todos') query.status = filtros.status;
    return query;
  };

  const { data: diarios = [], isLoading } = useQuery({
    queryKey: ['diarios-obra', filtros],
    queryFn: async () => {
      const query = construirQuery();
      // Busca o conjunto completo (filtra/pagina no cliente) para a paginação
      // refletir o total real, e não só a primeira página.
      const resultado = await base44.entities.DiarioObra.filter(query, '-data', 2000);
      
      // Filtros adicionais no frontend (quando não suportados pelo backend)
      let filtrados = resultado;

      // Filtro de período
      if (filtros.dataInicio || filtros.dataFim) {
        filtrados = filtrados.filter(d => {
          if (!d.data) return false;
          if (filtros.dataInicio && d.data < filtros.dataInicio) return false;
          if (filtros.dataFim && d.data > filtros.dataFim) return false;
          return true;
        });
      }

      // Filtro de colaborador
      if (filtros.colaborador_id) {
        filtrados = filtrados.filter(d => 
          d.mao_obra?.some(m => m.colaborador_id === filtros.colaborador_id)
        );
      }

      // Filtro de equipamento
      if (filtros.equipamento_id) {
        filtrados = filtrados.filter(d =>
          d.equipamentos?.some(e => e.equipamento_id === filtros.equipamento_id)
        );
      }

      // Filtro de ocorrências
      if (filtros.temOcorrencias) {
        filtrados = filtrados.filter(d => d.ocorrencias || d.ocorrencias_detalhadas?.length > 0);
      }

      // Busca por texto
      if (filtros.busca) {
        const termo = filtros.busca.toLowerCase();
        filtrados = filtrados.filter(d =>
          d.atividades_realizadas?.toLowerCase().includes(termo) ||
          d.observacoes?.toLowerCase().includes(termo) ||
          d.ocorrencias?.toLowerCase().includes(termo)
        );
      }

      return filtrados;
    }
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const obraMap = Object.fromEntries(obras.map(o => [o.id, o.nome]));

  // Atualizar nome da obra no banner
  useEffect(() => {
    if (filtros.obra_id && obras.length > 0) {
      const obra = obras.find(o => o.id === filtros.obra_id);
      if (obra) setObraBannerNome(obra.nome);
    }
  }, [filtros.obra_id, obras]);

  // Paginação (padrão do sistema)
  const pag = usePagination(diarios, 15);
  // Sempre que os filtros mudam, volta para a 1ª página.
  useEffect(() => { pag.goToPage(1); }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtData = (d) => {
    if (!d) return '—';
    const dt = new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
  };
  const isConcluido = (d) => d.status_registro === 'CONCLUIDO' || d.status === 'finalizado';
  const temOcorrencia = (d) => !!(d.ocorrencias || d.ocorrencias_detalhadas?.length > 0);

  const limparFiltrosBanner = () => {
    setFiltros({
      obra_id: '',
      dataInicio: '',
      dataFim: '',
      colaborador_id: '',
      equipamento_id: '',
      temOcorrencias: false,
      status: 'todos',
      busca: ''
    });
    setMostrarBanner(false);
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Diário de Obra</h1>
          <p className="text-gray-600 mt-1 hidden sm:block">Acompanhamento diário das atividades</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 [&>*]:w-full sm:[&>*]:w-auto">
          <RelatorioRateioMensal />
          <RelatoriosPainelDiario />
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setDiarioEditando(null); setShowFormNovo(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Diário
          </Button>
        </div>
      </div>

      {/* Modal Novo/Editar Diário */}
      <Dialog open={showFormNovo} onOpenChange={setShowFormNovo}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden">
          <div className="p-6">
            <DiarioObraFormNovo
              diario={diarioEditando}
              onClose={() => { setShowFormNovo(false); setDiarioEditando(null); }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Banner de filtro aplicado */}
      {mostrarBanner && (
        <FiltroAplicadoBanner
          obraNome={obraBannerNome}
          dataInicio={filtros.dataInicio}
          dataFim={filtros.dataFim}
          onLimpar={limparFiltrosBanner}
        />
      )}

      {/* Filtros Avançados */}
      <FiltrosDiarioAvancado
        filtros={filtros}
        onFiltrosChange={(f) => setFiltros(f)}
        onLimpar={() => {
          setFiltros({
            obra_id: '',
            dataInicio: '',
            dataFim: '',
            colaborador_id: '',
            equipamento_id: '',
            temOcorrencias: false,
            status: 'todos',
            busca: ''
          });
        }}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Diários Registrados</p>
              <p className="text-2xl font-bold">{diarios.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Colaboradores Total</p>
              <p className="text-2xl font-bold">
                {new Set(diarios.flatMap(d => d.mao_obra?.map(m => m.colaborador_id) || [])).size}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Cloud className="w-8 h-8 text-cyan-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Dias Registrados</p>
              <p className="text-2xl font-bold">{new Set(diarios.map(d => d.data)).size}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Ocorrências</p>
              <p className="text-2xl font-bold">
                {diarios.filter(d => d.ocorrencias || d.ocorrencias_detalhadas?.length > 0).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Diários */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={8} cols={6} />
          ) : diarios.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              Nenhum diário encontrado com os filtros aplicados
            </div>
          ) : (
            <>
              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Clima</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Funcionários</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ocorrências</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pag.paginatedItems.map(diario => (
                      <tr key={diario.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{fmtData(diario.data)}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={obraMap[diario.obra_id] || ''}>
                          {obraMap[diario.obra_id] || 'Obra não identificada'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{diario.clima || '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{diario.mao_obra?.length || 0}</td>
                        <td className="px-4 py-3">
                          <Badge className={`border-0 ${isConcluido(diario) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isConcluido(diario) ? 'Concluído' : 'Rascunho'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {temOcorrencia(diario)
                            ? <Badge className="border-0 bg-orange-100 text-orange-800">Sim</Badge>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => { setDiarioEditando(diario); setShowFormNovo(true); }}>
                            {isConcluido(diario) ? 'Ver' : 'Editar'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {pag.paginatedItems.map(diario => (
                  <div key={diario.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{fmtData(diario.data)}</span>
                          <Badge className={`border-0 text-xs ${isConcluido(diario) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isConcluido(diario) ? 'Concluído' : 'Rascunho'}
                          </Badge>
                          {temOcorrencia(diario) && (
                            <Badge className="border-0 text-xs bg-orange-100 text-orange-800">Ocorrência</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 truncate mt-1" title={obraMap[diario.obra_id] || ''}>
                          {obraMap[diario.obra_id] || 'Obra não identificada'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="capitalize">{diario.clima || '—'}</span> · {diario.mao_obra?.length || 0} funcionário(s)
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => { setDiarioEditando(diario); setShowFormNovo(true); }}>
                        {isConcluido(diario) ? 'Ver' : 'Editar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={pag.currentPage}
                totalPages={pag.totalPages}
                onPageChange={pag.goToPage}
                startIndex={pag.startIndex}
                endIndex={pag.endIndex}
                totalItems={pag.totalItems}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}