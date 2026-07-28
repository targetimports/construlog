import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function SolicitacaoDetalhesHidden() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <AlertCircle className="w-20 h-20 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Módulo Temporariamente Desativado</h1>
        <p className="text-gray-600 mb-4">Use o módulo Compras</p>
        <Link to={createPageUrl('Compras')}>
          <Button>Ir para Compras</Button>
        </Link>
      </div>
    </div>
  );
}