import React, { useState } from 'react';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Check, Lock, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MotivosBaixaProducaoSection from '../diario/MotivosBaixaProducaoSection';
import DiarioMidiaGaleria from '../diario/DiarioMidiaGaleria';

const STATUS_DIA_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'MEIO_PERIODO', label: 'Meio Período' },
  { value: 'PARALISADO', label: 'Paralisado' },
  { value: 'CHUVA', label: 'Chuva' },
  { value: 'OUTRO', label: 'Outro' },
];

const CLIMA_OPTIONS = [
  { value: 'ensolarado', label: 'Ensolarado' },
  { value: 'nublado', label: 'Nublado' },
  { value: 'chuvoso', label: 'Chuvoso' },
];

export default function DiarioObraTab({ obraId, user, podeEditar = true }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [producaoLocal, setProducaoLocal] = useState('');
  const [observacaoLocal, setObservacaoLocal] = useState('');
  const [statusDia, setStatusDia] = useState('NORMAL');
  const [clima, setClima] = useState('nublado');
  const [temperatura, setTemperatura] = useState('');
  const [responsavelLocal, setResponsavelLocal] = useState('');
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();

  // Valida antes de salvar/aprovar. Produção só é exigida ao APROVAR (congelar):
  // salvar rascunho pode ser incompleto, aprovar um diário vazio não.
  const validar = (aprovar) => {
    const e = {};
    if (statusDia === 'PARALISADO' && !observacaoLocal.trim()) {
      e.observacao = 'Observação obrigatória quando o dia está paralisado.';
    }
    if (aprovar && !producaoLocal.trim()) {
      e.producao = 'Descreva a produção do dia antes de aprovar.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Buscar diário da data selecionada
  const { data: diario, isLoading, refetch: refetchDiario } = useQuery({
    queryKey: ['diario-obra', obraId, selectedDate],
    queryFn: async () => {
      const result = await base44.entities.DiarioObra.filter(
        { obra_id: obraId, data: selectedDate },
        null,
        1
      );
      return result && result.length > 0 ? result[0] : null;
    },
    enabled: !!obraId && !!selectedDate
  });

  // Sincronizar estado local com diário carregado
  React.useEffect(() => {
    if (diario) {
      setProducaoLocal(diario.atividades_realizadas || '');
      setObservacaoLocal(diario.observacoes || '');
      setStatusDia(diario.status_dia || 'NORMAL');
      setClima(diario.clima || 'nublado');
      setTemperatura(diario.temperatura || '');
      setResponsavelLocal(diario.responsavel || user?.full_name || '');
    } else {
      setProducaoLocal('');
      setObservacaoLocal('');
      setStatusDia('NORMAL');
      setClima('nublado');
      setTemperatura('');
      setResponsavelLocal(user?.full_name || '');
    }
  }, [diario, user]);

  // Mutations
  const criarDiarioMutation = useMutation({
    mutationFn: () =>
      base44.entities.DiarioObra.create({
        obra_id: obraId,
        data: selectedDate,
        responsavel_id: user?.id,
        responsavel: user?.full_name,
        atividades_realizadas: '',
        observacoes: '',
        status_dia: 'NORMAL',
        clima: 'nublado',
        temperatura: '',
        status_registro: 'RASCUNHO'
      }),
    onSuccess: () => {
      refetchDiario();
      toast.success('Diário criado');
    },
    onError: (err) => toast.error(err.message || 'Erro ao criar diário')
  });

  const salvarDiarioMutation = useMutation({
    mutationFn: () =>
      base44.entities.DiarioObra.update(diario.id, {
        atividades_realizadas: producaoLocal,
        observacoes: observacaoLocal,
        status_dia: statusDia,
        clima,
        temperatura,
        responsavel: responsavelLocal,
      }),
    onSuccess: () => {
      refetchDiario();
      toast.success('Diário salvo');
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar diário')
  });

  const aprovarDiarioMutation = useMutation({
    mutationFn: () =>
      base44.entities.DiarioObra.update(diario.id, {
        // Salva os dados do formulário JUNTO com a aprovação (evita perder o
        // que foi digitado quando o usuário clica em Aprovar sem Salvar antes).
        atividades_realizadas: producaoLocal,
        observacoes: observacaoLocal,
        status_dia: statusDia,
        clima,
        temperatura,
        responsavel: responsavelLocal,
        status_registro: 'CONCLUIDO',
        fechado_em: new Date().toISOString(),
        fechado_por: user?.email
      }),
    onSuccess: () => {
      refetchDiario();
      toast.success('Diário aprovado e congelado');
    },
    onError: (err) => toast.error(err.message || 'Erro ao aprovar diário')
  });

  const isApproved = diario?.status_registro === 'CONCLUIDO';
  const perfisAdmin = ['admin', 'programador', 'owner', 'superadmin', 'gestao'];
  const isAdmin = perfisAdmin.includes(user?.role) || perfisAdmin.includes(user?.perfil_acesso);
  const canEdit = !isApproved || isAdmin;

  return (
    <div className="space-y-6">
      {/* Seletor de Data */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Calendar className="w-5 h-5" />
            Selecione a Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border-gray-300 text-gray-900 max-w-xs"
            disabled={isApproved && !isAdmin}
          />
        </CardContent>
      </Card>

      {/* Área do Diário */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : !diario ? (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-600" />
              <p className="text-gray-500">Nenhum diário para {format(parseISO(selectedDate), 'dd/MM/yyyy', { locale: ptBR })}</p>
              {podeEditar && (
                <Button
                  onClick={() => criarDiarioMutation.mutate()}
                  disabled={criarDiarioMutation.isPending}
                  className="bg-gray-900 hover:bg-gray-800 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Diário
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              {isApproved && <Lock className="w-5 h-5 text-yellow-500" />}
              <Badge className={isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                {isApproved ? '✓ Aprovado' : 'Rascunho'}
              </Badge>
            </div>
            {isApproved && (
              <div className="text-sm text-gray-500 break-words">
                Aprovado por {diario.fechado_por} em {format(parseISO(diario.fechado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
          </div>

          {isApproved && !isAdmin && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-sm">Este diário foi aprovado e está congelado. Apenas administradores podem editar.</p>
            </div>
          )}

          {/* Formulário */}
          <div className="space-y-4">
            {/* Condições do Dia */}
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Condições do Dia</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status do Dia *</label>
                  <select
                    value={statusDia}
                    onChange={(e) => setStatusDia(e.target.value)}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm disabled:opacity-60"
                  >
                    {STATUS_DIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clima</label>
                  <select
                    value={clima}
                    onChange={(e) => setClima(e.target.value)}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm disabled:opacity-60"
                  >
                    {CLIMA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura</label>
                  <Input
                    value={temperatura}
                    onChange={(e) => setTemperatura(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Ex: 28°C"
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                  <Input
                    value={responsavelLocal}
                    onChange={(e) => setResponsavelLocal(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Nome do responsável"
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Produção do Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Descreva as atividades e produções realizadas..."
                  value={producaoLocal}
                  onChange={(e) => { setProducaoLocal(e.target.value); if (errors.producao) setErrors(er => ({ ...er, producao: undefined })); }}
                  disabled={!canEdit || salvarDiarioMutation.isPending}
                  className={`bg-white text-gray-900 min-h-32 ${errors.producao ? 'border-red-400 focus-visible:ring-red-400' : 'border-gray-300'}`}
                />
                {errors.producao && <p className="text-xs text-red-600 mt-1">{errors.producao}</p>}
              </CardContent>
            </Card>

            <MotivosBaixaProducaoSection diarioId={diario.id} disabled={!canEdit} />

            <DiarioMidiaGaleria diarioId={diario.id} canEdit={canEdit} diarioStatus={diario.status_registro} />

            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Observação Geral {statusDia === 'PARALISADO' && <span className="text-red-500">*</span>}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Observações gerais sobre o dia..."
                  value={observacaoLocal}
                  onChange={(e) => { setObservacaoLocal(e.target.value); if (errors.observacao) setErrors(er => ({ ...er, observacao: undefined })); }}
                  disabled={!canEdit || salvarDiarioMutation.isPending}
                  className={`bg-white text-gray-900 min-h-32 ${errors.observacao ? 'border-red-400 focus-visible:ring-red-400' : 'border-gray-300'}`}
                />
                {errors.observacao && <p className="text-xs text-red-600 mt-1">{errors.observacao}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Botões de Ação */}
          {canEdit && podeEditar && (
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => { if (!validar(false)) { toast.error('Verifique os campos destacados.'); return; } salvarDiarioMutation.mutate(); }}
                disabled={salvarDiarioMutation.isPending}
                className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Salvar
              </Button>
              <Button
                onClick={() => { if (!validar(true)) { toast.error('Verifique os campos destacados.'); return; } aprovarDiarioMutation.mutate(); }}
                disabled={aprovarDiarioMutation.isPending}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 gap-2"
              >
                <Check className="w-4 h-4" />
                Aprovar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}