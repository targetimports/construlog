import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export default function SolicitarCompraModal({ open, onClose, onSuccess }) {
  const qc = useQueryClient();

  const [obraId, setObraId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [itens, setItens] = useState([{ descricao: '', und: 'un', qtd: 1 }]);

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' }, 'nome', 100),
    enabled: open,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error('Selecione uma obra');
      if (!descricao.trim()) throw new Error('Informe a justificativa/descrição');
      const itensFiltrados = itens.filter(i => i.descricao.trim() && i.qtd > 0);
      if (itensFiltrados.length === 0) throw new Error('Adicione ao menos um item');

      const obra = obras.find(o => o.id === obraId);
      return await base44.entities.RequisicaoCompra.create({
        titulo: `Solicitação - ${obra?.nome || 'Obra'}`,
        descricao_resumo: descricao.trim(),
        obra_id: obraId,
        data_solicitacao: new Date().toISOString().split('T')[0],
        prioridade,
        status: 'aguardando_aprovacao',
        status_aprovacao: 'pendente',
        solicitante: user?.email,
        solicitante_nome: user?.full_name,
        solicitante_email: user?.email,
        itens: itensFiltrados.map(i => ({
          descricao: i.descricao,
          unidade: i.und,
          quantidade_solicitada: Number(i.qtd),
          status: 'em_aberto',
        })),
        qtd_itens: itensFiltrados.length,
        valor_total_estimado: 0,
      });
    },
    onSuccess: (data) => {
      toast.success('Solicitação criada! Aguardando aprovação.');
      qc.invalidateQueries(['requisicoes-compra']);
      onSuccess?.(data);
      handleClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    setObraId(''); setDescricao(''); setPrioridade('normal');
    setItens([{ descricao: '', und: 'un', qtd: 1 }]);
    onClose();
  };

  const addItem = () => setItens(p => [...p, { descricao: '', und: 'un', qtd: 1 }]);
  const removeItem = (i) => setItens(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItens(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> Solicitar Compra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Obra */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Obra *</label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a obra..." />
              </SelectTrigger>
              <SelectContent>
                {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição / Justificativa */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Justificativa / Descrição *</label>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 text-sm min-h-[70px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              placeholder="Descreva o motivo e necessidade da compra..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>

          {/* Prioridade */}
          <div className="w-40">
            <label className="text-sm font-medium text-gray-700 block mb-1">Prioridade</label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Itens */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Itens *</label>
            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="flex-1" placeholder="Descrição do item"
                    value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)}
                  />
                  <Input
                    className="w-20" placeholder="Und"
                    value={item.und} onChange={e => updateItem(i, 'und', e.target.value)}
                  />
                  <Input
                    type="number" min={1} className="w-20" placeholder="Qtd"
                    value={item.qtd} onChange={e => updateItem(i, 'qtd', e.target.value)}
                  />
                  {itens.length > 1 && (
                    <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => removeItem(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={addItem}>
              <Plus className="w-4 h-4" /> Adicionar item
            </Button>
          </div>

          {/* Solicitante (readonly) */}
          {user && (
            <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-600">
              <span className="font-medium">Solicitante:</span> {user.full_name} ({user.email})
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => criarMutation.mutate()}
              disabled={criarMutation.isPending}
            >
              {criarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              Enviar Solicitação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}