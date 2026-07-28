import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AgendaFormModal({ open, evento, onClose, onSave }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(evento || {
    titulo: '',
    tipo: 'reuniao',
    data_inicio: '',
    data_fim: '',
    dia_todo: false,
    prioridade: 'media',
    descricao: '',
    obra_id: '',
    local: '',
    status: 'agendado',
    lembretes: [
      { tipo: 'dias', valor: 1 },
      { tipo: 'horas', valor: 24 },
      { tipo: 'horas', valor: 2 }
    ]
  });

  const [carregando, setCarregando] = useState(false);
  const [buscaObra, setBuscaObra] = useState('');
  // Erros por campo (para o aviso inline + a borda vermelha).
  const [errors, setErrors] = useState({});

  // Atualiza um campo e limpa o erro dele — o aviso some assim que o usuário corrige.
  const upd = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrors((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  // Classe de borda vermelha quando o campo tem erro.
  const cls = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');

  // Buscar obras ativas
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: async () => {
      const todasObras = await base44.entities.Obra.list('-updated_date', 200);
      return todasObras.filter(o => o.status !== 'cancelada' && o.status !== 'concluida');
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false
  });

  // Buscar usuário para validar perfil
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Filtrar obras por busca
  const obrasFiltradas = useMemo(() => {
    if (!buscaObra) return obras;
    const termo = buscaObra.toLowerCase();
    return obras.filter(o => 
      o.nome?.toLowerCase().includes(termo) || 
      o.codigo?.toLowerCase().includes(termo)
    );
  }, [obras, buscaObra]);

  // Reúne TODOS os erros de uma vez (não para no primeiro), destaca os campos e
  // devolve se está válido. Cada regra escreve a mensagem no campo que ela cobre.
  const validar = () => {
    const e = {};
    if (!form.titulo?.trim()) e.titulo = 'Informe o título do evento.';
    if (!form.data_inicio) e.data_inicio = 'Informe a data de início.';
    if (form.data_fim && form.data_inicio && form.data_fim < form.data_inicio) {
      e.data_fim = 'A data fim não pode ser anterior ao início.';
    }
    // Prazos sempre exigem obra.
    if (form.tipo === 'prazo' && !form.obra_id) e.obra_id = 'Prazos exigem uma obra vinculada.';
    // Perfis operacionais exigem obra em visita/entrega.
    const perfisOperacionais = ['mestre_obras', 'engenheiro_obra', 'encarregado', 'almoxarife'];
    if (user?.cargo && perfisOperacionais.includes(user.cargo) &&
        (form.tipo === 'visita' || form.tipo === 'entrega') && !form.obra_id) {
      e.obra_id = 'Seu perfil exige vincular uma obra para este tipo de evento.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validar()) {
      toast.error('Verifique os campos destacados.');
      return;
    }

    setCarregando(true);
    try {
      if (evento?.id) {
        await base44.functions.invoke('editarEventoAgenda', {
          evento_id: evento.id,
          ...form
        });
        toast.success('Evento atualizado');
      } else {
        await base44.functions.invoke('criarEventoAgenda', form);
        
        // Criar notificações para cada lembrete
        if (form.lembretes && form.lembretes.length > 0 && user?.email) {
          const dataInicio = new Date(form.data_inicio);
          
          for (const lembrete of form.lembretes) {
            let tempoAntes = 0;
            let tipoLabel = '';
            
            if (lembrete.tipo === 'dias') {
              tempoAntes = lembrete.valor * 24 * 60 * 60 * 1000;
              tipoLabel = `${lembrete.valor} dia${lembrete.valor > 1 ? 's' : ''}`;
            } else if (lembrete.tipo === 'horas') {
              tempoAntes = lembrete.valor * 60 * 60 * 1000;
              tipoLabel = `${lembrete.valor} hora${lembrete.valor > 1 ? 's' : ''}`;
            } else if (lembrete.tipo === 'minutos') {
              tempoAntes = lembrete.valor * 60 * 1000;
              tipoLabel = `${lembrete.valor} minuto${lembrete.valor > 1 ? 's' : ''}`;
            }
            
            try {
              await base44.entities.Notificacao.create({
                destinatario_email: user.email,
                titulo: `Lembrete: ${form.titulo}`,
                mensagem: `Evento em ${tipoLabel}`,
                tipo: 'lembrete_evento',
                lida: false,
                link_acao: 'Agenda'
              });
            } catch (notifError) {
              console.error('Erro ao criar notificação:', notifError);
            }
          }
        }
        
        // Enviar email de notificação ao criar novo evento
        await base44.functions.invoke('enviarEmailNovoEvento', form);
        toast.success('Evento criado com lembretes');
      }
      onSave();
    } catch (err) {
      toast.error('Erro ao salvar evento');
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{evento ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do evento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Título*</label>
            <Input
              value={form.titulo}
              onChange={(e) => upd('titulo', e.target.value)}
              placeholder="Título do evento"
              className={cls('titulo')}
            />
            {errors.titulo && <p className="text-xs text-red-600 mt-1">{errors.titulo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Tipo*</label>
              <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="prazo">Prazo</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Prioridade</label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({...form, prioridade: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Data Início*</label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => upd('data_inicio', e.target.value)}
                className={cls('data_inicio')}
              />
              {errors.data_inicio && <p className="text-xs text-red-600 mt-1">{errors.data_inicio}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Data Fim</label>
              <Input
                type="date"
                value={form.data_fim || ''}
                onChange={(e) => upd('data_fim', e.target.value)}
                className={cls('data_fim')}
              />
              {errors.data_fim && <p className="text-xs text-red-600 mt-1">{errors.data_fim}</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">
                Obra {form.tipo === 'prazo' ? '*' : '(opcional)'}
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  onClose();
                  navigate(createPageUrl('ObraForm'));
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Nova Obra
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar obra..."
                value={buscaObra}
                onChange={(e) => setBuscaObra(e.target.value)}
                className="pl-9 mb-2"
              />
            </div>

            <Select
              value={form.obra_id || ''}
              onValueChange={(v) => upd('obra_id', v === 'nenhuma' ? '' : v)}
            >
              <SelectTrigger className={cls('obra_id')}>
                <SelectValue placeholder="Selecione uma obra..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="nenhuma">Nenhuma obra</SelectItem>
                {obrasFiltradas.map(obra => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.codigo ? `[${obra.codigo}] ` : ''}{obra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {errors.obra_id ? (
              <p className="text-xs text-red-600 mt-1">{errors.obra_id}</p>
            ) : form.tipo === 'prazo' && (
              <p className="text-xs text-amber-600 mt-1">
                Prazos sempre exigem obra vinculada
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Local</label>
            <Input
              value={form.local || ''}
              onChange={(e) => setForm({...form, local: e.target.value})}
              placeholder="Endereço ou local"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Descrição</label>
            <Textarea
              value={form.descricao || ''}
              onChange={(e) => setForm({...form, descricao: e.target.value})}
              placeholder="Detalhes adicionais"
              className="h-20"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-600">Lembretes</label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-blue-600 hover:text-blue-700"
                onClick={() => {
                  const novos = [...(form.lembretes || [])];
                  novos.push({ tipo: 'horas', valor: 1 });
                  setForm({...form, lembretes: novos});
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(form.lembretes || []).map((lembrete, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <Select 
                    value={lembrete.tipo} 
                    onValueChange={(v) => {
                      const novos = [...(form.lembretes || [])];
                      novos[idx].tipo = v;
                      setForm({...form, lembretes: novos});
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dias">Dias</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="minutos">Minutos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={lembrete.valor}
                    onChange={(e) => {
                      const novos = [...(form.lembretes || [])];
                      novos[idx].valor = parseInt(e.target.value) || 1;
                      setForm({...form, lembretes: novos});
                    }}
                    className="w-16"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-500">antes</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="p-1 h-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      const novos = (form.lembretes || []).filter((_, i) => i !== idx);
                      setForm({...form, lembretes: novos});
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}