import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Calendar, Filter, RotateCcw, User } from 'lucide-react';
import { format } from 'date-fns';

export default function FiltrosDesempenhoProfissional({
  profissionalId,
  obraId,
  dataInicio,
  dataFim,
  onFiltro,
  onLimpar
}) {
  const [localProfId, setLocalProfId] = useState(profissionalId || '');
  const [localObraId, setLocalObraId] = useState(obraId || '');
  const [localDataInicio, setLocalDataInicio] = useState(dataInicio || '');
  const [localDataFim, setLocalDataFim] = useState(dataFim || '');

  // Buscar profissionais
  const { data: profissionais = [] } = useQuery({
    queryKey: ['colaboradores-list'],
    queryFn: () => base44.entities.Colaborador.list('-updated_date', 1000),
    select: (data) =>
      data
        .filter((c) => c.status === 'ativo')
        .sort((a, b) => a.nome.localeCompare(b.nome))
  });

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list-desempenho'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000),
    select: (data) =>
      data
        .filter((o) => o.status !== 'cancelada')
        .sort((a, b) => a.nome.localeCompare(b.nome))
  });

  const handleAplicar = () => {
    if (!localProfId) {
      return;
    }
    onFiltro({
      profissionalId: localProfId,
      obraId: localObraId || null,
      dataInicio: localDataInicio || null,
      dataFim: localDataFim || null
    });
  };

  const handleLimpar = () => {
    setLocalProfId('');
    setLocalObraId('');
    setLocalDataInicio('');
    setLocalDataFim('');
    onLimpar();
  };

  return (
    <Card className="bg-gray-800 border-gray-700 mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Profissional */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-2 block">
              <User className="inline w-3 h-3 mr-1" />
              Profissional *
            </label>
            <Select value={localProfId} onValueChange={setLocalProfId}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {profissionais.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Início */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-2 block">
              <Calendar className="inline w-3 h-3 mr-1" />
              Data Início
            </label>
            <Input
              type="date"
              value={localDataInicio}
              onChange={(e) => setLocalDataInicio(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-2 block">
              <Calendar className="inline w-3 h-3 mr-1" />
              Data Fim
            </label>
            <Input
              type="date"
              value={localDataFim}
              onChange={(e) => setLocalDataFim(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Obra (opcional) */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-2 block">
              Obra (opcional)
            </label>
            <Select value={localObraId} onValueChange={setLocalObraId}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todas as obras</SelectItem>
                {obras.map((obra) => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex gap-2 items-end">
            <Button
              onClick={handleAplicar}
              disabled={!localProfId}
              className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Filter className="w-4 h-4" />
              Aplicar
            </Button>
            <Button
              onClick={handleLimpar}
              variant="outline"
              className="border-gray-600 text-gray-300"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Deixe datas em branco para ver todo o histórico
        </p>
      </CardContent>
    </Card>
  );
}