import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function EmDesenvolvimento() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const modulo = params.get('modulo') || 'Esta funcionalidade';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardContent className="p-12 text-center">
          <div className="mb-6">
            <Construction className="w-24 h-24 text-amber-500 mx-auto mb-4" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Módulo em Desenvolvimento
          </h1>
          
          <p className="text-lg text-gray-600 mb-6">
            {modulo} está sendo desenvolvido e estará disponível em breve.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Em construção:</strong> Nossa equipe está trabalhando para trazer esta funcionalidade para você. 
              Fique atento às atualizações!
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button 
              onClick={() => navigate(-1)}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button 
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Ir para Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}