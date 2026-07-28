import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalisePreditiva({ tipo, dados }) {
  const [analise, setAnalise] = useState(null);

  const mutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('analisarComIA', {
        tipo,
        dados
      });
    },
    onSuccess: (result) => {
      setAnalise(result);
      toast.success('Análise concluída!');
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Análise Inteligente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">Receba sugestões da IA baseadas nos seus dados</p>

        {!analise ? (
          <Button
            onClick={() => mutation.mutate()}
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              'Gerar Análise'
            )}
          </Button>
        ) : (
          <div className="space-y-3 bg-white p-3 rounded-lg">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Análise</p>
              <p className="text-sm mt-1">{analise.analise}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Risco</p>
              <p className={`text-sm font-semibold ${
                analise.risco === 'alto' ? 'text-red-600' :
                analise.risco === 'medio' ? 'text-yellow-600' :
                'text-green-600'
              }`}>{analise.risco.toUpperCase()}</p>
            </div>
            {analise.sugestoes && analise.sugestoes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Sugestões</p>
                <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                  {analise.sugestoes.map((s, i) => (
                    <li key={i} className="text-gray-700">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              onClick={() => setAnalise(null)}
              variant="outline"
              size="sm"
              className="w-full mt-2"
            >
              Nova Análise
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}