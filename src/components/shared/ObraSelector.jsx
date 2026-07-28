import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

/**
 * Componente reutilizável para seleção de obra obrigatória
 * Mostra alerta se obra não estiver selecionada
 */
export default function ObraSelector({ value, onChange, disabled = false, showError = false }) {
  const { data: obras, isLoading } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  return (
    <div className="space-y-2">
      <Select value={value || ''} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger className={showError ? 'border-red-500 focus:ring-red-500' : ''}>
          <SelectValue placeholder="Selecione uma obra..." />
        </SelectTrigger>
        <SelectContent>
          {!isLoading && obras?.map((obra) => (
            <SelectItem key={obra.id} value={obra.id}>
              {obra.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {showError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Selecione uma obra para prosseguir</span>
        </div>
      )}
    </div>
  );
}