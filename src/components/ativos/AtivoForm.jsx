import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';
import { Upload, X, AlertCircle } from 'lucide-react';

const lbl = 'block text-sm font-medium text-gray-700 mb-1';

// Estado zerado do formulário. Serve de base tanto na montagem quanto no RESET ao abrir
// "Novo Ativo" — sem isso o modal de cadastro reaproveitava os dados do último ativo
// editado (e o usuário salvaria um ativo novo com código/medidor de outro).
const FORM_VAZIO = {
  codigo: '',
  nome: '',
  tipo: 'ferramenta',
  descricao: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  status: 'disponivel',
  localizacao_atual: 'almoxarifado',
  obra_atual_id: '',
  valor_aquisicao: '',
  valor_atual: '',
  data_aquisicao: '',
  responsavel_atual: '',
  custo_hora: '',
  custo_diaria: '',
  placa: '',
  km_atual: '',
  horimetro_atual: '',
  observacoes: '',
};

export default function AtivoForm({ open, onOpenChange, ativo }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setFormData((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };
  const [foto, setFoto] = useState(null);
  const fotoInputRef = useRef();
  const ehVeiculo = String(formData.tipo).includes('veiculo');
  // Medidor só para o que TEM medidor: ferramenta não tem horímetro nem hodômetro.
  const mostraMedidores = ['veiculo', 'veiculo_pequeno', 'maquina', 'equipamento'].includes(formData.tipo);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  // Código é a plaquinha do equipamento: repetido, ninguém sabe qual ativo foi
  // emprestado ou vistoriado. Avisa já na digitação; o servidor barra de todo jeito.
  const { data: ativosExistentes = [] } = useQuery({
    queryKey: ['ativos-codigos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 1000).catch(() => []),
    enabled: open,
  });
  const codigoDuplicado = useMemo(() => {
    const cod = String(formData.codigo || '').trim().toLowerCase();
    if (!cod) return null;
    return ativosExistentes.find((a) => String(a.codigo || '').trim().toLowerCase() === cod && a.id !== ativo?.id) || null;
  }, [formData.codigo, ativosExistentes, ativo?.id]);

  useEffect(() => {
    // Só reage à ABERTURA do modal: fechando, o estado antigo pode ficar (o modal some).
    if (!open) return;
    if (ativo) {
      setFormData({
        codigo: ativo.codigo || '',
        nome: ativo.nome || '',
        tipo: ativo.tipo || 'ferramenta',
        descricao: ativo.descricao || '',
        marca: ativo.marca || '',
        modelo: ativo.modelo || '',
        numero_serie: ativo.numero_serie || '',
        status: ativo.status || 'disponivel',
        localizacao_atual: ativo.localizacao_atual || 'almoxarifado',
        obra_atual_id: ativo.obra_atual_id || '',
        valor_aquisicao: ativo.valor_aquisicao || '',
        valor_atual: ativo.valor_atual || '',
        data_aquisicao: ativo.data_aquisicao || '',
        responsavel_atual: ativo.responsavel_atual || '',
        custo_hora: ativo.custo_hora ?? '',
        custo_diaria: ativo.custo_diaria ?? '',
        placa: ativo.placa || '',
        km_atual: ativo.km_atual ?? '',
        horimetro_atual: ativo.horimetro_atual ?? '',
        observacoes: ativo.observacoes || ''
      });
      setFoto(ativo.foto || null);
    } else {
      // "Novo Ativo": zera tudo, inclusive a foto do ativo editado anteriormente.
      setFormData(FORM_VAZIO);
      setFoto(null);
    }
    setErrors({});
  }, [ativo, open]);

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      let fotoUrl = foto;
      if (foto && typeof foto !== 'string') {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: foto });
        fotoUrl = file_url;
      }

      const dataToSave = {
        ...data,
        valor_aquisicao: data.valor_aquisicao ? parseFloat(data.valor_aquisicao) : null,
        valor_atual: data.valor_atual ? parseFloat(data.valor_atual) : null,
        custo_hora: data.custo_hora ? parseFloat(data.custo_hora) : 0,
        custo_diaria: data.custo_diaria ? parseFloat(data.custo_diaria) : 0,
        km_atual: Number(data.km_atual) || 0,
        horimetro_atual: Number(data.horimetro_atual) || 0,
        foto: fotoUrl
      };

      const saved = ativo
        ? await base44.entities.Ativo.update(ativo.id, dataToSave)
        : await base44.entities.Ativo.create(dataToSave);
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ativos']);
      queryClient.invalidateQueries(['ativos-codigos']);
      toast.success(ativo ? 'Ativo atualizado!' : 'Ativo criado!');
      onOpenChange(false);
    },
    onError: (error) => {
      // O servidor manda a mensagem pronta (ex.: código duplicado); mostra ela, não a genérica.
      const msg = error?.response?.data?.message || error?.data?.message || error?.message || 'erro desconhecido';
      toast.error('Erro: ' + msg);
    }
  });

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) setFoto(file);
  };

  const validar = () => {
    const e = {};
    if (!formData.codigo?.trim()) e.codigo = 'Informe o código';
    if (!formData.nome?.trim()) e.nome = 'Informe o nome';

    // "Em obra" sem obra deixa o ativo perdido: não aparece na obra nem no almoxarifado.
    if (formData.localizacao_atual === 'em_obra' && !formData.obra_atual_id) {
      e.obra_atual_id = 'Selecione a obra';
    }

    const naoNegativo = (campo, rotulo) => {
      if (formData[campo] !== '' && Number(formData[campo]) < 0) e[campo] = `${rotulo} não pode ser negativo`;
    };
    naoNegativo('valor_aquisicao', 'Valor');
    naoNegativo('valor_atual', 'Valor');
    naoNegativo('custo_hora', 'Custo');
    naoNegativo('custo_diaria', 'Custo');
    naoNegativo('km_atual', 'Medidor');
    naoNegativo('horimetro_atual', 'Medidor');

    if (formData.data_aquisicao && formData.data_aquisicao > new Date().toISOString().split('T')[0]) {
      e.data_aquisicao = 'A aquisição não pode ser futura';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (codigoDuplicado) {
      toast.error(`Código já usado por "${codigoDuplicado.nome || codigoDuplicado.codigo}". Escolha outro.`);
      return;
    }
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    salvarMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ativo ? 'Editar Ativo' : 'Novo Ativo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={lbl}>Código *</Label>
              <Input
                className={`h-11 ${codigoDuplicado || errors.codigo ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={formData.codigo}
                onChange={(e) => set('codigo', e.target.value)}
              />
              {errors.codigo && <p className="text-xs text-red-500 mt-1">{errors.codigo}</p>}
              {codigoDuplicado && (
                <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Este código já é do ativo “{codigoDuplicado.nome || codigoDuplicado.codigo}”. Use outro.
                </p>
              )}
            </div>
            <div>
              <Label className={lbl}>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ferramenta">Ferramenta</SelectItem>
                  <SelectItem value="equipamento">Equipamento</SelectItem>
                  <SelectItem value="maquina">Máquina</SelectItem>
                  <SelectItem value="veiculo">Veículo</SelectItem>
                  <SelectItem value="veiculo_pequeno">Veículo Pequeno</SelectItem>
                  <SelectItem value="movel">Móvel</SelectItem>
                  <SelectItem value="eletronico">Eletrônico</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className={lbl}>Nome *</Label>
            <Input className={`h-11 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.nome} onChange={(e) => set('nome', e.target.value)} />
            {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
          </div>

          <div>
            <Label className={lbl}>Descrição</Label>
            <Textarea className="min-h-20" value={formData.descricao} onChange={(e) => set('descricao', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className={lbl}>Marca</Label>
              <Input className="h-11" value={formData.marca} onChange={(e) => set('marca', e.target.value)} />
            </div>
            <div>
              <Label className={lbl}>Modelo</Label>
              <Input className="h-11" value={formData.modelo} onChange={(e) => set('modelo', e.target.value)} />
            </div>
            <div>
              <Label className={lbl}>Número Série</Label>
              <Input className="h-11" value={formData.numero_serie} onChange={(e) => set('numero_serie', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className={lbl}>Status</Label>
            <Select value={formData.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Placa (veículo / veículo pequeno) */}
          {ehVeiculo && (
            <div>
              <Label className={lbl}>Placa</Label>
              <Input className="h-11" value={formData.placa} onChange={(e) => set('placa', e.target.value)} placeholder="ABC-1234" />
            </div>
          )}

          {/* Medidores (veículo / máquina / equipamento) */}
          {mostraMedidores && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Medidores</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className={lbl}>Quilometragem atual (km)</Label>
                  <Input className={`h-11 ${errors.km_atual ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={formData.km_atual} onChange={(e) => set('km_atual', e.target.value)} />
                  {errors.km_atual && <p className="text-xs text-red-500 mt-1">{errors.km_atual}</p>}
                </div>
                <div>
                  <Label className={lbl}>Horímetro atual (h)</Label>
                  <Input className={`h-11 ${errors.horimetro_atual ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={formData.horimetro_atual} onChange={(e) => set('horimetro_atual', e.target.value)} />
                  {errors.horimetro_atual && <p className="text-xs text-red-500 mt-1">{errors.horimetro_atual}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={lbl}>Localização Atual</Label>
              <Select value={formData.localizacao_atual} onValueChange={(v) => { set('localizacao_atual', v); setErrors((p) => ({ ...p, obra_atual_id: null })); }}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="almoxarifado">Almoxarifado</SelectItem>
                  <SelectItem value="em_obra">Em Obra</SelectItem>
                  <SelectItem value="em_transito">Em Trânsito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.localizacao_atual === 'em_obra' && (
              <div>
                <Label className={lbl}>Obra Atual *</Label>
                <ComboboxBusca
                  options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                  value={formData.obra_atual_id}
                  onSelect={(v) => set('obra_atual_id', v || '')}
                  placeholder="Selecione..." searchPlaceholder="Buscar obra..." emptyMessage="Nenhuma obra."
                  className={errors.obra_atual_id ? 'border-red-400' : ''}
                />
                {errors.obra_atual_id && <p className="text-xs text-red-500 mt-1">{errors.obra_atual_id}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className={lbl}>Valor Aquisição (R$)</Label>
              <Input className={`h-11 ${errors.valor_aquisicao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={formData.valor_aquisicao} onChange={(e) => set('valor_aquisicao', e.target.value)} />
              {errors.valor_aquisicao && <p className="text-xs text-red-500 mt-1">{errors.valor_aquisicao}</p>}
            </div>
            <div>
              <Label className={lbl}>Valor Atual (R$)</Label>
              <Input className={`h-11 ${errors.valor_atual ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={formData.valor_atual} onChange={(e) => set('valor_atual', e.target.value)} />
              {errors.valor_atual && <p className="text-xs text-red-500 mt-1">{errors.valor_atual}</p>}
            </div>
            <div>
              <Label className={lbl}>Data Aquisição</Label>
              <Input className={`h-11 ${errors.data_aquisicao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="date" value={formData.data_aquisicao} onChange={(e) => set('data_aquisicao', e.target.value)} />
              {errors.data_aquisicao && <p className="text-xs text-red-500 mt-1">{errors.data_aquisicao}</p>}
            </div>
          </div>

          {/* Tarifa operacional — SEMPRE visível: qualquer ativo pode ser emprestado a uma
              obra, e sem tarifa cadastrada o empréstimo sai com custo zero em silêncio. */}
          {(
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Tarifa operacional (custo de uso)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className={lbl}>Custo por hora (R$)</Label>
                  <Input className={`h-11 ${errors.custo_hora ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={formData.custo_hora} onChange={(e) => set('custo_hora', e.target.value)} />
                  {errors.custo_hora && <p className="text-xs text-red-500 mt-1">{errors.custo_hora}</p>}
                </div>
                <div>
                  <Label className={lbl}>Custo por dia (R$)</Label>
                  <Input className={`h-11 ${errors.custo_diaria ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={formData.custo_diaria} onChange={(e) => set('custo_diaria', e.target.value)} />
                  {errors.custo_diaria && <p className="text-xs text-red-500 mt-1">{errors.custo_diaria}</p>}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Usada no "Registrar Horas" e no empréstimo para obra. Máquina/equipamento cobra por hora
                quando o custo/hora está preenchido; veículo cobra por diária. Em branco = empréstimo sem custo.
              </p>
            </div>
          )}

          <div>
            <Label className={lbl}>Responsável Atual</Label>
            <ComboboxBusca
              options={colaboradores.map(c => ({ value: c.email || c.nome, label: c.nome || c.email }))}
              value={formData.responsavel_atual}
              onSelect={(v) => set('responsavel_atual', v || '')}
              placeholder="Selecione..." searchPlaceholder="Buscar colaborador..." emptyMessage="Nenhum colaborador."
            />
          </div>

          <div>
            <Label className={lbl}>Foto</Label>
            <input ref={fotoInputRef} type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
            <div className="flex gap-3 items-center">
              <Button type="button" onClick={() => fotoInputRef.current?.click()} variant="outline" className="h-11 border-gray-300 text-gray-700">
                <Upload className="w-4 h-4 mr-2" />
                Enviar Foto
              </Button>
              {foto && (
                <div className="flex items-center gap-2">
                  {typeof foto === 'string' ? (
                    <img src={foto} alt="Ativo" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <span className="text-sm text-gray-600">{foto.name}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label className={lbl}>Observações</Label>
            <Textarea className="min-h-20" value={formData.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending || !!codigoDuplicado} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}