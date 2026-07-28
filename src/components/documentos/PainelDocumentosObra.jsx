import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AnalisadorDocumentosIA from './AnalisadorDocumentosIA';

export default function PainelDocumentosObra({ obraId }) {
  const [mostraAnalisador, setMostraAnalisador] = useState(false);

  const { data: documentos = [], refetch } = useQuery({
    queryKey: ['documentos-analise', obraId],
    queryFn: () => base44.entities.AnexoObra?.filter?.({ obra_id: obraId }) || [],
    enabled: !!obraId
  });

  const tiposDoc = {
    contrato: 'Contrato',
    planta: 'Planta/Projeto',
    especificacao_tecnica: 'Especificação',
    aditivo: 'Aditivo',
    outro: 'Documento'
  };

  const handleDelete = async (docId) => {
    if (confirm('Remover análise deste documento?')) {
      await base44.entities.AnexoObra.delete(docId);
      refetch();
    }
  };

  if (mostraAnalisador) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setMostraAnalisador(false)}
          className="mb-4"
        >
          ← Voltar
        </Button>
        <AnalisadorDocumentosIA obraId={obraId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Documentos Analisados</h3>
        <Button
          onClick={() => setMostraAnalisador(true)}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Documento
        </Button>
      </div>

      {documentos.length === 0 ? (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-6 text-center">
            <File className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Nenhum documento analisado</p>
            <Button
              onClick={() => setMostraAnalisador(true)}
              variant="ghost"
              size="sm"
              className="mt-2"
            >
              Adicionar documento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {documentos.map(doc => {
            const analise = doc.analise_ia;
            const alertas = analise?.alertas?.length || 0;
            const conflitos = analise?.conflitos_detectados?.length || 0;

            return (
              <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {tiposDoc[doc.tipo_documento]} {analise?.score_analise && `(${analise.score_analise.toFixed(1)}/10)`}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 truncate">{doc.url_documento?.split('/').pop()}</p>
                      {(alertas > 0 || conflitos > 0) && (
                        <div className="flex gap-3 mt-2">
                          {alertas > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                              {alertas} alerta{alertas > 1 ? 's' : ''}
                            </span>
                          )}
                          {conflitos > 0 && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              {conflitos} conflito{conflitos > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}