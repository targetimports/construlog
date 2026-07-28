import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';

const TIPO_VINCULO_OPCOES = [
  { value: 'obra', label: 'Obra' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'visita_tecnica', label: 'Visita Técnica' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'administrativo', label: 'Administrativo' },
];
const URGENCIA_OPCOES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];
const TIPO_VEICULO_OPCOES = [
  { value: 'qualquer', label: 'Qualquer um' },
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhonete', label: 'Caminhonete' },
  { value: 'caminhao', label: 'Caminhão' },
];
const UNIDADE_OPCOES = [
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'ton', label: 'Toneladas (ton)' },
  { value: 'm3', label: 'Metros cúbicos (m³)' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'caixas', label: 'Caixas' },
  { value: 'sacos', label: 'Sacos' },
  { value: 'litros', label: 'Litros' },
];

export default function SolicitacaoVeiculoForm({ onClose, onSuccess }) {
  const { obraAtual } = useGlobalContext();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo_vinculo: 'obra',
    obra_id: obraAtual?.id || '',
    finalidade: '',
    origem: '',
    destino: '',
    data_saida_prevista: '',
    data_retorno_prevista: '',
    urgencia: 'media',
    tipo_veiculo_necessario: 'qualquer',
    passageiros_qtd: 1,
    quantidade_estimada: '',
    unidade_medida: 'kg',
    carga_descricao: '',
    referencia_vinculo: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const obraOptions = useMemo(
    () => obras.map((o) => ({ value: o.id, label: o.nome || o.nome_obra || o.id })),
    [obras]
  );

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.finalidade.trim()) { toast.error('Informe a finalidade'); return; }
    if (!form.data_saida_prevista) { toast.error('Informe a data de saída'); return; }
    if (form.quantidade_estimada === '' || Number(form.quantidade_estimada) < 0) { toast.error('Informe a quantidade estimada'); return; }
    if (form.tipo_vinculo === 'obra' && !form.obra_id) { toast.error('Selecione a obra'); return; }

    setLoading(true);
    const payload = {
      ...form,
      obra_id: form.tipo_vinculo === 'obra' ? form.obra_id : null,
      passageiros_qtd: parseInt(form.passageiros_qtd, 10) || 1,
      quantidade_estimada: Number(form.quantidade_estimada) || 0,
      data_saida_prevista: form.data_saida_prevista ? new Date(form.data_saida_prevista).toISOString() : null,
      data_retorno_prevista: form.data_retorno_prevista ? new Date(form.data_retorno_prevista).toISOString() : null
    };

    // Retry automático (502 = cold start do servidor)
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await base44.functions.invoke('criarSolicitacaoVeiculoComContexto', payload);
        if (response?.data?.success) {
          toast.success('Solicitação criada!');
          onSuccess();
          setLoading(false);
          return;
        }
        break;
      } catch (error) {
        const is502 = error?.response?.status === 502 || error?.message?.includes('502') || error?.message?.includes('Bad Gateway');
        if (is502 && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        toast.error('Erro ao criar solicitação: ' + (error?.response?.data?.error || error.message));
        break;
      }
    }
    setLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Veículo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Vínculo */}
          <div>
            <Label className="mb-1 block">Tipo de Vínculo</Label>
            <ComboboxBusca
              options={TIPO_VINCULO_OPCOES}
              value={form.tipo_vinculo}
              onSelect={(v) => set('tipo_vinculo', v)}
              placeholder="Selecione o tipo"
              searchPlaceholder="Buscar tipo..."
            />
          </div>

          {/* Seleção de Obra (quando vínculo = obra) */}
          {form.tipo_vinculo === 'obra' && (
            <div>
              <Label className="mb-1 block">Obra *</Label>
              <ComboboxBusca
                options={obraOptions}
                value={form.obra_id}
                onSelect={(v) => set('obra_id', v)}
                placeholder="Selecione a obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra encontrada."
              />
            </div>
          )}

          {/* Finalidade */}
          <div>
            <Label className="mb-1 block">Finalidade *</Label>
            <Input
              className="h-11"
              value={form.finalidade}
              onChange={(e) => set('finalidade', e.target.value)}
              placeholder="Ex: Transporte de materiais para obra"
            />
          </div>

          {/* Origem / Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Origem</Label>
              <Input className="h-11" value={form.origem} onChange={(e) => set('origem', e.target.value)} placeholder="Endereço de origem" />
            </div>
            <div>
              <Label className="mb-1 block">Destino</Label>
              <Input className="h-11" value={form.destino} onChange={(e) => set('destino', e.target.value)} placeholder="Endereço de destino" />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Data Saída *</Label>
              <Input className="h-11" type="datetime-local" value={form.data_saida_prevista} onChange={(e) => set('data_saida_prevista', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Data Retorno</Label>
              <Input className="h-11" type="datetime-local" value={form.data_retorno_prevista} onChange={(e) => set('data_retorno_prevista', e.target.value)} />
            </div>
          </div>

          {/* Urgência / Tipo Veículo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Urgência</Label>
              <ComboboxBusca
                options={URGENCIA_OPCOES}
                value={form.urgencia}
                onSelect={(v) => set('urgencia', v)}
                placeholder="Selecione a urgência"
                searchPlaceholder="Buscar..."
              />
            </div>
            <div>
              <Label className="mb-1 block">Tipo de Veículo</Label>
              <ComboboxBusca
                options={TIPO_VEICULO_OPCOES}
                value={form.tipo_veiculo_necessario}
                onSelect={(v) => set('tipo_veiculo_necessario', v)}
                placeholder="Selecione o tipo de veículo"
                searchPlaceholder="Buscar..."
              />
            </div>
          </div>

          {/* Passageiros / Descrição Carga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Passageiros</Label>
              <Input className="h-11" type="number" min="1" value={form.passageiros_qtd} onChange={(e) => set('passageiros_qtd', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Descrição da Carga</Label>
              <Input className="h-11" value={form.carga_descricao} onChange={(e) => set('carga_descricao', e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          {/* Quantidade Estimada (obrigatório) */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-3">Quantidade Estimada (obrigatório)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Quantidade *</Label>
                <Input className="h-11" type="number" min="0" step="0.01" value={form.quantidade_estimada} onChange={(e) => set('quantidade_estimada', e.target.value)} placeholder="Ex: 500" />
              </div>
              <div>
                <Label className="mb-1 block">Unidade *</Label>
                <ComboboxBusca
                  options={UNIDADE_OPCOES}
                  value={form.unidade_medida}
                  onSelect={(v) => set('unidade_medida', v)}
                  placeholder="Selecione a unidade"
                  searchPlaceholder="Buscar unidade..."
                />
              </div>
            </div>
            <p className="text-xs text-amber-700 mt-2">Informação necessária para dimensionar corretamente o veículo.</p>
          </div>

          {/* Rodapé — no fluxo normal, sem sobreposição */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || (form.tipo_vinculo === 'obra' && !form.obra_id)}
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            >
              {loading ? 'Criando...' : 'Criar Solicitação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
