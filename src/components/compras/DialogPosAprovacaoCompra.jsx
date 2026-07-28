import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Package, Warehouse, ArrowRight } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function DialogPosAprovacaoCompra({ open, onClose, requisicao, obraNome }) {
  const obraId = requisicao?.obra_id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Compra Aprovada!
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-gray-600">
            A requisição <strong>{requisicao?.titulo || 'de compra'}</strong> foi aprovada com sucesso.
            {obraNome && <> para a obra <strong>{obraNome}</strong>.</>}
          </p>

          <p className="text-sm font-semibold text-gray-800">
            O que deseja fazer agora?
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => {
                window.location.href = createPageUrl('EstoqueProfissional');
              }}
              className="w-full justify-between bg-blue-600 hover:bg-blue-700 h-14"
            >
              <div className="flex items-center gap-3">
                <Warehouse className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Ir para Gestão de Estoque</p>
                  <p className="text-xs opacity-80">Registrar entrada no almoxarifado</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => {
                if (obraId) {
                  window.location.href = createPageUrl('ObraDetalhes') + `?id=${obraId}&secao=materiais`;
                } else {
                  window.location.href = createPageUrl('Obras');
                }
              }}
              className="w-full justify-between bg-emerald-600 hover:bg-emerald-700 h-14"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Enviar direto para Obra</p>
                  <p className="text-xs opacity-80">{obraNome || 'Selecionar obra destino'}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Continuar aprovando
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}