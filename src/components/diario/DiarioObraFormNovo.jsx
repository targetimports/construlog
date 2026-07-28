import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { ClipboardList, Save, CheckCircle2, X } from 'lucide-react';
import DiarioEquipeSection from './DiarioEquipeSection';
import DiarioFotoSection from './DiarioFotoSection';

const STATUS_DIA_OPTIONS = [
  { value: 'NORMAL', label: 'Normal', color: 'bg-green-100 text-green-800' },
  { value: 'MEIO_PERIODO', label: 'Meio Período', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PARALISADO', label: 'Paralisado', color: 'bg-red-100 text-red-800' },
  { value: 'CHUVA', label: 'Chuva', color: 'bg-blue-100 text-blue-800' },
  { value: 'OUTRO', label: 'Outro', color: 'bg-gray-100 text-gray-800' }
];

export default function DiarioObraFormNovo({ diario, obraId, onClose }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    obra_id: obraId || diario?.obra_id || '',
    data: diario?.data || new Date().toISOString().split('T')[0],
    status_dia: diario?.status_dia || 'NORMAL',
    clima: diario?.clima || 'nublado',
    temperatura: diario?.temperatura || '',
    atividades_realizadas: diario?.atividades_realizadas || '',
    responsavel: diario?.responsavel || '',
    observacoes: diario?.observacoes || '',
    status_registro: diario?.status_registro || 'RASCUNHO',
    status: diario?.status || 'rascunho'
  });

  const [equipes, setEquipes] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [user, setUser] = useState(null);
  const [errors, setErrors] = useState({});

  // Atualiza um campo e limpa o erro dele.
  const upd = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrors((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  const cls = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
    enabled: !obraId
  });

  // Carregar equipes e fotos existentes se editando
  useEffect(() => {
    if (diario?.id) {
      base44.entities.DiarioObraEquipe.filter({ diario_id: diario.id }).then(setEquipes).catch(() => {});
      // Carrega fotos das DUAS fontes: DiarioObraFoto (este form) e DiarioObraMidia
      // (evidências adicionadas na seção Diário da obra), normalizando o campo de URL.
      Promise.all([
        base44.entities.DiarioObraFoto.filter({ diario_id: diario.id }).catch(() => []),
        base44.entities.DiarioObraMidia.filter({ diario_id: diario.id }).catch(() => []),
      ]).then(([fotosForm, midias]) => {
        const normMidias = (midias || []).map((m) => ({
          id: m.id,
          _origem: 'midia',
          tipo: m.tipo || 'FOTO',
          url_arquivo: m.arquivo_url,
          legenda: m.legenda || '',
        }));
        setFotos([...(fotosForm || []), ...normMidias]);
      }).catch(() => {});
    }
  }, [diario?.id]);

  const salvarMutation = useMutation({
    mutationFn: async ({ dadosDiario, concluir }) => {
      // Validações
      if (!dadosDiario.obra_id) throw new Error('Selecione uma obra');
      if (!dadosDiario.data) throw new Error('Data é obrigatória');

      const paralisado = dadosDiario.status_dia === 'PARALISADO';

      if (paralisado && !dadosDiario.observacoes?.trim()) {
        throw new Error('Observações são obrigatórias quando o dia está paralisado');
      }

      if (!paralisado && equipes.length === 0) {
        throw new Error('Adicione pelo menos 1 registro de equipe para dias com trabalho');
      }

      if (concluir && fotos.length === 0) {
        throw new Error('Adicione pelo menos 1 foto para concluir o diário');
      }

      if (concluir) {
        dadosDiario.status_registro = 'CONCLUIDO';
        dadosDiario.status = 'finalizado';
        dadosDiario.fechado_em = new Date().toISOString();
        dadosDiario.fechado_por = user?.email || '';
      }

      dadosDiario.qtd_funcionarios = equipes.reduce((s, e) => s + (parseInt(e.quantidade_pessoas) || 0), 0);

      // Salvar diário
      let diarioSalvo;
      if (diario?.id) {
        diarioSalvo = await base44.entities.DiarioObra.update(diario.id, dadosDiario);
      } else {
        // Verificar duplicata data+obra
        const existentes = await base44.entities.DiarioObra.filter({ obra_id: dadosDiario.obra_id, data: dadosDiario.data });
        if (existentes.length > 0) throw new Error('Já existe um diário para esta obra nesta data');
        diarioSalvo = await base44.entities.DiarioObra.create(dadosDiario);
      }

      const diarioId = diarioSalvo?.id || diario?.id;

      // Salvar equipes (deletar antigas e recriar)
      if (diario?.id) {
        const antigas = await base44.entities.DiarioObraEquipe.filter({ diario_id: diarioId });
        await Promise.all(antigas.map(e => base44.entities.DiarioObraEquipe.delete(e.id)));
      }
      await Promise.all(equipes.map(eq => base44.entities.DiarioObraEquipe.create({
        ...eq,
        diario_id: diarioId,
        obra_id: dadosDiario.obra_id,
        horas_trabalhadas: eq.horas_trabalhadas ? parseFloat(eq.horas_trabalhadas) : undefined
      })));

      // Salvar fotos novas (apenas as que têm url_arquivo e não foram salvas antes)
      const fotasNovas = fotos.filter(f => f.url_arquivo && !f.id);
      await Promise.all(fotasNovas.map(f => base44.entities.DiarioObraFoto.create({
        diario_id: diarioId,
        obra_id: dadosDiario.obra_id,
        url_arquivo: f.url_arquivo,
        legenda: f.legenda || '',
        usuario_upload: user?.email || '',
        data_upload: f.data_upload || new Date().toISOString()
      })));

      return diarioSalvo;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['diarios-obra'] });
      toast.success(vars.concluir ? 'Diário concluído com sucesso!' : 'Rascunho salvo!');
      onClose?.();
    },
    onError: (err) => toast.error(err.message)
  });

  // Validação client-side com destaque nos campos (a mutation ainda checa por baixo).
  const validar = () => {
    const e = {};
    if (!form.obra_id) e.obra_id = 'Selecione a obra.';
    if (!form.data) e.data = 'Informe a data.';
    if (form.status_dia === 'PARALISADO' && !form.observacoes?.trim()) {
      e.observacoes = 'Observações são obrigatórias quando o dia está paralisado.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = (concluir = false) => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    salvarMutation.mutate({ dadosDiario: { ...form }, concluir });
  };

  const isConcluido = diario?.status_registro === 'CONCLUIDO';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">{diario?.id ? 'Editar Diário' : 'Novo Diário de Obra'}</CardTitle>
              {isConcluido && <Badge className="bg-green-100 text-green-800">Concluído</Badge>}
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Dados Básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!obraId && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Obra *</label>
                <ComboboxBusca
                  options={obras.map(o => ({ value: o.id, label: o.nome }))}
                  value={form.obra_id}
                  onSelect={(v) => upd('obra_id', v)}
                  disabled={isConcluido}
                  placeholder="Selecione uma obra..."
                  className={cls('obra_id')}
                />
                {errors.obra_id && <p className="text-xs text-red-600 mt-1">{errors.obra_id}</p>}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Data *</label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => upd('data', e.target.value)}
                disabled={isConcluido}
                className={cls('data')}
              />
              {errors.data && <p className="text-xs text-red-600 mt-1">{errors.data}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status do Dia *</label>
              <select
                value={form.status_dia}
                onChange={(e) => setForm({ ...form, status_dia: e.target.value })}
                disabled={isConcluido}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {STATUS_DIA_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Clima</label>
              <select
                value={form.clima}
                onChange={(e) => setForm({ ...form, clima: e.target.value })}
                disabled={isConcluido}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="ensolarado">Ensolarado</option>
                <option value="nublado">Nublado</option>
                <option value="chuvoso">Chuvoso</option>
                <option value="tempestade">Tempestade</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Temperatura</label>
              <Input
                value={form.temperatura}
                onChange={(e) => setForm({ ...form, temperatura: e.target.value })}
                placeholder="Ex: 28°C"
                disabled={isConcluido}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Responsável</label>
              <Input
                value={form.responsavel}
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                placeholder="Nome do responsável"
                disabled={isConcluido}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Atividades Realizadas</label>
            <textarea
              value={form.atividades_realizadas}
              onChange={(e) => setForm({ ...form, atividades_realizadas: e.target.value })}
              rows={3}
              disabled={isConcluido}
              placeholder="Descreva as atividades do dia..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Observações {form.status_dia === 'PARALISADO' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => upd('observacoes', e.target.value)}
              rows={2}
              disabled={isConcluido}
              placeholder={form.status_dia === 'PARALISADO' ? 'Informe o motivo da paralisação...' : 'Observações adicionais...'}
              className={`w-full px-3 py-2 border rounded-lg text-sm resize-none ${errors.observacoes ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.observacoes && <p className="text-xs text-red-600 mt-1">{errors.observacoes}</p>}
          </div>

          {/* Equipes */}
          {!isConcluido && (
            <DiarioEquipeSection equipes={equipes} onChange={setEquipes} />
          )}
          {isConcluido && equipes.length > 0 && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-sm font-medium mb-2 text-gray-700">Equipes ({equipes.length})</p>
              {equipes.map((eq, i) => (
                <div key={i} className="text-sm text-gray-600">
                  {eq.nome_equipe_ou_funcionario} — {eq.funcao} — {eq.quantidade_pessoas} pessoa(s) — {eq.periodo_trabalho === 'DIA_COMPLETO' ? 'Dia Completo' : 'Meio Período'}
                </div>
              ))}
            </div>
          )}

          {/* Fotos */}
          <DiarioFotoSection
            fotos={fotos}
            onChange={isConcluido ? () => {} : setFotos}
            usuario={user?.email}
          />

          {/* Ações */}
          {!isConcluido && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSalvar(false)}
                disabled={salvarMutation.isPending}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Rascunho
              </Button>
              <Button
                type="button"
                onClick={() => handleSalvar(true)}
                disabled={salvarMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {salvarMutation.isPending ? 'Salvando...' : 'Concluir Dia'}
              </Button>
              {onClose && (
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              )}
            </div>
          )}

          {isConcluido && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">Diário concluído em {diario.fechado_em ? new Date(diario.fechado_em).toLocaleString('pt-BR') : '—'}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}