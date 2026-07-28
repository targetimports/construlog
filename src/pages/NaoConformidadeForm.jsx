import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';

export default function NaoConformidadeForm() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <Construction className="w-20 h-20 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Módulo em Desenvolvimento</h1>
        <p className="text-gray-600 mb-6">O módulo de Não Conformidades estará disponível em breve</p>
        <Link to={createPageUrl('Dashboard')}>
          <Button>Voltar ao Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}