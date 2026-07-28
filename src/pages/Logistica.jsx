import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FormMovimentacaoAbertura from '../components/logistica/FormMovimentacaoAbertura';
import FormMovimentacaoFechamento from '../components/logistica/FormMovimentacaoFechamento';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function Logistica() {
  const [view, setView] = useState('list'); // list, abertura, fechamento, detalhe
  const [selectedMovimentacao, setSelectedMovimentacao] = useState(null);
  const [searchPlaca, setSearchPlaca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');

  // Buscar movimentações
  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['movimentacoes'],
    queryFn: () => base44.entities.MovimentacaoVeiculo.list('-saida_hora', 1000)
  });

  // Buscar veículos
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-lista'],
    queryFn: () => base44.entities.Veiculo.list('-updated_date', 500)
  });

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-lista'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000)
  });

  // Mapas para busca rápida
  const veiculoMap = useMemo(() => {
    const map = {};
    veiculos.forEach((v) => {
      map[v.id] = v;
    });
    return map;
  }, [veiculos]);

  const obraMap = useMemo(() => {
    const map = {};
    obras.forEach((o) => {
      map[o.id] = o;
    });
    return map;
  }, [obras]);

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    let filtered = movimentacoes;

    // Status
    if (statusFiltro) {
      filtered = filtered.filter((m) => m.status === statusFiltro);
    }

    // Placa
    if (searchPlaca.trim()) {
      const search = searchPlaca.toLowerCase();
      filtered = filtered.filter((m) => {
        const veiculo = veiculoMap[m.veiculo_id];
        return veiculo?.placa?.toLowerCase().includes(search);
      });
    }

    return filtered;
  }, [movimentacoes, statusFiltro, searchPlaca, veiculoMap]);

  // Views
  if (view === 'abertura') {
    return (
      <FormMovimentacaoAbertura
        onCancelada={() => setView('list')}
        onSucesso={() => setView('list')}
      />
    );
  }

  if (view === 'fechamento' && selectedMovimentacao) {
    return (
      <FormMovimentacaoFechamento
        movimentacao={selectedMovimentacao}
        veiculo={veiculoMap[selectedMovimentacao.veiculo_id]}
        obraOrigem={obraMap[selectedMovimentacao.obra_origem_id]}
        obraDestino={obraMap[selectedMovimentacao.obra_destino_id]}
        onCancelada={() => setView('list')}
        onSucesso={() => {
          setView('list');
          setSelectedMovimentacao(null);
        }}
      />
    );
  }

  if (view === 'detalhe' && selectedMovimentacao) {
    return (
      <MovimentacaoDetalhe
        movimentacao={selectedMovimentacao}
        veiculo={veiculoMap[selectedMovimentacao.veiculo_id]}
        obraOrigem={obraMap[selectedMovimentacao.obra_origem_id]}
        obraDestino={obraMap[selectedMovimentacao.obra_destino_id]}
        onVoltar={() => {
          setView('list');
          setSelectedMovimentacao(null);
        }}
      />
    );
  }

  // View Principal: Listagem
  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Movimentações de Veículos</h1>
        <p className="text-gray-400 mt-1">Controle de saídas e retornos</p>
      </div>

      {/* Filtros */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 block">Placa</label>
              <Input
                value={searchPlaca}
                onChange={(e) => setSearchPlaca(e.target.value)}
                placeholder="ABC-1234"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 block">Status</label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="FECHADA">Fechada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => setView('abertura')}
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Plus className="w-4 h-4" />
                Abrir Movimentação
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Movimentações ({movimentacoesFiltradas.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : movimentacoesFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Nenhuma movimentação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Saída</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Veículo</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-semibold">KM</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Motivo</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoesFiltradas.map((mov) => {
                    const veiculo = veiculoMap[mov.veiculo_id];
                    const kmRodado = mov.km_final
                      ? (mov.km_final - mov.km_inicial).toFixed(2)
                      : '—';

                    return (
                      <tr key={mov.id} className="border-b border-gray-700 hover:bg-gray-700/20">
                        <td className="px-4 py-3 text-gray-300 text-xs">
                          {format(parseISO(mov.saida_hora), 'dd MMM HH:mm', { locale: ptBR })}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{veiculo?.placa}</div>
                          <div className="text-xs text-gray-500">{veiculo?.modelo}</div>
                        </td>

                        <td className="px-4 py-3 text-center text-white font-medium">
                          {mov.km_inicial} → {mov.km_final || '?'}
                          <div className="text-xs text-gray-400">{kmRodado} km</div>
                        </td>

                        <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-xs">
                          {mov.motivo}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={
                              mov.status === 'ABERTA'
                                ? 'bg-green-900/30 text-green-400 border-0'
                                : 'bg-gray-900/30 text-gray-400 border-0'
                            }
                          >
                            {mov.status === 'ABERTA' ? 'Aberta' : 'Fechada'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-right flex gap-2 justify-end">
                          <Button
                            onClick={() => {
                              setSelectedMovimentacao(mov);
                              setView('detalhe');
                            }}
                            size="icon"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {mov.status === 'ABERTA' && (
                            <Button
                              onClick={() => {
                                setSelectedMovimentacao(mov);
                                setView('fechamento');
                              }}
                              size="icon"
                              variant="ghost"
                              className="text-green-400 hover:text-green-300"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de detalhe
function MovimentacaoDetalhe({ movimentacao, veiculo, obraOrigem, obraDestino, onVoltar }) {
  const { data: midias = [] } = useQuery({
    queryKey: ['mov-midias', movimentacao.id],
    queryFn: () =>
      base44.entities.MovimentacaoVeiculoMidia.filter({
        movimentacao_id: movimentacao.id
      })
  });

  const duracao =
    movimentacao.status === 'FECHADA' && movimentacao.retorno_hora
      ? Math.round(
          (new Date(movimentacao.retorno_hora) - new Date(movimentacao.saida_hora)) / 60000
        )
      : null;

  const kmRodado =
    movimentacao.status === 'FECHADA'
      ? (movimentacao.km_final - movimentacao.km_inicial).toFixed(2)
      : '—';

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-3">
        <Button onClick={onVoltar} variant="ghost" className="text-gray-400">
          ← Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Movimentação {veiculo?.placa}
          </h1>
          <p className="text-gray-400 text-sm">
            {format(parseISO(movimentacao.saida_hora), 'dd MMM yyyy HH:mm', { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Resumo */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Informações</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Status</p>
            <Badge
              className={
                movimentacao.status === 'ABERTA'
                  ? 'bg-green-900/30 text-green-400 border-0 mt-1'
                  : 'bg-gray-900/30 text-gray-400 border-0 mt-1'
              }
            >
              {movimentacao.status === 'ABERTA' ? 'Aberta' : 'Fechada'}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-400">KM Rodado</p>
            <p className="text-white font-semibold mt-1">{kmRodado} km</p>
          </div>
          {duracao && (
            <div>
              <p className="text-xs text-gray-400">Duração</p>
              <p className="text-white font-semibold mt-1">
                {Math.floor(duracao / 60)}h {duracao % 60}m
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Responsável</p>
            <p className="text-white font-semibold text-sm mt-1">
              {movimentacao.responsavel_id}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Locais */}
      {(obraOrigem || obraDestino) && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Locais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            {obraOrigem && (
              <div>
                <p className="text-gray-400 text-xs">Origem</p>
                <p className="text-white font-semibold mt-1">{obraOrigem.nome}</p>
              </div>
            )}
            {obraDestino && (
              <div>
                <p className="text-gray-400 text-xs">Destino</p>
                <p className="text-white font-semibold mt-1">{obraDestino.nome}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Motivo */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Motivo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300 whitespace-pre-wrap">{movimentacao.motivo}</p>
        </CardContent>
      </Card>

      {/* Mídia */}
      {midias.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Mídia ({midias.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {midias.map((media) => (
                <div key={media.id} className="rounded overflow-hidden border border-gray-700">
                  {media.tipo === 'FOTO' ? (
                    <img
                      src={media.arquivo_url}
                      alt={media.legenda}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gray-700 flex items-center justify-center text-gray-400">
                      Vídeo
                    </div>
                  )}
                  <p className="text-xs text-gray-400 p-2">{media.legenda}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}