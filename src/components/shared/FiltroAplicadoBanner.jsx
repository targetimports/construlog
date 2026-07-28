import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FiltroAplicadoBanner({ obraNome, dataInicio, dataFim, onLimpar }) {
  return (
    <Alert className="bg-blue-50 border-blue-200">
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-blue-800 font-medium">Filtro aplicado:</span>
          {obraNome && <span className="text-blue-700">Obra: <strong>{obraNome}</strong></span>}
          {(dataInicio || dataFim) && (
            <span className="text-blue-700">
              Período: {dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : '...'} 
              {' até '}
              {dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : '...'}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
          onClick={onLimpar}
        >
          <X className="w-4 h-4 mr-1" />
          Limpar Filtros
        </Button>
      </AlertDescription>
    </Alert>
  );
}