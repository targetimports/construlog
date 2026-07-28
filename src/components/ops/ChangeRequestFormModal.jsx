import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ChangeRequestFormModal({ open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: '',
    ambiente: '',
    descricao: '',
    motivo: '',
    snapshot_id: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await base44.functions.invoke('criarOpsChangeRequest', formData);
      if (res.data?.ok) {
        toast.success('✓ Change Request criado');
        setFormData({ tipo: '', ambiente: '', descricao: '', motivo: '', snapshot_id: '' });
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.data?.error || 'Erro ao criar CR');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Mudança OPS</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tipo *</Label>
            <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESTORE_PROD">Restore Production</SelectItem>
                <SelectItem value="ROLLBACK_PROD">Rollback Production</SelectItem>
                <SelectItem value="RESTORE_STAGING">Restore Staging</SelectItem>
                <SelectItem value="ROLLBACK_STAGING">Rollback Staging</SelectItem>
                <SelectItem value="MAINTENANCE_CHANGE">Maintenance Change</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ambiente *</Label>
            <Select value={formData.ambiente} onValueChange={(v) => setFormData({ ...formData, ambiente: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ambiente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva a mudança"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="h-24"
            />
          </div>

          <div>
            <Label>Motivo *</Label>
            <Textarea
              placeholder="Motivo da mudança"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              className="h-20"
            />
          </div>

          <div>
            <Label>Snapshot ID (opcional)</Label>
            <Input
              placeholder="ID do snapshot"
              value={formData.snapshot_id}
              onChange={(e) => setFormData({ ...formData, snapshot_id: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar CR
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}