import React, { useState } from 'react';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

export default function SeletorObraGlobal() {
  const { obraAtual, setContexto } = useGlobalContext();
  const [carregando, setCarregando] = useState(false);

  const { data: obras } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: async () => {
      const result = await base44.entities.Obra.filter({
        status: 'em_andamento'
      });
      return result;
    },
    staleTime: 300000
  });

  const handleMudarObra = async (novaObraId) => {
    try {
      setCarregando(true);
      await setContexto(novaObraId);
    } catch (error) {
      console.error('Erro ao trocar obra:', error);
    } finally {
      setCarregando(false);
    }
  };

  const obraSelecionadaNome = obras?.find(o => o.id === obraAtual?.id)?.nome || 'Nenhuma';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-l border-blue-200">
      <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
      <Select 
        value={obraAtual?.id || ''} 
        onValueChange={handleMudarObra}
        disabled={carregando}
      >
        <SelectTrigger className="w-48 h-9 bg-white text-sm">
          <SelectValue placeholder="Selecionar obra..." />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          <SelectItem value={null}>Nenhuma obra</SelectItem>
          {obras?.map(obra => (
            <SelectItem key={obra.id} value={obra.id}>
              {obra.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {obraAtual && (
        <span className="text-xs text-gray-600">
          ✓ Contexto ativo
        </span>
      )}
    </div>
  );
}