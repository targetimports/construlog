import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function DialogAprovarRejeitarApontamento({ apontamento, onAprovar, onRejeitar, onClose }) {
  const [motivo, setMotivo] = useState('');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar ou Rejeitar Apontamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm"><strong>Data:</strong> {apontamento.data}</p>
            <p className="text-sm"><strong>Horas Normais:</strong> {apontamento.horas_normais}</p>
            <p className="text-sm"><strong>Horas Extras:</strong> {apontamento.horas_extras}</p>
            <p className="text-sm"><strong>Custo Total:</strong> R$ {apontamento.custo_total?.toFixed(2)}</p>
          </div>

          <div>
            <Label>Motivo (se rejeitar)</Label>
            <textarea
              className="w-full border rounded p-2"
              rows="3"
              placeholder="Descreva o motivo da rejeição"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button variant="destructive" onClick={() => onRejeitar(motivo)}>Rejeitar</Button>
            <Button onClick={onAprovar}>Aprovar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}