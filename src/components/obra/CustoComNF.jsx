import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Save } from 'lucide-react';
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';

/**
 * Componente genérico para criar custos/despesas com NF
 * Após criar o custo, permite anexar NF e sugerir valor_final_ajustado
 */
export default function CustoComNF({
  obraId,
  tipoEntidade, // ex: 'Alimentacao', 'MaoDeObra', etc
  camposAdicionais, // objeto com campos customizados
  onSuccess,
  tituloPrincipal = 'Novo Custo',
  descricaoForm = 'Preencha os dados do custo/despesa'
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [custoId, setCustoId] = useState(null);
  const [custoDados, setCustoDados] = useState({});
  const [expandedNF, setExpandedNF] = useState(false);

  const criarMutation = useMutation({
    mutationFn: async (dados) => {
      const entidade = base44.entities[tipoEntidade];
      if (!entidade) throw new Error(`Entidade ${tipoEntidade} não encontrada`);
      
      const resultado = await entidade.create({
        obra_id: obraId,
        ...dados
      });
      return resultado;
    },
    onSuccess: (data) => {
      setCustoId(data.id);
      setCustoDados(data);
      toast.success('Custo criado com sucesso');
    },
    onError: (err) => {
      toast.error('Erro: ' + err.message);
    }
  });

  const atualizarValorMutation = useMutation({
    mutationFn: async (novoValor) => {
      const entidade = base44.entities[tipoEntidade];
      return await entidade.update(custoId, { valor: novoValor });
    },
    onSuccess: () => {
      toast.success('Valor atualizado');
      qc.invalidateQueries({ queryKey: [tipoEntidade.toLowerCase()] });
    },
    onError: (err) => {
      toast.error('Erro: ' + err.message);
    }
  });

  const handleCriar = () => {
    if (!custoDados.valor) {
      toast.error('Preenchimento obrigatório: valor');
      return;
    }
    criarMutation.mutate(custoDados);
  };

  const handleClose = () => {
    setShowForm(false);
    setCustoId(null);
    setCustoDados({});
    setExpandedNF(false);
  };

  const handleSuccess = () => {
    qc.invalidateQueries({ queryKey: [tipoEntidade.toLowerCase()] });
    onSuccess?.();
    handleClose();
  };

  if (!showForm && !custoId) {
    return (
      <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
        + Novo Custo
      </Button>
    );
  }

  return (
    <Dialog open={showForm || !!custoId} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{custoId ? 'Vincular NF' : tituloPrincipal}</DialogTitle>
        </DialogHeader>

        {!custoId ? (
          // Formulário de criação
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{descricaoForm}</p>

            {/* Campos padrão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <Input
                type="date"
                value={custoDados.data || new Date().toISOString().split('T')[0]}
                onChange={(e) => setCustoDados({ ...custoDados, data: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <Textarea
                placeholder="Descrever o gasto..."
                value={custoDados.descricao || ''}
                onChange={(e) => setCustoDados({ ...custoDados, descricao: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor/Local</label>
              <Input
                placeholder="Nome ou ID"
                value={custoDados.fornecedor_id || ''}
                onChange={(e) => setCustoDados({ ...custoDados, fornecedor_id: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoDados.valor || ''}
                  onChange={(e) => setCustoDados({ ...custoDados, valor: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                <Select value={custoDados.forma_pagamento || 'pix'} onValueChange={(v) => setCustoDados({ ...custoDados, forma_pagamento: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="ted">TED</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos customizados */}
            {camposAdicionais && Object.entries(camposAdicionais).map(([chave, config]) => (
              <div key={chave}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{config.label}</label>
                {config.type === 'select' ? (
                  <Select value={custoDados[chave] || ''} onValueChange={(v) => setCustoDados({ ...custoDados, [chave]: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={config.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {config.options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={config.type || 'text'}
                    placeholder={config.placeholder}
                    value={custoDados[chave] || ''}
                    onChange={(e) => setCustoDados({ ...custoDados, [chave]: e.target.value })}
                  />
                )}
              </div>
            ))}

            <div className="flex gap-2 justify-end border-t pt-4">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleCriar}
                disabled={criarMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {criarMutation.isPending ? 'Criando...' : 'Criar e Vincular NF'}
              </Button>
            </div>
          </div>
        ) : (
          // Etapa de NF
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                Custo criado: <span className="font-bold">R$ {custoDados.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
            </div>

            {/* Seção de NF */}
            <div>
              <div
                className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg cursor-pointer"
                onClick={() => setExpandedNF(!expandedNF)}
              >
                <span className="font-semibold text-gray-900">Documentação Fiscal</span>
                {expandedNF ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>

              {expandedNF && (
                <div className="mt-3 p-3 border rounded-lg bg-white space-y-3">
                  <BotaoAnexarNFGasto
                    referencia_tipo="GASTO_OBRA"
                    referencia_id={custoId}
                    referencia_nome={custoDados.descricao || `Gasto - ${new Date(custoDados.data).toLocaleDateString('pt-BR')}`}
                    obra_id={obraId}
                    podeEditar={true}
                    onSuccess={() => {
                      qc.invalidateQueries({ queryKey: [tipoEntidade.toLowerCase()] });
                      handleSuccess();
                    }}
                  />
                  
                  <div className="text-xs text-gray-600 italic border-t pt-3">
                    Ao confirmar a NF, você pode aceitar o valor_final_ajustado para atualizar automaticamente o valor do custo.
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end border-t pt-4">
              <Button onClick={handleSuccess} className="bg-green-600 hover:bg-green-700">
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}