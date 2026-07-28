import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function ResumoExecutivoIA({ relatorioData, tipo = 'Geral' }) {
  const [resumo, setResumo] = useState(null);
  const [expandido, setExpandido] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('gerarResumoExecutivoIA', {
        relatorioData,
        tipo
      });
      return response.data;
    },
    onSuccess: (data) => {
      setResumo(data.resumo);
      setExpandido(true);
    },
    onError: (error) => {
      toast.error('Erro ao gerar resumo: ' + error.message);
    }
  });

  useEffect(() => {
    if (relatorioData && Object.keys(relatorioData).length > 0) {
      mutation.mutate();
    }
  }, [relatorioData, tipo]);

  if (mutation.isPending) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
          <p className="text-sm text-amber-700">Gerando resumo executivo com IA...</p>
        </div>
      </div>
    );
  }

  if (!resumo) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full p-4 flex items-center gap-3 hover:bg-amber-100/50 transition-colors"
      >
        <FileText className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-amber-900">Resumo Executivo</h3>
          <p className="text-xs text-amber-700">Gerado automaticamente pela IA</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-amber-600 transition-transform ${
            expandido ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expandido && (
        <div className="border-t border-amber-200 p-4 bg-white/50">
          <div className="prose prose-sm max-w-none text-gray-700">
            {resumo.split('\n').map((line, idx) => {
              if (line.startsWith('#')) {
                const level = line.match(/^#+/)[0].length;
                const text = line.replace(/^#+\s/, '');
                const styles = {
                  1: 'text-lg font-bold',
                  2: 'text-base font-semibold mt-3',
                  3: 'text-sm font-semibold text-amber-900 mt-2'
                };
                return (
                  <div key={idx} className={styles[level] || 'text-sm'}>
                    {text}
                  </div>
                );
              }
              if (line.startsWith('-') || line.startsWith('•')) {
                return (
                  <div key={idx} className="text-sm ml-4">
                    {line}
                  </div>
                );
              }
              if (line.trim()) {
                return (
                  <p key={idx} className="text-sm my-2">
                    {line}
                  </p>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}