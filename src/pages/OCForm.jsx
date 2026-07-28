import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function OCForm() {
  const navigate = useNavigate();
  const [fornecedor_id, setFornecedor_id] = useState('');
  const [empresa_id, setEmpresa_id] = useState('');
  const [obra_id, setObraId] = useState('');
  const [data_prevista_entrega, setDataPrevistaEntrega] = useState('');
  const [condicoes_pagamento, setCondicoesPagamento] = useState('');
  const [itens, setItens] = useState([]);
  const [insumo_search, setInsumoSearch] = useState('');
  const [insumosFiltrados, setInsumosFiltrados] = useState([]);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list('', 100)
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list('', 100)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('', 100)
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list('', 100)
  });

  const { mutate: criarOC, isPending } = useMutation({
    mutationFn: async () => {
      if (!fornecedor_id || itens.length === 0) {
        throw new Error('Fornecedor e itens são obrigatórios');
      }

      const numero = `OC-${Date.now()}`;
      const resultado = await base44.functions.invoke('criarOrdemCompra', {
        numero,
        fornecedor_id,
        empresa_id: empresa_id || empresas[0]?.id,
        itens,
        data_emissao: new Date().toISOString().split('T')[0],
        data_prevista_entrega,
        condicoes_pagamento,
        destino: 'estoque_central'
      });

      return resultado;
    },
    onSuccess: (data) => {
      toast.success(`Ordem de Compra ${data.numero} criada com sucesso!`);
      navigate(createPageUrl('OrdensCompra'));
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao criar OC');
    }
  });

  const handleAddItem = (insumo) => {
    const existe = itens.find(i => i.insumo_id === insumo.id);
    if (!existe) {
      setItens([
        ...itens,
        {
          insumo_id: insumo.id,
          descricao: insumo.descricao,
          unidade: insumo.unidade,
          quantidade_solicitada: 1,
          valor_unitario: insumo.preco_unitario || 0,
          impostos_percentual: 0
        }
      ]);
      setInsumoSearch('');
      setInsumosFiltrados([]);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const novo_itens = [...itens];
    novo_itens[index][field] = value;
    setItens(novo_itens);
  };

  const handleRemoveItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleSearchInsumo = (search) => {
    setInsumoSearch(search);
    if (search.length > 0) {
      setInsumosFiltrados(
        insumos.filter(i =>
          i.descricao.toLowerCase().includes(search.toLowerCase()) &&
          !itens.find(it => it.insumo_id === i.id)
        )
      );
    } else {
      setInsumosFiltrados([]);
    }
  };

  const valor_total = itens.reduce((sum, item) => {
    const subtotal = (item.quantidade_solicitada || 0) * (item.valor_unitario || 0);
    const imposto = subtotal * ((item.impostos_percentual || 0) / 100);
    return sum + subtotal + imposto;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nova Ordem de Compra</h1>
            <p className="text-gray-600">Crie uma requisição de materiais</p>
          </div>
        </div>

        {/* Formulário */}
        <div className="space-y-6">
          {/* Fornecedor e Empresa */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Fornecedor *</label>
                  <select
                    value={fornecedor_id}
                    onChange={(e) => setFornecedor_id(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Empresa</label>
                  <select
                    value={empresa_id}
                    onChange={(e) => setEmpresa_id(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Padrão</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Obra (Opcional)</label>
                  <select
                    value={obra_id}
                    onChange={(e) => setObraId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Nenhuma</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Condições de Pagamento</label>
                  <Input
                    value={condicoes_pagamento}
                    onChange={(e) => setCondicoesPagamento(e.target.value)}
                    placeholder="Ex: À vista, 30 dias"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Data Prevista de Entrega</label>
                <Input
                  type="date"
                  value={data_prevista_entrega}
                  onChange={(e) => setDataPrevistaEntrega(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Insumos */}
          <Card>
            <CardHeader>
              <CardTitle>Itens da Ordem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Busca de Insumo */}
              <div className="relative">
                <Input
                  placeholder="Buscar insumo..."
                  value={insumo_search}
                  onChange={(e) => handleSearchInsumo(e.target.value)}
                  className="w-full"
                />
                {insumosFiltrados.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg mt-1 shadow-lg z-10">
                    {insumosFiltrados.map(insumo => (
                      <button
                        key={insumo.id}
                        onClick={() => handleAddItem(insumo)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b text-sm"
                      >
                        <p className="font-semibold">{insumo.descricao}</p>
                        <p className="text-xs text-gray-600">R$ {insumo.preco_unitario?.toFixed(2)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Itens Selecionados */}
              {itens.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">Nenhum insumo selecionado</p>
              ) : (
                <div className="space-y-3">
                  {itens.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">{item.descricao}</p>
                          <p className="text-xs text-gray-600">{item.unidade}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-gray-600">Quantidade</label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantidade_solicitada}
                            onChange={(e) => handleUpdateItem(index, 'quantidade_solicitada', parseFloat(e.target.value))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Valor Unit.</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.valor_unitario}
                            onChange={(e) => handleUpdateItem(index, 'valor_unitario', parseFloat(e.target.value))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Impostos %</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.impostos_percentual}
                            onChange={(e) => handleUpdateItem(index, 'impostos_percentual', parseFloat(e.target.value))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Total</label>
                          <p className="font-semibold text-sm">
                            R$ {(
                              (item.quantidade_solicitada || 0) * (item.valor_unitario || 0) +
                              (item.quantidade_solicitada || 0) * (item.valor_unitario || 0) * ((item.impostos_percentual || 0) / 100)
                            ).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-4 text-right">
                <p className="text-sm text-gray-600">Valor Total da OC:</p>
                <p className="text-2xl font-bold text-gray-900">R$ {valor_total.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => navigate(createPageUrl('OrdensCompra'))}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => criarOC()}
              disabled={isPending || itens.length === 0 || !fornecedor_id}
            >
              {isPending ? 'Criando...' : 'Criar Ordem de Compra'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}