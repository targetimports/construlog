import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, AlertCircle } from 'lucide-react';

export default function SeletorObraTopbar() {
  const { obraAtual, setContexto, isLoading } = useGlobalContext();
  const [isChanging, setIsChanging] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-lista'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 50),
    staleTime: 1000 * 60
  });

  const handleObraChange = async (obraId) => {
    setIsChanging(true);
    try {
      await setContexto(obraId);
    } catch (error) {
      console.error('Erro ao mudar obra:', error);
    } finally {
      setIsChanging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Carregando...</span>
      </div>
    );
  }

  if (!obraAtual) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-700">Selecione uma obra</span>
      </div>
    );
  }

  return (
    <Select 
      value={obraAtual.id} 
      onValueChange={handleObraChange}
      disabled={isChanging}
    >
      <SelectTrigger className="w-64 bg-white border-gray-200">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <SelectValue placeholder="Selecione uma obra" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {obras.length === 0 ? (
          <div className="p-2 text-sm text-gray-500">Nenhuma obra encontrada</div>
        ) : (
          obras.map(obra => (
            <SelectItem key={obra.id} value={obra.id}>
              <div className="flex flex-col">
                <span className="font-medium">{obra.nome_obra || obra.nome}</span>
                <span className="text-xs text-gray-500">{obra.codigo_obra || obra.id.substring(0, 8)}</span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}