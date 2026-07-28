import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function RequisicaoRelatorioIA({ onRelatorioGerado }) {
  const [requisicao, setRequisicao] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 50)
  });

  const mutation = useMutation({
    mutationFn: async (texto) => {
      setIsLoading(true);
      try {
        const response = await base44.functions.invoke('interpretarRequisicaoRelatorioIA', {
          requisicaoTexto: texto,
          contatos: {
            obras: obras.map(o => ({ id: o.id, nome: o.nome }))
          }
        });
        return response.data;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: (data) => {
      if (data.parametros.confianca < 0.6) {
        toast.warning('Interpretação com baixa confiança. Verifique os parâmetros sugeridos.');
      } else {
        toast.success('Relatório interpretado com sucesso!');
      }
      onRelatorioGerado?.(data);
      setRequisicao('');
    },
    onError: (error) => {
      toast.error('Erro ao processar requisição: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!requisicao.trim()) {
      toast.error('Digite sua requisição');
      return;
    }
    mutation.mutate(requisicao);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">Relatório com IA</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-gray-600">
          Descreva qual relatório você precisa em linguagem natural:
        </p>
        
        <div className="flex gap-2">
          <Input
            value={requisicao}
            onChange={(e) => setRequisicao(e.target.value)}
            placeholder="Ex: Mostre custos de material da obra X nos últimos 30 dias"
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading || !requisicao.trim()}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-600 space-y-1">
          <p>Exemplos:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Total de despesas com mão de obra em 2024</li>
            <li>Comparar custos reais vs orçado da obra Y</li>
            <li>Materiais com maior variação de preço</li>
            <li>Equipamentos ociosos nas últimas 2 semanas</li>
          </ul>
        </div>
      </form>
    </div>
  );
}