import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';
import BadgeStatusNF from '@/components/documentos-fiscais/BadgeStatusNF';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIAS = [
  { value: 'outro', label: 'Outro' },
  { value: 'material', label: 'Material' },
  { value: 'mao_obra', label: 'Mão de Obra' },
  { value: 'servico', label: 'Serviço' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'combustivel', label: 'Combustível' },
];

/**
 * Modal para criar/editar Conta a Pagar com integração de NF
 */
export default function ContaPagarModal({
  open,
  conta,
  onClose,
  onSuccess,
  podeEditar = true,
}) {
  const [formData, setFormData] = useState({
    descricao: '',
    fornecedor_cliente: '',
    valor: '',
    data_vencimento: '',
    categoria: 'outro',
    obra_id: '',
    status: 'pendente',
  });

  const [errors, setErrors] = useState({});
  const setCampo = (k, v) => {
    setFormData(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const [nfSelecionada, setNfSelecionada] = useState(null);
  const [mostrarSugestaoValor, setMostrarSugestaoValor] = useState(false);
  const [valorTemporario, setValorTemporario] = useState('');
  const queryClient = useQueryClient();

  // Carregar dados da conta se estiver editando
  useEffect(() => {
    if (conta) {
      setFormData({
        descricao: conta.descricao || '',
        fornecedor_cliente: conta.fornecedor_cliente || '',
        valor: conta.valor?.toString() || '',
        data_vencimento: conta.data_vencimento || '',
        categoria: conta.categoria || 'outro',
        obra_id: conta.obra_id || '',
        status: conta.status || 'pendente',
      });
      setNfSelecionada(null);
      setMostrarSugestaoValor(false);
    } else {
      setFormData({
        descricao: '',
        fornecedor_cliente: '',
        valor: '',
        data_vencimento: '',
        categoria: 'outro',
        obra_id: '',
        status: 'pendente',
      });
      setNfSelecionada(null);
      setMostrarSugestaoValor(false);
    }
    setErrors({});
  }, [conta, open]);

  // Buscar NFs vinculadas (se editando)
  const { data: nfsVinculadas = [] } = useQuery({
    queryKey: ['nfsContaPagar', conta?.id],
    queryFn: async () => {
      if (!conta?.id) return [];
      try {
        const result = await base44.functions.invoke('notaFiscalListar', {
          referencia_tipo: 'CONTAS_PAGAR',
          referencia_id: conta.id,
        });
        return result.data.nfs || [];
      } catch (error) {
        console.error('Erro ao buscar NFs:', error);
        return [];
      }
    },
    enabled: !!conta?.id,
  });

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });

  // Salvar conta
  const saveMutation = useMutation({
    mutationFn: async (dados) => {
      if (conta?.id) {
        return base44.entities.ContaFinanceira.update(conta.id, dados);
      } else {
        return base44.entities.ContaFinanceira.create({
          ...dados,
          tipo: 'pagar',
          criado_por: (await base44.auth.me()).email,
        });
      }
    },
    onSuccess: (savedConta) => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success(conta ? 'Conta atualizada' : 'Conta criada com sucesso');
      onSuccess?.(savedConta);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao salvar conta');
    },
  });

  // Callback quando NF é confirmada
  const handleNFConfirmada = async (nfData) => {
    setNfSelecionada(nfData);

    // Se tem valor_final_ajustado confirmado, mostrar sugestão
    if (nfData.status === 'CONFIRMADO' && nfData.valor_final_ajustado) {
      setValorTemporario(nfData.valor_final_ajustado.toString());
      setMostrarSugestaoValor(true);
    }
  };

  const aceitarValorNF = () => {
    setFormData(prev => ({
      ...prev,
      valor: valorTemporario,
    }));
    setMostrarSugestaoValor(false);
    toast.success('Valor preenchido com valor final da NF');
  };

  const recusarValorNF = () => {
    setMostrarSugestaoValor(false);
  };

  const validar = () => {
    const e = {};
    if (!formData.descricao.trim()) e.descricao = 'Descrição é obrigatória';
    if (!(parseFloat(formData.valor) > 0)) e.valor = 'Informe um valor maior que zero';
    if (!formData.data_vencimento) e.data_vencimento = 'Informe o vencimento';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    saveMutation.mutate({
      ...formData,
      valor: parseFloat(formData.valor),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {conta ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Sem permissão: diz o porquê, em vez de só deixar tudo cinza. */}
          {!podeEditar && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Somente leitura: seu perfil não tem permissão para criar ou editar contas a pagar.</span>
            </div>
          )}

          {/* Descrição */}
          <div>
            <Label>Descrição *</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setCampo('descricao', e.target.value)}
              placeholder="Ex: Compra de materiais"
              disabled={!podeEditar}
              className={`mt-1 ${errors.descricao ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
          </div>

          {/* Fornecedor/Cliente */}
          <div>
            <Label>Fornecedor/Cliente</Label>
            <Input
              value={formData.fornecedor_cliente}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  fornecedor_cliente: e.target.value,
                }))
              }
              placeholder="Nome do fornecedor"
              disabled={!podeEditar}
              className="mt-1"
            />
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor *</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm text-gray-500">R$</span>
                <Input
                  type="number"
                  value={formData.valor}
                  onChange={(e) => setCampo('valor', e.target.value)}
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  className={`pl-9 ${errors.valor ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  disabled={!podeEditar}
                />
              </div>
              {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
            </div>

            <div>
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setCampo('data_vencimento', e.target.value)}
                disabled={!podeEditar}
                className={`mt-1 ${errors.data_vencimento ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {errors.data_vencimento && <p className="text-xs text-red-500 mt-1">{errors.data_vencimento}</p>}
            </div>
          </div>

          {/* Categoria e Obra */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={CATEGORIAS}
                  value={formData.categoria}
                  onSelect={(v) => setFormData(prev => ({ ...prev, categoria: v }))}
                  placeholder="Selecionar categoria..."
                  searchPlaceholder="Buscar categoria..."
                  disabled={!podeEditar}
                />
              </div>
            </div>

            <div>
              <Label>Obra</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                  value={formData.obra_id}
                  onSelect={(v) => setFormData(prev => ({ ...prev, obra_id: v }))}
                  placeholder="Selecionar obra..."
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra encontrada"
                  disabled={!podeEditar}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <hr className="my-4" />

          {/* Seção de NF */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Documento Fiscal</h3>

            {/* NFs Vinculadas */}
            {nfsVinculadas.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                {nfsVinculadas.map(nf => (
                  <div key={nf.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">NF #{nf.numero}</p>
                      <p className="text-xs text-gray-500">
                        {nf.emissor_nome}
                      </p>
                    </div>
                    <BadgeStatusNF
                      status={nf.status}
                      valor_final_ajustado={nf.valor_final_ajustado}
                      showValor={nf.status === 'CONFIRMADO'}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Botão Anexar NF */}
            {podeEditar && (
              <BotaoAnexarNFGasto
                referencia_tipo="CONTAS_PAGAR"
                referencia_id={conta?.id || 'nova'}
                referencia_nome={formData.descricao}
                obra_id={formData.obra_id}
                podeEditar={podeEditar}
                onSuccess={() => {
                  queryClient.invalidateQueries(['nfsContaPagar', conta?.id]);
                }}
              />
            )}
          </div>

          {/* Sugestão de Valor */}
          {mostrarSugestaoValor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Sugestão de Valor
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    A NF tem um valor final confirmado de{' '}
                    <strong>{fmtBRL(valorTemporario)}</strong>.
                    Deseja usar este valor?
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={aceitarValorNF}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={recusarValorNF}
                    >
                      Manter Manual
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={saveMutation.isPending || !podeEditar}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}