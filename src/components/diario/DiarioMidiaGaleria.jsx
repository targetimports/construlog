import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X, Play } from 'lucide-react';
import { toast } from 'sonner';
import UploadMidiaModal from './UploadMidiaModal';

export default function DiarioMidiaGaleria({ diarioId, canEdit = false, diarioStatus = 'RASCUNHO' }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [midiaAmpliada, setMidiaAmpliada] = useState(null);
  const queryClient = useQueryClient();
  const isRascunho = diarioStatus === 'RASCUNHO';

  // Buscar mídias do diário
  const { data: midias = [], isLoading } = useQuery({
    queryKey: ['diario-midias', diarioId],
    queryFn: () => base44.entities.DiarioObraMidia.filter({ diario_id: diarioId }),
    enabled: !!diarioId
  });

  // Deletar mídia
  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.DiarioObraMidia.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diario-midias', diarioId] });
      toast.success('Mídia removida');
    },
    onError: (err) => toast.error(err.message || 'Erro ao remover')
  });

  const handleAbrirModal = (midia) => {
    setMidiaAmpliada(midia);
    setModalOpen(true);
  };

  const handleRemover = (id) => {
    if (!canEdit) {
      toast.error('Diário aprovado — apenas administradores podem alterar as evidências.');
      return;
    }
    if (window.confirm('Tem certeza?')) {
      deletarMutation.mutate(id);
    }
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-gray-900">Evidências (Fotos/Vídeos)</CardTitle>
        {canEdit && (
          <Button
            onClick={() => setUploadOpen(true)}
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : midias.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-3">Nenhuma evidência adicionada</div>
            {canEdit && (
              <Button
                onClick={() => setUploadOpen(true)}
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Adicionar Primeira Evidência
              </Button>
            )}
          </div>
        ) : (
          <div>
            {/* Galeria em grade */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {midias.map(midia => (
                <div
                  key={midia.id}
                  className="relative group rounded-lg overflow-hidden bg-gray-100 border border-gray-200 aspect-square cursor-pointer"
                  onClick={() => handleAbrirModal(midia)}
                >
                  {midia.tipo === 'FOTO' ? (
                    <img
                      src={midia.arquivo_url}
                      alt={midia.legenda || 'Foto'}
                      className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Play className="w-8 h-8 text-gray-500" fill="currentColor" />
                    </div>
                  )}

                  {/* Overlay com ações */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Badge className="bg-gray-900 text-white">{midia.tipo === 'FOTO' ? '' : ''}</Badge>
                    {canEdit && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemover(midia.id);
                        }}
                        disabled={deletarMutation.isPending}
                        className="h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Info adicional */}
            {!isRascunho && (
              <p className="text-xs text-gray-500">
                ℹMídias não podem ser removidas pois o diário foi aprovado
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Upload Modal */}
      <UploadMidiaModal open={uploadOpen} onClose={() => setUploadOpen(false)} diarioId={diarioId} />

      {/* Modal de visualização */}
      {modalOpen && midiaAmpliada && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="max-w-2xl w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            {/* Conteúdo */}
            {midiaAmpliada.tipo === 'FOTO' ? (
              <img
                src={midiaAmpliada.arquivo_url}
                alt={midiaAmpliada.legenda || 'Foto'}
                className="w-full rounded-lg"
              />
            ) : (
              <video
                src={midiaAmpliada.arquivo_url}
                controls
                className="w-full rounded-lg bg-black"
              />
            )}

            {/* Legenda */}
            {midiaAmpliada.legenda && (
              <div className="bg-gray-900/80 rounded-lg p-3">
                <p className="text-white text-sm">{midiaAmpliada.legenda}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}