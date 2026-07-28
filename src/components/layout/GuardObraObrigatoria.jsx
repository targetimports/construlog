import React from 'react';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function GuardObraObrigatoria({ children, mostrarAviso = true }) {
  const { obraAtual } = useGlobalContext();

  if (!obraAtual?.id) {
    if (!mostrarAviso) {
      return null;
    }

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">Selecione uma obra para continuar</h3>
                <p className="text-sm text-amber-800">
                  Esta tela requer que você tenha uma obra selecionada no topo da página. 
                  Escolha uma obra ativa para acessar as funcionalidades.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}