import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Filter, X } from 'lucide-react';

export default function FiltrosDreObra({ onFiltrarChange, onLimpar }) {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [obraId, setObraId] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  const handleAplicar = () => {
    onFiltrarChange({ obra_id: obraId, de: de || undefined, ate: ate || undefined });
    setFiltrosAplicados(true);
  };

  const handleLimpar = () => {
    setDe('');
    setAte('');
    setObraId('');
    setFiltrosAplicados(false);
    onLimpar();
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filtros DRE
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Obra</label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Selecionar obra...</option>
              {obras.map(obra => (
                <option key={obra.id} value={obra.id}>
                  {obra.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">De</label>
            <Input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="h-11"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Até</label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              onClick={handleAplicar}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
              disabled={!obraId}
            >
              Aplicar
            </Button>
            {filtrosAplicados && (
              <Button
                onClick={handleLimpar}
                variant="outline"
                className="h-11 w-11 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {filtrosAplicados && (
          <div className="text-sm text-gray-600">
            Filtros aplicados: Obra selecionada {de && `de ${de}`} {ate && `até ${ate}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}