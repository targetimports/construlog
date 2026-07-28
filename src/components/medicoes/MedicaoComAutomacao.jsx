import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2, Lock } from 'lucide-react';

export default function MedicaoComAutomacao({ obra_id }) {
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [validacao, setValidacao] = useState(null);
  const queryClient = useQueryClient();

  // Buscar itens do orçamento
  const { data: itensOrcamento } = useQuery({
    queryKey: ['itens-orcamento', obra_id],
    queryFn: () => base44.entities.OrcamentoItem.filter({ obra_id })
  });

  // Buscar medições já registradas
  const { data: medicoesBuscadas } = useQuery({
    queryKey: ['medicoes-registradas', itemSelecionado?.id],
    queryFn: () => base44.entities.Medicao.filter({ item_orcamento_id: itemSelecionado?.id }),
    enabled: !!itemSelecionado
  });

  // Validar medição antes de processar
  const { mutate: validarMedicao } = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('validarMedicaoIntegrada', {
        obra_id,
        item_orcamento_id: itemSelecionado.id,
        quantidade_medida: parseFloat(quantidadeInput)
      });
      return response.data;
    },
    onSuccess: (data) => {
      setValidacao(data);
      if (data.valido && data.avisos.length === 0) {
        processarMedicao();
      }
    }
  });

  // Mutation para processar medição
  const { mutate: processarMedicao, isLoading: processando } = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processarMedicaoComAutomacao', {
        obra_id,
        item_orcamento_id: itemSelecionado.id,
        quantidade_medida: parseFloat(quantidadeInput)
      });

      return response.data;
    },
    onSuccess: async (data) => {
      // Congelar composição após sucesso
      if (data.medicao_id) {
        await base44.functions.invoke('congelarComposicaoAposMedicao', {
          medicao_id: data.medicao_id
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['itens-orcamento'] });
      queryClient.invalidateQueries({ queryKey: ['medicoes-registradas'] });
      setQuantidadeInput('');
      setItemSelecionado(null);
      setValidacao(null);
    }
  });

  const totalMedido = medicoesBuscadas?.reduce((sum, m) => sum + (m.quantidade || 0), 0) || 0;
  const saldoDisponivel = itemSelecionado ? itemSelecionado.quantidade_prevista - totalMedido : 0;
  const podeProcessar = itemSelecionado && quantidadeInput && parseFloat(quantidadeInput) <= saldoDisponivel && parseFloat(quantidadeInput) > 0;

  return (
    <div className="space-y-6">
      {/* ALERTA - FLUXO AUTOMÁTICO */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">
            <strong>Automação Ativa:</strong> Ao confirmar a medição, o sistema consumirá automaticamente todos os insumos da composição, calculará hora-máquina e gerará custos reais.
          </div>
        </CardContent>
      </Card>

      {/* SELEÇÃO DE ITEM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Selecione o Item do Orçamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {itensOrcamento?.filter(item => item.composicao_id).map(item => (
              <button
                key={item.id}
                onClick={() => setItemSelecionado(item)}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  itemSelecionado?.id === item.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{item.descricao}</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Previsto: {item.quantidade_prevista} {item.unidade} | 
                      Executado: {item.quantidade_executada || 0} {item.unidade}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {Math.round(((item.quantidade_executada || 0) / item.quantidade_prevista) * 100)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DETALHES DO ITEM SELECIONADO */}
      {itemSelecionado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Informe a Quantidade a Medir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Validações */}
            {!itemSelecionado.composicao_id && (
              <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700"><strong>Erro:</strong> Item sem composição vinculada</p>
              </div>
            )}

            {/* Saldo */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600">Quantidade Prevista</p>
                <p className="text-xl font-bold text-gray-900">{itemSelecionado.quantidade_prevista}</p>
                <p className="text-xs text-gray-500">{itemSelecionado.unidade}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Medido até Agora</p>
                <p className="text-xl font-bold text-blue-600">{totalMedido}</p>
                <p className="text-xs text-gray-500">{itemSelecionado.unidade}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Saldo Disponível</p>
                <p className={`text-xl font-bold ${saldoDisponivel > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {saldoDisponivel}
                </p>
                <p className="text-xs text-gray-500">{itemSelecionado.unidade}</p>
              </div>
            </div>

            {/* Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade a Medir
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={quantidadeInput}
                  onChange={(e) => setQuantidadeInput(e.target.value)}
                  placeholder="0"
                  max={saldoDisponivel}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700 font-medium">
                  {itemSelecionado.unidade}
                </span>
              </div>
            </div>

            {/* Validação de entrada */}
            {quantidadeInput && (
              <div className="text-sm">
                {parseFloat(quantidadeInput) <= saldoDisponivel ? (
                  <div className="flex gap-2 text-green-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Quantidade válida</span>
                  </div>
                ) : (
                  <div className="flex gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Excede o saldo disponível</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RESUMO DO QUE SERÁ CONSUMIDO */}
      {itemSelecionado && quantidadeInput && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg">3. O Sistema Irá Processar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-amber-900">
              <p>✓ Consumir <strong>{quantidadeInput}</strong> unidades do item</p>
              <p>✓ Calcular insumos proporcionais da composição</p>
              <p>✓ Baixar hora-máquina automaticamente</p>
              <p>✓ Gerar custo real por insumo</p>
              <p>✓ Atualizar comparativo previsto x realizado</p>
              <p>✓ Atualizar margem da obra</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ALERTAS DE VALIDAÇÃO */}
      {validacao && !validacao.valido && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Erros de Validação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validacao.erros.map((erro, i) => (
                <p key={i} className="text-sm text-red-700">• {erro}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {validacao?.avisos && validacao.avisos.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Avisos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validacao.avisos.map((aviso, i) => (
                <p key={i} className="text-sm text-amber-700">• {aviso}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* STATUS COMPOSIÇÃO */}
      {itemSelecionado && validacao?.resumo?.composicao_id && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-sm text-blue-900 space-y-2">
              <div className="flex items-center gap-2">
                {validacao.resumo.tipos_insumo.material ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>Material</span>
              </div>
              <div className="flex items-center gap-2">
                {validacao.resumo.tipos_insumo.mao_obra ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>Mão de Obra</span>
              </div>
              <div className="flex items-center gap-2">
                {validacao.resumo.tipos_insumo.equipamento ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>Equipamento/Hora-Máquina</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BOTÃO CONFIRMAR */}
      {itemSelecionado && (
        <div className="flex gap-2">
          <Button
            onClick={() => validarMedicao()}
            disabled={!podeProcessar || processando}
            size="lg"
            className="flex-1"
            variant="outline"
          >
            {processando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              'Validar Medição'
            )}
          </Button>
          <Button
            onClick={() => processarMedicao()}
            disabled={!validacao?.valido || processando}
            size="lg"
            className="flex-1"
          >
            {processando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : validacao?.resumo?.composicao_id ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar e Processar
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}