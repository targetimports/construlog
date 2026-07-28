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
import { Plus, Eye, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FormVistoria from '../components/frota/FormVistoria';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function FrotaVistoria() {
  const [formOpen, setFormOpen] = useState(false);
  const [searchPlaca, setSearchPlaca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [selectedVistoria, setSelectedVistoria] = useState(null);

  // Buscar vistorias
  const { data: vistorias = [], isLoading: vistoriasLoading } = useQuery({
    queryKey: ['vistorias'],
    queryFn: () => base44.entities.Vistoria.list('-data_hora', 1000)
  });

  // Buscar veículos para mapear
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-vistoria'],
    queryFn: () => base44.entities.Veiculo.list('-updated_date', 500)
  });

  // Criar mapa de veículos
  const veiculoMap = useMemo(() => {
    const mapa = {};
    veiculos.forEach((v) => {
      mapa[v.id] = v;
    });
    return mapa;
  }, [veiculos]);

  // Filtrar vistorias
  const vistoriasFiltradas = useMemo(() => {
    let filtered = vistorias;

    // Filtro por tipo
    if (tipoFiltro) {
      filtered = filtered.filter((v) => v.tipo === tipoFiltro);
    }

    // Filtro por placa
    if (searchPlaca.trim()) {
      const search = searchPlaca.toLowerCase();
      filtered = filtered.filter((v) => {
        const veiculo = veiculoMap[v.veiculo_id];
        return veiculo?.placa?.toLowerCase().includes(search);
      });
    }

    return filtered;
  }, [vistorias, searchPlaca, tipoFiltro, veiculoMap]);

  if (formOpen && !selectedVistoria) {
    return <FormVistoria onCancelada={() => setFormOpen(false)} />;
  }

  if (selectedVistoria) {
    return (
      <VistoriaDetalhes
        vistoria={selectedVistoria}
        veiculo={veiculoMap[selectedVistoria.veiculo_id]}
        onVoltar={() => setSelectedVistoria(null)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Vistorias de Veículo</h1>
        <p className="text-gray-400 mt-1">Registro de SAÍDA e RETORNO com checklist</p>
      </div>

      {/* Filtros */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Busca */}
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 block">
                <Search className="inline w-3 h-3 mr-1" />
                Placa do Veículo
              </label>
              <Input
                value={searchPlaca}
                onChange={(e) => setSearchPlaca(e.target.value)}
                placeholder="ABC-1234"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 block">Tipo</label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  <SelectItem value="SAIDA">▶Saída</SelectItem>
                  <SelectItem value="RETORNO">◀Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Novo */}
            <div className="flex items-end">
              <Button
                onClick={() => setFormOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Plus className="w-4 h-4" />
                Nova Vistoria
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Vistorias ({vistoriasFiltradas.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {vistoriasLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : vistoriasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Nenhuma vistoria encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                      Data/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Placa</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-semibold">KM</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                      Responsável
                    </th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vistoriasFiltradas.map((vistoria) => {
                    const veiculo = veiculoMap[vistoria.veiculo_id];
                    return (
                      <tr key={vistoria.id} className="border-b border-gray-700 hover:bg-gray-700/20">
                        {/* Data */}
                        <td className="px-4 py-3 text-gray-300">
                          <div className="font-medium">
                            {format(parseISO(vistoria.data_hora), 'dd MMM HH:mm', {
                              locale: ptBR
                            })}
                          </div>
                        </td>

                        {/* Placa */}
                        <td className="px-4 py-3">
                          <span className="font-semibold text-white">{veiculo?.placa}</span>
                          <div className="text-xs text-gray-500">{veiculo?.modelo}</div>
                        </td>

                        {/* Tipo */}
                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={
                              vistoria.tipo === 'SAIDA'
                                ? 'bg-orange-900/30 text-orange-400 border-0'
                                : 'bg-green-900/30 text-green-400 border-0'
                            }
                          >
                            {vistoria.tipo === 'SAIDA' ? '▶Saída' : '◀Retorno'}
                          </Badge>
                        </td>

                        {/* KM */}
                        <td className="px-4 py-3 text-center text-white font-medium">
                          {vistoria.km} km
                        </td>

                        {/* Responsável */}
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {vistoria.responsavel_id}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-right">
                          <Button
                            onClick={() => setSelectedVistoria(vistoria)}
                            size="icon"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
function VistoriaDetalhes({ vistoria, veiculo, onVoltar }) {
  const { data: itens = [] } = useQuery({
    queryKey: ['vistoria-itens', vistoria.id],
    queryFn: () => base44.entities.VistoriaItem.filter({ vistoria_id: vistoria.id })
  });

  const { data: midias = [] } = useQuery({
    queryKey: ['vistoria-midias', vistoria.id],
    queryFn: () => base44.entities.VistoriaMidia.filter({ vistoria_id: vistoria.id })
  });

  const problemas = itens.filter((i) => i.status === 'PROBLEMA').length;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-3">
        <Button onClick={onVoltar} variant="ghost" className="text-gray-400">
          ← Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Vistoria de {veiculo?.placa}
          </h1>
          <p className="text-gray-400 text-sm">
            {format(parseISO(vistoria.data_hora), 'dd MMM yyyy HH:mm', { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Informações básicas */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Informações</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Tipo</p>
            <Badge
              className={
                vistoria.tipo === 'SAIDA'
                  ? 'bg-orange-900/30 text-orange-400 border-0 mt-1'
                  : 'bg-green-900/30 text-green-400 border-0 mt-1'
              }
            >
              {vistoria.tipo === 'SAIDA' ? '▶Saída' : '◀Retorno'}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-400">Quilometragem</p>
            <p className="text-white font-semibold mt-1">{vistoria.km} km</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Responsável</p>
            <p className="text-white font-semibold text-sm mt-1">{vistoria.responsavel_id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Problemas</p>
            <Badge
              className={
                problemas > 0
                  ? 'bg-red-900/30 text-red-400 border-0 mt-1'
                  : 'bg-green-900/30 text-green-400 border-0 mt-1'
              }
            >
              {problemas} problemas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {itens.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded bg-gray-700/20"
              >
                <span className="text-gray-300">{item.item_nome}</span>
                <Badge
                  className={
                    item.status === 'OK'
                      ? 'bg-green-900/30 text-green-400 border-0'
                      : item.status === 'PROBLEMA'
                        ? 'bg-red-900/30 text-red-400 border-0'
                        : 'bg-gray-900/30 text-gray-400 border-0'
                  }
                >
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fotos */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Fotos ({midias.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {midias.map((media) => (
              <div key={media.id} className="rounded overflow-hidden border border-gray-700">
                <img
                  src={media.arquivo_url}
                  alt={media.legenda}
                  className="w-full h-40 object-cover"
                />
                <p className="text-xs text-gray-400 p-2">{media.legenda}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}