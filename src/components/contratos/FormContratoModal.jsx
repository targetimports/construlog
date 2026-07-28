import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import GerenciadorAnexos from '@/components/shared/GerenciadorAnexos';

const VAZIO = {
  numero: '', titulo: '', tipo: 'fornecimento', obra_id: '', fornecedor_id: '', contratado_tipo: 'fornecedor', contratado_nome: '',
  valor_inicial: 0, valor_total: 0, data_assinatura: '', data_inicio: '', data_fim_prevista: '', observacoes: '', status: 'ativo',
};

export default function FormContratoModal({ open, onClose, onSave, contrato = null }) {
  const [formData, setFormData] = useState(VAZIO);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => { setFormData(contrato ? { ...VAZIO, ...contrato } : VAZIO); setErrors({}); }, [contrato, open]);

  // Borda vermelha quando o campo tem erro.
  const cls = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');

  const { data: obras = [] } = useQuery({ queryKey: ['obras-contrato-form'], queryFn: () => base44.entities.Obra.list('-created_date', 500), enabled: open });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores-contrato-form'], queryFn: () => base44.entities.Fornecedor.list('-created_date', 1000).catch(() => []), enabled: open });
  const { data: terceirizados = [] } = useQuery({ queryKey: ['terceirizados-contrato-form'], queryFn: () => base44.entities.ProfissionalTerceirizado.list('-created_date', 1000).catch(() => []), enabled: open });

  // Contratado por tipo de contrato: serviço/subcontratação/empreitada mostram
  // fornecedores de serviço/equipamento + terceirizados; fornecimento mostra materiais.
  const ehServico = ['prestacao_servico', 'subcontratacao', 'empreitada'].includes(formData.tipo);
  const contratadoOptions = useMemo(() => {
    const fornOpts = fornecedores
      .filter((f) => {
        const cat = String(f.categoria || '').toLowerCase();
        if (formData.tipo === 'empreitada') return true;
        if (formData.tipo === 'fornecimento') return cat !== 'serviço' && cat !== 'servico';
        return cat !== 'material'; // serviço / subcontratação
      })
      .map((f) => ({ value: `f:${f.id}`, label: `${f.nome || f.razao_social || f.id}${f.categoria ? ` · ${f.categoria}` : ''}` }));
    const tercOpts = ehServico
      ? terceirizados.map((t) => ({ value: `t:${t.id}`, label: `${t.nome} (Terceirizado)` }))
      : [];
    return [...tercOpts, ...fornOpts];
  }, [fornecedores, terceirizados, formData.tipo, ehServico]);

  const contratadoValue = formData.fornecedor_id
    ? `${formData.contratado_tipo === 'terceirizado' ? 't' : 'f'}:${formData.fornecedor_id}`
    : '';
  const selecionarContratado = (v) => {
    if (!v) { setFormData((p) => ({ ...p, fornecedor_id: '', contratado_tipo: 'fornecedor', contratado_nome: '' })); return; }
    const [pref, id] = v.split(':');
    if (pref === 't') {
      const t = terceirizados.find((x) => x.id === id);
      setFormData((p) => ({ ...p, fornecedor_id: id, contratado_tipo: 'terceirizado', contratado_nome: t?.nome || '' }));
    } else {
      const f = fornecedores.find((x) => x.id === id);
      setFormData((p) => ({ ...p, fornecedor_id: id, contratado_tipo: 'fornecedor', contratado_nome: f?.nome || f?.razao_social || '' }));
    }
  };

  const set = (campo, valor) => {
    setFormData((p) => ({ ...p, [campo]: valor }));
    setErrors((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  const handleChange = (e) => set(e.target.name, e.target.value);

  const validar = () => {
    const e = {};
    if (!formData.numero?.trim()) e.numero = 'Informe o número do contrato.';
    if (!formData.obra_id) e.obra_id = 'Selecione a obra.';
    if (!formData.fornecedor_id) e.fornecedor_id = 'Selecione o contratado.';
    if (!(Number(formData.valor_total) > 0)) e.valor_total = 'Informe um valor total maior que zero.';
    if (formData.data_inicio && formData.data_fim_prevista && formData.data_fim_prevista < formData.data_inicio) {
      e.data_fim_prevista = 'O fim previsto não pode ser anterior ao início.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validar()) {
      toast.error('Verifique os campos destacados.');
      return;
    }
    setLoading(true);
    try {
      if (contrato?.id) {
        await base44.functions.invoke('editarContrato', { contrato_id: contrato.id, ...formData });
        toast.success('Contrato atualizado');
      } else {
        const result = await base44.functions.invoke('criarContrato', formData);
        if (result?.data?.ok !== false) toast.success('Contrato criado');
      }
      onSave?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900">{contrato?.id ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Número *</Label>
              <Input name="numero" value={formData.numero} onChange={handleChange} placeholder="ex: CT-001" className={`mt-1 ${cls('numero')}`} />
              {errors.numero && <p className="text-xs text-red-600 mt-1">{errors.numero}</p>}
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empreitada">Empreitada</SelectItem>
                  <SelectItem value="fornecimento">Fornecimento</SelectItem>
                  <SelectItem value="prestacao_servico">Prestação de Serviço</SelectItem>
                  <SelectItem value="subcontratacao">Subcontratação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Título</Label>
            <Input name="titulo" value={formData.titulo} onChange={handleChange} placeholder="Título do contrato" className="mt-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Obra *</Label>
              <ComboboxBusca
                options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                value={formData.obra_id} onSelect={(v) => set('obra_id', v)}
                placeholder="Selecione a obra" searchPlaceholder="Buscar obra..." emptyMessage="Nenhuma obra."
                className={cls('obra_id')}
              />
              {errors.obra_id && <p className="text-xs text-red-600 mt-1">{errors.obra_id}</p>}
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Contratado *</Label>
              <ComboboxBusca
                options={contratadoOptions}
                value={contratadoValue} onSelect={selecionarContratado}
                placeholder={ehServico ? 'Fornecedor ou terceirizado' : 'Selecione o fornecedor'}
                searchPlaceholder="Buscar..."
                emptyMessage={ehServico ? 'Nenhum fornecedor de serviço/terceirizado. Cadastre em Fornecedores ou Profissionais Terceirizados.' : 'Nenhum fornecedor cadastrado.'}
                className={cls('fornecedor_id')}
              />
              {errors.fornecedor_id
                ? <p className="text-xs text-red-600 mt-1">{errors.fornecedor_id}</p>
                : ehServico && <p className="text-[11px] text-gray-400 mt-1">Serviço/subcontratação: inclui fornecedores de serviço e profissionais terceirizados.</p>}
            </div>
          </div>

          {/* "Categoria Financeira" removida: gravava categoria_id e NINGUÉM lia esse
              valor depois (nenhum relatório/DRE/filtro). Além disso a lista vinha
              sempre vazia — a tela /CategoriasFinanceiras existe mas está fora do
              menu, então não havia como cadastrar. A DRE já classifica o custo por
              bucket (material/mão de obra/equipamento/indireta) sozinha. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Status</Label>
              <Select value={formData.status || 'ativo'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Valor Total (R$) *</Label>
              <Input type="number" step="0.01" name="valor_total" value={formData.valor_total} onChange={handleChange} placeholder="0,00" className={`mt-1 ${cls('valor_total')}`} />
              {errors.valor_total && <p className="text-xs text-red-600 mt-1">{errors.valor_total}</p>}
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Data de Assinatura</Label>
              <Input type="date" name="data_assinatura" value={formData.data_assinatura || ''} onChange={handleChange} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Data Início</Label>
              <Input type="date" name="data_inicio" value={formData.data_inicio || ''} onChange={handleChange} className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Data Fim Prevista</Label>
              <Input type="date" name="data_fim_prevista" value={formData.data_fim_prevista || ''} onChange={handleChange} className={`mt-1 ${cls('data_fim_prevista')}`} />
              {errors.data_fim_prevista && <p className="text-xs text-red-600 mt-1">{errors.data_fim_prevista}</p>}
            </div>
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Observações</Label>
            <Textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows={2} className="mt-1" />
          </div>

          {contrato?.id && (
            <GerenciadorAnexos entidadeId={contrato.id} tipoEntidade="contrato" podeEditar={true} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
