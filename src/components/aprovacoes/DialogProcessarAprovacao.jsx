import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, X, AlertCircle, Loader2 } from 'lucide-react';

export default function DialogProcessarAprovacao({
  aprovacao,
  open,
  onClose,
  onProcessar,
  isLoading
}) {
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState(null);

  const handleProcessar = () => {
    if (aprovacao.acao === 'reprovar' && !comentario.trim()) {
      setErro('Comentário obrigatório para reprovação');
      return;
    }

    onProcessar({
      aprovacao_id: aprovacao.id,
      acao: aprovacao.acao,
      comentario: comentario || null,
      modulo: aprovacao.modulo
    });

    setComentario('');
    setErro(null);
  };

  const isReprovar = aprovacao?.acao === 'reprovar';
  const iconAprov = isReprovar ? <X className="w-6 h-6 text-red-600" /> : <CheckCircle2 className="w-6 h-6 text-green-600" />;
  const textoBotao = isReprovar ? 'Reprovação' : 'Aprovação';
  const classBotao = isReprovar ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {iconAprov}
            <DialogTitle>Confirmar {textoBotao}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <p className="font-semibold text-gray-900">{aprovacao?.descricao?.substring(0, 80)}</p>
            <p className="text-gray-600 mt-1">
              Valor: R$ {(aprovacao?.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </p>
          </div>

          {isReprovar && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo da Reprovação *
              </label>
              <Textarea
                value={comentario}
                onChange={(e) => {
                  setComentario(e.target.value);
                  setErro(null);
                }}
                placeholder="Explique o motivo da reprovação..."
                className="h-24"
              />
              {erro && (
                <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {erro}
                </div>
              )}
            </div>
          )}

          {!isReprovar && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Comentário (Opcional)
              </label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Adicione um comentário..."
                className="h-20"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleProcessar}
            disabled={isLoading}
            className={classBotao}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                {isReprovar ? <X className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {textoBotao}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}