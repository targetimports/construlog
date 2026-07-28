import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Shield, Users, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TIPOS_OPERACAO = [
  { value: 'todas', label: 'Todas as Operações' },
  { value: 'solicitacao_compra', label: 'Solicitação de Compra' },
  { value: 'ordem_compra', label: 'Ordem de Compra' },
  { value: 'pagamento', label: 'Pagamento' }
];

const CARGOS_DISPONIVEIS = [
  'supervisor', 'coordenador', 'gerente', 'diretor', 'financeiro', 'compras', 'admin'
];

const FORM_INICIAL = {
  nome: '',
  nivel: 1,
  tipo_operacao: 'todas',
  valor_minimo: 0,
  valor_maximo: 0,
  cargos_aprovadores: [],
  aprovadores_especificos: [],
  requer_todos: false,
  prazo_horas: 48,
  escalar_automaticamente: false,
  ativa: true,
  observacoes: ''
};

export default function ConfigAlcadas() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [novoAprovador, setNovoAprovador] = useState({ user_email: '', nome: '', cargo: '' });

  const { data: alcadas = [], isLoading } = useQuery({
    queryKey: ['alcadas-config'],
    queryFn: () => base44.entities.AlcadaAprovacao.list('-nivel', 50)
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (editando) {
        return base44.entities.AlcadaAprovacao.update(editando.id, data);
      }
      return base44.entities.AlcadaAprovacao.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alcadas-config'] });
      setDialogOpen(false);
      setEditando(null);
      setForm(FORM_INICIAL);
      toast.success(editando ? 'Alçada atualizada' : 'Alçada criada');
    }
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => base44.entities.AlcadaAprovacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alcadas-config'] });
      toast.success('Alçada excluída');
    }
  });

  const handleEditar = (alcada) => {
    setEditando(alcada);
    setForm({
      nome: alcada.nome || '',
      nivel: alcada.nivel || 1,
      tipo_operacao: alcada.tipo_operacao || 'todas',
      valor_minimo: alcada.valor_minimo || 0,
      valor_maximo: alcada.valor_maximo || 0,
      cargos_aprovadores: alcada.cargos_aprovadores || [],
      aprovadores_especificos: alcada.aprovadores_especificos || [],
      requer_todos: alcada.requer_todos || false,
      prazo_horas: alcada.prazo_horas || 48,
      escalar_automaticamente: alcada.escalar_automaticamente || false,
      ativa: alcada.ativa !== false,
      observacoes: alcada.observacoes || ''
    });
    setDialogOpen(true);
  };

  const handleNovo = () => {
    setEditando(null);
    setForm(FORM_INICIAL);
    setDialogOpen(true);
  };

  const handleSalvar = () => {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return; }
    if (form.cargos_aprovadores.length === 0 && form.aprovadores_especificos.length === 0) {
      toast.error('Defina pelo menos um cargo ou aprovador específico');
      return;
    }
    salvarMutation.mutate(form);
  };

  const toggleCargo = (cargo) => {
    setForm(prev => ({
      ...prev,
      cargos_aprovadores: prev.cargos_aprovadores.includes(cargo)
        ? prev.cargos_aprovadores.filter(c => c !== cargo)
        : [...prev.cargos_aprovadores, cargo]
    }));
  };

  const adicionarAprovador = () => {
    if (!novoAprovador.user_email) return;
    setForm(prev => ({
      ...prev,
      aprovadores_especificos: [...prev.aprovadores_especificos, { ...novoAprovador }]
    }));
    setNovoAprovador({ user_email: '', nome: '', cargo: '' });
  };

  const removerAprovador = (idx) => {
    setForm(prev => ({
      ...prev,
      aprovadores_especificos: prev.aprovadores_especificos.filter((_, i) => i !== idx)
    }));
  };

  const alcadasOrdenadas = [...alcadas].sort((a, b) => (a.nivel || 1) - (b.nivel || 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Configuração de Alçadas de Aprovação
          </h2>
          <p className="text-sm text-gray-500 mt-1">Defina os níveis hierárquicos, limites de valor e aprovadores por cargo</p>
        </div>
        <Button onClick={handleNovo} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Alçada
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : alcadasOrdenadas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma alçada configurada. Crie a primeira para iniciar o fluxo de aprovações.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alcadasOrdenadas.map((alcada, idx) => (
            <Card key={alcada.id} className={cn("transition-all", !alcada.ativa && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
                      alcada.nivel === 1 ? "bg-blue-100 text-blue-700" :
                      alcada.nivel === 2 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      N{alcada.nivel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{alcada.nome}</h3>
                        {!alcada.ativa && <Badge variant="outline" className="text-xs">Inativa</Badge>}
                        <Badge variant="secondary" className="text-xs">
                          {TIPOS_OPERACAO.find(t => t.value === alcada.tipo_operacao)?.label || alcada.tipo_operacao}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                        <span>
                          R$ {(alcada.valor_minimo || 0).toLocaleString('pt-BR')}
                          {alcada.valor_maximo ? ` — R$ ${alcada.valor_maximo.toLocaleString('pt-BR')}` : ' — Sem limite'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {alcada.cargos_aprovadores?.length > 0 && alcada.cargos_aprovadores.join(', ')}
                          {alcada.aprovadores_especificos?.length > 0 && ` + ${alcada.aprovadores_especificos.length} específicos`}
                        </span>
                        <span>Prazo: {alcada.prazo_horas || 48}h</span>
                        {alcada.requer_todos && <Badge className="bg-purple-100 text-purple-700 text-xs">Todos aprovam</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleEditar(alcada)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => excluirMutation.mutate(alcada.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {idx < alcadasOrdenadas.length - 1 && alcadasOrdenadas[idx + 1]?.nivel > alcada.nivel && (
                  <div className="flex justify-center mt-2">
                    <ChevronRight className="w-4 h-4 text-gray-300 rotate-90" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Alçada' : 'Nova Alçada de Aprovação'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome da Alçada *</Label>
                <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Gerente" />
              </div>
              <div>
                <Label>Nível Hierárquico *</Label>
                <Select value={String(form.nivel)} onValueChange={v => setForm({...form, nivel: Number(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nível 1 (Primeiro)</SelectItem>
                    <SelectItem value="2">Nível 2 (Segundo)</SelectItem>
                    <SelectItem value="3">Nível 3 (Terceiro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tipo de Operação</Label>
              <Select value={form.tipo_operacao} onValueChange={v => setForm({...form, tipo_operacao: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_OPERACAO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Mínimo (R$)</Label>
                <Input type="number" value={form.valor_minimo} onChange={e => setForm({...form, valor_minimo: Number(e.target.value)})} />
              </div>
              <div>
                <Label>Valor Máximo (R$) — 0 = sem limite</Label>
                <Input type="number" value={form.valor_maximo} onChange={e => setForm({...form, valor_maximo: Number(e.target.value)})} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Cargos Aprovadores</Label>
              <div className="flex flex-wrap gap-2">
                {CARGOS_DISPONIVEIS.map(cargo => (
                  <button
                    key={cargo}
                    onClick={() => toggleCargo(cargo)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      form.cargos_aprovadores.includes(cargo)
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    )}
                  >
                    {cargo}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Aprovadores Específicos (opcional)</Label>
              <div className="space-y-2">
                {form.aprovadores_especificos.map((ap, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <span className="text-sm flex-1">{ap.nome || ap.user_email} ({ap.cargo})</span>
                    <Button size="sm" variant="ghost" onClick={() => removerAprovador(idx)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Email" value={novoAprovador.user_email} onChange={e => setNovoAprovador({...novoAprovador, user_email: e.target.value})} className="text-xs" />
                  <Input placeholder="Nome" value={novoAprovador.nome} onChange={e => setNovoAprovador({...novoAprovador, nome: e.target.value})} className="text-xs" />
                  <div className="flex gap-1">
                    <Input placeholder="Cargo" value={novoAprovador.cargo} onChange={e => setNovoAprovador({...novoAprovador, cargo: e.target.value})} className="text-xs" />
                    <Button size="sm" variant="outline" onClick={adicionarAprovador}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo (horas)</Label>
                <Input type="number" value={form.prazo_horas} onChange={e => setForm({...form, prazo_horas: Number(e.target.value)})} />
              </div>
              <div className="space-y-3 pt-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.requer_todos} onCheckedChange={v => setForm({...form, requer_todos: v})} />
                  <Label className="text-xs">Todos devem aprovar</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.escalar_automaticamente} onCheckedChange={v => setForm({...form, escalar_automaticamente: v})} />
                  <Label className="text-xs">Escalar se prazo expirar</Label>
                </div>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} placeholder="Notas sobre esta alçada..." className="h-16" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvarMutation.isPending}>
              {salvarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editando ? 'Salvar' : 'Criar Alçada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}