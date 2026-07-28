import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import SeletorPessoa from '@/components/shared/SeletorPessoa';

export default function FormAlocacao({ open, onOpenChange, colaborador, alocacao, obraId }) {
  const queryClient = useQueryClient();

  // Cargo que o colaborador já tem no cadastro — vira o padrão (placeholder), para
  // não pedir de novo um dado que o RH já preencheu.
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000).catch(() => []),
    enabled: open,
  });
  const [formData, setFormData] = useState({
    colaborador_id: colaborador?.id || '',
    obra_id: obraId || '',
    cargo_alocado: colaborador?.cargo || '',
    data_inicio: '',
    data_fim: '',
    status: 'planejada',
    horas_diarias: 8,
    turno: 'integral',
    observacoes: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  useEffect(() => {
    if (alocacao) {
      setFormData({
        colaborador_id: alocacao.colaborador_id,
        obra_id: alocacao.obra_id,
        cargo_alocado: alocacao.cargo_alocado || '',
        data_inicio: alocacao.data_inicio || '',
        data_fim: alocacao.data_fim || '',
        status: alocacao.status || 'planejada',
        horas_diarias: alocacao.horas_diarias || 8,
        turno: alocacao.turno || 'integral',
        observacoes: alocacao.observacoes || ''
      });
    } else {
      setFormData({
        colaborador_id: colaborador?.id || '',
        obra_id: obraId || '',
        cargo_alocado: colaborador?.cargo || '',
        data_inicio: '',
        data_fim: '',
        status: 'planejada',
        horas_diarias: 8,
        turno: 'integral',
        observacoes: ''
      });
    }
  }, [alocacao, colaborador, open]);

  const [errors, setErrors] = useState({});
  const cls = (c) => (errors[c] ? 'border-red-400 focus-visible:ring-red-400' : '');
  const setCampo = (campo, valor) => {
    setFormData((f) => ({ ...f, [campo]: valor }));
    setErrors((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  useEffect(() => { setErrors({}); }, [open, alocacao, colaborador]);

  const cargoDoCadastro = colaboradores.find((c) => c.id === formData.colaborador_id)?.cargo
    || colaborador?.cargo || '';

  const validar = () => {
    const e = {};
    if (!formData.colaborador_id) e.colaborador_id = 'Selecione o colaborador.';
    if (!formData.obra_id) e.obra_id = 'Selecione a obra.';
    if (!formData.data_inicio) e.data_inicio = 'Informe a data de início.';
    if (formData.data_inicio && formData.data_fim && formData.data_fim < formData.data_inicio) {
      e.data_fim = 'A data fim não pode ser anterior ao início.';
    }
    // Horas alimentam o rateio de custo por obra: zero/vazio zera o custo da alocação.
    const horas = Number(formData.horas_diarias);
    if (!(horas > 0) || horas > 24) e.horas_diarias = 'Informe as horas diárias (entre 1 e 24).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const salvo = alocacao
        ? await base44.entities.AlocacaoObra.update(alocacao.id, data)
        : await base44.entities.AlocacaoObra.create(data);

      // Vínculo único: alocar também garante a pessoa na EQUIPE da obra
      // (ObraColaborador), que é o que alimenta presença/diário/apontamentos.
      // Idempotente no backend; carrega o cargo alocado como função na obra.
      if (data.colaborador_id && data.obra_id) {
        try {
          await base44.functions.invoke('adicionarColaboradorAObra', {
            obra_id: data.obra_id,
            colaborador_id: data.colaborador_id,
            funcao_na_obra: data.cargo_alocado || null,
          });
        } catch (err) {
          // não bloqueia a alocação se o vínculo falhar; apenas avisa
          console.warn('[FormAlocacao] falha ao vincular à equipe:', err?.message);
        }
      }
      return salvo;
    },
    onSuccess: (_r, data) => {
      queryClient.invalidateQueries({ queryKey: ['alocacoes'] });
      queryClient.invalidateQueries({ queryKey: ['alocacoesObra', data.obra_id] });
      queryClient.invalidateQueries({ queryKey: ['equipeObra'] });
      toast.success(alocacao ? 'Alocação atualizada!' : 'Colaborador alocado e vinculado à equipe!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    salvarMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {alocacao ? 'Editar Alocação' : 'Alocar Colaborador em Obra'}
          </DialogTitle>
        </DialogHeader>

        {/* noValidate: a validação é a do `validar()` (mensagem no campo); sem isto o
            balão nativo do navegador barra o submit antes, fora do padrão do sistema. */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <SeletorPessoa
              value={formData.colaborador_id}
              onChange={(id) => setCampo('colaborador_id', id)}
              tipos={['colaborador', 'motorista']}
              label="Colaborador *"
              placeholder="Selecione o colaborador..."
              required
              error={!!errors.colaborador_id}
            />
            {errors.colaborador_id && <p className="text-xs text-red-600 mt-1">{errors.colaborador_id}</p>}
          </div>

          {!obraId && (
            <div>
              <Label className="text-gray-700 font-medium">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(v) => setCampo('obra_id', v)}>
                <SelectTrigger className={`mt-1 ${cls('obra_id')}`}>
                  <SelectValue placeholder="Selecione a obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.obra_id && <p className="text-xs text-red-600 mt-1">{errors.obra_id}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {/* O cargo do CADASTRO já vale por padrão. Este campo só serve para o
                  caso real de alguém exercer outra função NESTA obra (pedreiro que
                  vai como encarregado). Vazio = usa o cargo do colaborador. */}
              <Label className="text-gray-700 font-medium">Cargo nesta obra</Label>
              <Input
                value={formData.cargo_alocado}
                onChange={(e) => setFormData({ ...formData, cargo_alocado: e.target.value })}
                placeholder={cargoDoCadastro || 'Cargo do cadastro'}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                {cargoDoCadastro
                  ? <>Deixe vazio para usar <strong>{cargoDoCadastro}</strong>, do cadastro.</>
                  : 'Opcional — preencha só se a função aqui for diferente do cadastro.'}
              </p>
            </div>

            <div>
              <Label className="text-gray-700 font-medium">Turno *</Label>
              <Select value={formData.turno} onValueChange={(v) => setFormData({...formData, turno: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matutino">Matutino</SelectItem>
                  <SelectItem value="vespertino">Vespertino</SelectItem>
                  <SelectItem value="noturno">Noturno</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium">Horas Diárias *</Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={formData.horas_diarias}
                onChange={(e) => setCampo('horas_diarias', e.target.value === '' ? '' : parseFloat(e.target.value))}
                className={`mt-1 ${cls('horas_diarias')}`}
              />
              {errors.horas_diarias && <p className="text-xs text-red-600 mt-1">{errors.horas_diarias}</p>}
            </div>

            <div>
              <Label className="text-gray-700 font-medium">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium">Data Início *</Label>
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setCampo('data_inicio', e.target.value)}
                className={`mt-1 ${cls('data_inicio')}`}
              />
              {errors.data_inicio && <p className="text-xs text-red-600 mt-1">{errors.data_inicio}</p>}
            </div>

            <div>
              <Label className="text-gray-700 font-medium">Data Fim</Label>
              <Input
                type="date"
                value={formData.data_fim}
                onChange={(e) => setCampo('data_fim', e.target.value)}
                className={`mt-1 ${cls('data_fim')}`}
              />
              {errors.data_fim && <p className="text-xs text-red-600 mt-1">{errors.data_fim}</p>}
            </div>
          </div>

          <div>
            <Label className="text-gray-700 font-medium">Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              className="mt-1 min-h-16"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}