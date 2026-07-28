import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, AlertCircle, Plus, TrendingDown, Package } from 'lucide-react';

export default function DashboardEstoqueObra({ obra_id }) {
  const [abaSelecionada, setAbaSelecionada] = useState('estoque');
  const [insumoSelecionado, setInsumoSelecionado] = useState(null);
  const [tipo, setTipo] = useState('entrada_compra');
  const [quantidade, setQuantidade] = useState('');
  const [custo, setCusto] = useState('');
  const queryClient = useQueryClient();

  // Buscar estoque da obra
  const { data: estoques } = useQuery({
    queryKey: ['estoque-obra', obra_id],
    queryFn: () => base44.entities.EstoqueObra.filter({ obra_id })
  });

  // Buscar movimentações
  const { data: movimentacoes } = useQuery({
    queryKey: ['movimentacoes-estoque', obra_id],
    queryFn: () => base44.entities.MovimentacaoEstoqueObra.filter({ obra_id })
  });

  // Mutation movimentação
  const { mutate: registrarMovimentacao, isLoading } = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processarMovimentacaoEstoqueObra', {
        obra_id,
        insumo_id: insumoSelecionado.insumo_id,
        tipo_movimentacao: tipo,
        quantidade: parseFloat(quantidade),
        custo_unitario: parseFloat(custo) || 0
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-obra'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
      setQuantidade('');
      setCusto('');
      setInsumoSelecionado(null);
    }
  });

  // Calcular totais
  const totalValor = estoques?.reduce((sum, e) => sum + (e.valor_total_estoque || 0), 0) || 0;
  const alertas = estoques?.filter(e => e.status_alerta !== 'ok') || [];

  return (
    <div className="space-y-6">
      {/* KPI - ALERTAS */}
      {alertas.length > 0 && (
        <Card className={`border-2 ${alertas.some(a => a.status_alerta === 'critico') ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              {alertas.some(a => a.status_alerta === 'critico') ? (
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Alertas de Estoque</h3>
                <div className="space-y-1">
                  {alertas.map(a => (
                    <p key={a.id} className={`text-sm ${a.status_alerta === 'critico' ? 'text-red-700' : 'text-amber-700'}`}>
                      <strong>{a.insumo_descricao}:</strong> {a.quantidade_total} {a.unidade}
                      {a.status_alerta === 'critico' && ' (CRÍTICO)'}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={abaSelecionada} onValueChange={setAbaSelecionada} className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
          <TabsTrigger value="estoque">Estoque Atual</TabsTrigger>
          <TabsTrigger value="movimentacao">Movimentar</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ABA 1: ESTOQUE */}
        <TabsContent value="estoque" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-600">Itens em Estoque</p>
                <p className="text-3xl font-bold text-gray-900">{estoques?.length || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-600">Valor Total</p>
                <p className="text-3xl font-bold text-blue-600">R$ {totalValor.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-600">Alertas Críticos</p>
                <p className={`text-3xl font-bold ${alertas.some(a => a.status_alerta === 'critico') ? 'text-red-600' : 'text-green-600'}`}>
                  {alertas.filter(a => a.status_alerta === 'critico').length}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Itens em Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {estoques?.map(e => (
                  <div key={e.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{e.insumo_descricao}</h4>
                          {e.status_alerta === 'critico' && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">CRÍTICO</span>
                          )}
                          {e.status_alerta === 'alerta' && (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded">ALERTA</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Total: {e.quantidade_total} | Disponível: {e.quantidade_disponivel} | Mínimo: {e.quantidade_minima} {e.unidade}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">R$ {e.valor_total_estoque?.toFixed(2)}</p>
                        <p className="text-xs text-gray-600">
                          {e.custo_unitario?.toFixed(2)}/{e.unidade}
                        </p>
                      </div>
                    </div>
                    {e.quantidade_total > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${
                            e.status_alerta === 'critico' ? 'bg-red-500' : 
                            e.status_alerta === 'alerta' ? 'bg-amber-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min((e.quantidade_total / (e.quantidade_minima || 1)), 1) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: MOVIMENTAÇÃO */}
        <TabsContent value="movimentacao" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Registrar Movimentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seleção de tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimentação</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="entrada_compra">Entrada - Compra</option>
                  <option value="entrada_transferencia">Entrada - Transferência</option>
                  <option value="saida_consumo">Saída - Consumo</option>
                  <option value="saida_devolucao">Saída - Devolução</option>
                </select>
              </div>

              {/* Seleção de insumo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Insumo</label>
                <select
                  value={insumoSelecionado?.id || ''}
                  onChange={(e) => {
                    const insumo = estoques?.find(est => est.id === e.target.value);
                    setInsumoSelecionado(insumo);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Selecione um insumo</option>
                  {estoques?.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.insumo_descricao} (Estoque: {e.quantidade_total} {e.unidade})
                    </option>
                  ))}
                </select>
              </div>

              {insumoSelecionado && (
                <>
                  {/* Quantidade */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade ({insumoSelecionado.unidade})
                    </label>
                    <input
                      type="number"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>

                  {/* Custo (opcional) */}
                  {(tipo === 'entrada_compra' || tipo === 'entrada_transferencia') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custo Unitário (R$)
                      </label>
                      <input
                        type="number"
                        value={custo}
                        onChange={(e) => setCusto(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder={insumoSelecionado.custo_unitario?.toFixed(2)}
                      />
                    </div>
                  )}

                  {/* Preview */}
                  {quantidade && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-900">
                        <strong>Movimentação:</strong> {quantidade} × {insumoSelecionado.unidade}
                        {custo && ` = R$ ${(parseFloat(quantidade) * parseFloat(custo)).toFixed(2)}`}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => registrarMovimentacao()}
                    disabled={!quantidade || isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Processando...' : 'Registrar Movimentação'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: HISTÓRICO */}
        <TabsContent value="historico" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {movimentacoes?.reverse().map(m => (
                  <div key={m.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{m.insumo_descricao}</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {m.tipo_movimentacao.replace('_', ' ')} • {new Date(m.data_movimentacao).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">Por: {m.responsavel}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${m.tipo_movimentacao.includes('entrada') ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo_movimentacao.includes('entrada') ? '+' : '-'} {m.quantidade} {m.unidade}
                        </p>
                        <p className="text-xs text-gray-600">R$ {m.valor_total?.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}