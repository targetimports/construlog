import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function FormMedicaoContratoModal({ open, onClose, onSave, medicao = null }) {
  const [formData, setFormData] = useState(medicao || {
    contrato_id: '',
    numero: '',
    titulo: '',
    valor_bruto: 0,
    periodo_de: '',
    periodo_ate: '',
    descricao: '',
    observacoes: ''
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.contrato_id || formData.valor_bruto <= 0) {
      toast.error('Contrato ID e Valor Bruto obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const result = await base44.functions.invoke('criarMedicaoContrato', {
        contrato_id: formData.contrato_id,
        numero: formData.numero,
        titulo: formData.titulo,
        valor_bruto: parseFloat(formData.valor_bruto),
        periodo_de: formData.periodo_de,
        periodo_ate: formData.periodo_ate,
        descricao: formData.descricao,
        observacoes: formData.observacoes
      });
      
      if (result.data.ok) {
        toast.success('Medição criada');
        onSave();
        onClose();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Medição de Contrato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Contrato ID *</label>
              <Input name="contrato_id" value={formData.contrato_id} onChange={handleChange} placeholder="ID do contrato" />
            </div>
            <div>
              <label className="text-sm font-medium">Número da Medição</label>
              <Input name="numero" value={formData.numero} onChange={handleChange} placeholder="ex: MED-001" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Título</label>
            <Input name="titulo" value={formData.titulo} onChange={handleChange} placeholder="Título da medição" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Período De</label>
              <Input type="date" name="periodo_de" value={formData.periodo_de} onChange={handleChange} />
            </div>
            <div>
              <label className="text-sm font-medium">Período Até</label>
              <Input type="date" name="periodo_ate" value={formData.periodo_ate} onChange={handleChange} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Valor Bruto *</label>
            <Input type="number" name="valor_bruto" value={formData.valor_bruto} onChange={handleChange} placeholder="0.00" />
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea name="descricao" value={formData.descricao} onChange={handleChange} placeholder="..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Medição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}