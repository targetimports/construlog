import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

/**
 * PÁGINA OCULTA: Solicitacoes
 * Esta funcionalidade foi temporariamente desativada para evitar conflitos
 * com o módulo de Compras. Será reimplementada com entidades separadas.
 */
export default function SolicitacoesHidden() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <AlertCircle className="w-20 h-20 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Módulo Temporariamente Desativado</h1>
        <p className="text-gray-600 mb-4">
          Este módulo foi desativado para padronização do sistema. 
          Use o módulo <strong>Compras</strong> para gerenciar requisições e ordens de compra.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to={createPageUrl('Compras')}>
            <Button className="bg-blue-600 hover:bg-blue-700">Ir para Compras</Button>
          </Link>
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}