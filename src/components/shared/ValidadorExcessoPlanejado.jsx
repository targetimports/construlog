import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

/**
 * Hook para validar consumo de materiais planejados
 * Retorna:
 * - excedente: booleano se há excesso
 * - dados: { planejado, consumido, novo, excedenteMontante }
 * - dialog: componente para mostrar alerta
 */
export function useValidarExcessoPlanejado() {
  const [showDialog, setShowDialog] = useState(false);
  const [validacao, setValidacao] = useState(null);
  const [justificativa, setJustificativa] = useState('');
  const [pendingCallback, setPendingCallback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const validar = async (obraId, etapaObraId, descricao, unidade, quantidadeSolicitada) => {
    try {
      setIsLoading(true);

      // Chamar função backend
      const response = await base44.functions.invoke('calcularConsumoPlanejado', {
        obraId,
        etapaObraId,
        descricao,
        unidade
      });

      const { quantidadePlanejada, quantidadeConsumida } = response.data;
      const novoTotal = quantidadeConsumida + quantidadeSolicitada;
      const excedente = quantidadePlanejada > 0 && novoTotal > quantidadePlanejada;

      if (excedente) {
        // Mostrar diálogo
        setValidacao({
          planejado: quantidadePlanejada,
          consumido: quantidadeConsumida,
          novo: quantidadeSolicitada,
          novoTotal,
          excedenteMontante: novoTotal - quantidadePlanejada,
          descricao,
          unidade
        });
        setShowDialog(true);
        setJustificativa('');

        // Retornar promessa que resolve quando usuário confirmar
        return new Promise((resolve, reject) => {
          setPendingCallback({ resolve, reject });
        });
      } else {
        // Sem excesso, seguir adiante
        return {
          valido: true,
          excedente: false,
          justificativa: null
        };
      }
    } catch (error) {
      console.error('Erro ao validar consumo:', error);
      toast.error('Erro ao validar consumo planejado');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmar = () => {
    if (!justificativa.trim()) {
      toast.error('Justificativa é obrigatória');
      return;
    }

    setShowDialog(false);

    if (pendingCallback) {
      pendingCallback.resolve({
        valido: true,
        excedente: true,
        justificativa: justificativa.trim()
      });
      setPendingCallback(null);
    }
  };

  const handleCancelar = () => {
    setShowDialog(false);

    if (pendingCallback) {
      pendingCallback.reject(new Error('Solicitação cancelada pelo usuário'));
      setPendingCallback(null);
    }
  };

  const DialogComponent = () => {
    if (!validacao) return null;

    return (
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex gap-2 items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
              Excesso ao Planejado
            </AlertDialogTitle>
          </AlertDialogHeader>

          <AlertDialogDescription className="space-y-3">
            <p>A quantidade solicitada excede o planejado para esta etapa.</p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Planejado na etapa:</span>
                <span className="font-semibold text-gray-900">
                  {validacao.planejado} {validacao.unidade}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Já solicitado/consumido:</span>
                <span className="font-semibold text-gray-900">
                  {validacao.consumido} {validacao.unidade}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-amber-200 pt-2">
                <span className="text-gray-700">Solicitando agora:</span>
                <span className="font-semibold text-gray-900">
                  {validacao.novo} {validacao.unidade}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-amber-200 pt-2">
                <span className="text-amber-700 font-semibold">Novo total:</span>
                <span className="font-bold text-amber-700">
                  {validacao.novoTotal} {validacao.unidade}
                </span>
              </div>
              <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded p-2">
                <span className="text-red-700 font-semibold">Excedente:</span>
                <span className="font-bold text-red-700">
                  +{validacao.excedenteMontante} {validacao.unidade}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justificativa" className="text-sm font-medium">
                Justificativa do excesso <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="justificativa"
                placeholder="Ex: Demanda adicional inesperada, retrabalho, desperdício..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className="min-h-20"
              />
            </div>
          </AlertDialogDescription>

          <div className="flex gap-2 justify-end pt-2">
            <AlertDialogCancel onClick={handleCancelar}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmar}
              disabled={!justificativa.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar Mesmo Assim
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return {
    validar,
    DialogComponent,
    isLoading
  };
}

export default useValidarExcessoPlanejado;