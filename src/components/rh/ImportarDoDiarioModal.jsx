import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ImportarDoDiarioModal({ onImportar, onClose }) {
  const [formData, setFormData] = useState({
    obra_id: '',
    de: '',
    ate: ''
  });
  const [loading, setLoading] = useState(false);

  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('nome', 100),
    initialData: []
  });

  const handleImportar = async () => {
    if (!formData.obra_id || !formData.de || !formData.ate) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await onImportar(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Apontamentos do Diário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Obra *</Label>
            <select
              className="w-full border rounded p-2 mt-1"
              value={formData.obra_id}
              onChange={(e) => setFormData({ ...formData, obra_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Data Inicial *</Label>
            <Input
              type="date"
              value={formData.de}
              onChange={(e) => setFormData({ ...formData, de: e.target.value })}
            />
          </div>

          <div>
            <Label>Data Final *</Label>
            <Input
              type="date"
              value={formData.ate}
              onChange={(e) => setFormData({ ...formData, ate: e.target.value })}
            />
          </div>

          <p className="text-sm text-gray-600">
            Esta ação importará mão de obra do Diário de Obra como apontamentos. O Diário NÃO será alterado.
          </p>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleImportar} disabled={loading}>
              {loading ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}