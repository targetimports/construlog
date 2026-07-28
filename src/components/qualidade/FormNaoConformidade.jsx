import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function FormNaoConformidade({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({
    descricao: '',
    severidade: 'menor',
    obra_id: '',
    categoria: '',
    causa_raiz: '',
    acao_corretiva: '',
    responsavel: '',
    data_prazo: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-lista'],
    queryFn: () => base44.entities.Obra?.list('-updated_date', 50) || [],
    enabled: open
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.descricao || !form.obra_id) {
        throw new Error('Preencha os campos obrigatórios');
      }

      const nc = {
        ...form,
        status: 'aberto',
        created_by: (await base44.auth.me()).email
      };

      return await base44.entities.NaoConformidade?.create(nc);
    },
    onSuccess: () => {
      toast.success('Não-conformidade registrada');
      setForm({
        descricao: '',
        severidade: 'menor',
        obra_id: '',
        categoria: '',
        causa_raiz: '',
        acao_corretiva: '',
        responsavel: '',
        data_prazo: ''
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Não-Conformidade</DialogTitle>
          <DialogDescription>Documente a não-conformidade e defina ações corretivas</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descrição */}
          <div>
            <label className="text-sm font-medium">Descrição *</label>
            <Textarea
              placeholder="Descreva a não-conformidade em detalhes"
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              className="h-20"
            />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Severidade *</label>
              <Select value={form.severidade} onValueChange={(v) => handleChange('severidade', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menor">Menor</SelectItem>
                  <SelectItem value="maior">Maior</SelectItem>
                  <SelectItem value="crítica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Obra *</label>
              <Select value={form.obra_id} onValueChange={(v) => handleChange('obra_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Categoria</label>
              <Input
                placeholder="ex: Segurança, Qualidade"
                value={form.categoria}
                onChange={(e) => handleChange('categoria', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Responsável</label>
              <Input
                placeholder="Nome do responsável"
                value={form.responsavel}
                onChange={(e) => handleChange('responsavel', e.target.value)}
              />
            </div>
          </div>

          {/* Causa Raiz */}
          <div>
            <label className="text-sm font-medium">Causa Raiz</label>
            <Textarea
              placeholder="Analise a causa raiz"
              value={form.causa_raiz}
              onChange={(e) => handleChange('causa_raiz', e.target.value)}
              className="h-16"
            />
          </div>

          {/* Ação Corretiva */}
          <div>
            <label className="text-sm font-medium">Ação Corretiva</label>
            <Textarea
              placeholder="Defina a ação corretiva"
              value={form.acao_corretiva}
              onChange={(e) => handleChange('acao_corretiva', e.target.value)}
              className="h-16"
            />
          </div>

          {/* Data Prazo */}
          <div>
            <label className="text-sm font-medium">Data Prazo</label>
            <Input
              type="date"
              value={form.data_prazo}
              onChange={(e) => handleChange('data_prazo', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}