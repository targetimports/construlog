import React, { useState } from 'react';
import { FileText, Plus, Loader2, CheckCircle, ArrowRight, Package, Paperclip, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function OrcamentoMedicaoGuidado() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const obraId = urlParams.get('obra_id');
  const [activeTab, setActiveTab] = useState('orcamento');
  const [orcamentos, setOrcamentos] = useState([]);
  const [newItem, setNewItem] = useState({ descricao: '', unidade: 'un', quantidade: 1, valor_unitario: 0 });
  const [usarSinapi, setUsarSinapi] = useState(false);
  const [materiais, setMateriais] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = React.useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedData, setImportedData] = useState(null);

  const { data: obra } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId }),
    enabled: !!obraId
  });

  const { data: orcamentosDB = [] } = useQuery({
    queryKey: ['orcamentos', obraId],
    queryFn: () => base44.entities.OrcamentoObra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes', obraId],
    queryFn: () => base44.entities.MedicaoObra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const criarOrcamentoMutation = useMutation({
    mutationFn: async (data) => {
      const orcamento = await base44.entities.OrcamentoObra.create({
        obra_id: obraId,
        numero: `ORC-${Date.now()}`,
        descricao: 'Orçamento da Obra',
        status: 'rascunho'
      });

      if (data.itens && data.itens.length > 0) {
        for (const item of data.itens) {
          await base44.entities.ItemOrcamentoObra.create({
            orcamento_id: orcamento.id,
            obra_id: obraId,
            centro_custo_id: '',
            descricao: item.descricao,
            unidade: item.unidade,
            quantidade_orcada: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.quantidade * item.valor_unitario
          });
        }
      }

      return orcamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos', obraId] });
    }
  });

  const criarMedicaoMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.MedicaoObra.create({
        obra_id: obraId,
        numero: `MED-${Date.now()}`,
        periodo_inicio: data.periodo_inicio,
        periodo_fim: data.periodo_fim,
        status: 'rascunho'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes', obraId] });
    }
  });

  const handleAddItem = async () => {
    if (!newItem.descricao.trim()) {
      alert('Informe a descrição do item');
      return;
    }

    const novoOrcamento = {
      ...orcamentos[0],
      itens: [...(orcamentos[0]?.itens || []), newItem]
    };

    setOrcamentos([novoOrcamento]);
    setNewItem({ descricao: '', unidade: 'un', quantidade: 1, valor_unitario: 0 });
  };

  const handleCriarOrcamento = async () => {
    if (orcamentos.length === 0 || !orcamentos[0]?.itens?.length) {
      alert('Adicione pelo menos um item ao orçamento');
      return;
    }

    await criarOrcamentoMutation.mutateAsync({ itens: orcamentos[0].itens });
  };

  const handleContinuar = () => {
    navigate(createPageUrl('Dashboard') + `?obra_id=${obraId}`);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    
    try {
      // Upload dos arquivos
      const uploadedUrls = [];
      for (let file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
        setUploadedFiles(prev => [...prev, file.name]);
      }

      // Usar IA para analisar as planilhas
      const prompt = `Analise as planilhas de orçamento anexadas e extraia os seguintes dados em formato JSON:

{
  "obra_nome": "nome da obra",
  "valor_total": valor total numérico,
  "itens": [
    {
      "codigo": "código do item",
      "descricao": "descrição completa",
      "unidade": "unidade (m2, m3, un, kg, etc)",
      "quantidade": número,
      "valor_unitario": número,
      "valor_total": número
    }
  ],
  "materiais": [
    {
      "nome": "nome do material/insumo",
      "unidade": "unidade",
      "quantidade": número,
      "preco_unitario": número
    }
  ]
}

IMPORTANTE:
- Extraia TODOS os itens do orçamento sintético
- Identifique materiais e insumos nas composições
- Converta valores para números (sem R$, sem pontos de milhares)
- Mantenha descrições completas`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: uploadedUrls,
        response_json_schema: {
          type: "object",
          properties: {
            obra_nome: { type: "string" },
            valor_total: { type: "number" },
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo: { type: "string" },
                  descricao: { type: "string" },
                  unidade: { type: "string" },
                  quantidade: { type: "number" },
                  valor_unitario: { type: "number" },
                  valor_total: { type: "number" }
                }
              }
            },
            materiais: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  unidade: { type: "string" },
                  quantidade: { type: "number" },
                  preco_unitario: { type: "number" }
                }
              }
            }
          }
        }
      });

      setImportedData(result);
      setMateriais(result.materiais || []);
      
      // Adicionar itens ao orçamento
      if (result.itens && result.itens.length > 0) {
        setOrcamentos([{ itens: result.itens }]);
      }

      alert(`Importação concluída!\n\n${result.itens?.length || 0} itens importados\n${result.materiais?.length || 0} materiais identificados`);
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert('Erro ao processar planilhas. Verifique o formato e tente novamente.');
    } finally {
      setIsImporting(false);
    }
  };

  const hasOrcamento = orcamentosDB.length > 0;
  const hasMedicao = medicoes.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Orçamento & Medições</h1>
              <p className="text-gray-600">Configure o orçamento e registre medições da obra</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('orcamento')}
            className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'orcamento'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Orçamento
          </button>
          <button
            onClick={() => setActiveTab('sinapi')}
            className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'sinapi'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Configurar
          </button>
          <button
            onClick={() => setActiveTab('materiais')}
            className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'materiais'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Materiais
          </button>
          <button
            onClick={() => setActiveTab('arquivos')}
            className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'arquivos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Arquivos
          </button>
          <button
            onClick={() => setActiveTab('medicao')}
            className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'medicao'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Medições
          </button>
        </div>

        {/* TAB: Orçamento */}
        {activeTab === 'orcamento' && (
          <div className="space-y-6">
            {/* Botão Importar Planilha */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Paperclip className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Importação Inteligente com IA</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Envie suas planilhas de orçamento (Excel, PDF) e a IA extrai automaticamente todos os itens, materiais, valores e quantidades.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando IA...
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-4 h-4" />
                          Importar Planilha
                        </>
                      )}
                    </Button>
                    {importedData && (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                        <CheckCircle className="w-4 h-4" />
                        {importedData.itens?.length || 0} itens importados
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!hasOrcamento ? (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Criar Orçamento</h2>

                  {/* Adicionar itens */}
                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descrição do Item *
                        </label>
                        <input
                          type="text"
                          value={newItem.descricao}
                          onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ex: Alvenaria m²"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                        <select
                          value={newItem.unidade}
                          onChange={(e) => setNewItem({ ...newItem, unidade: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="un">Unidade</option>
                          <option value="m2">m²</option>
                          <option value="m3">m³</option>
                          <option value="kg">kg</option>
                          <option value="h">Hora</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                        <input
                          type="number"
                          value={newItem.quantidade}
                          onChange={(e) => setNewItem({ ...newItem, quantidade: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor Unitário</label>
                        <input
                          type="number"
                          value={newItem.valor_unitario}
                          onChange={(e) => setNewItem({ ...newItem, valor_unitario: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleAddItem}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Item
                    </Button>
                  </div>

                  {/* Itens adicionados */}
                  {orcamentos.length > 0 && orcamentos[0]?.itens?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-900 mb-3">Itens do Orçamento</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {orcamentos[0].itens.map((item, idx) => (
                          <div key={idx} className="flex justify-between p-3 bg-blue-50 rounded-lg text-sm">
                            <div>
                              <p className="font-medium text-gray-900">{item.descricao}</p>
                              <p className="text-gray-600">{item.quantidade} {item.unidade}</p>
                            </div>
                            <p className="font-medium text-gray-900">
                              R$ {(item.quantidade * item.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600">Total do Orçamento</p>
                        <p className="text-2xl font-bold text-gray-900">
                          R$ {orcamentos[0].itens.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleCriarOrcamento}
                    disabled={criarOrcamentoMutation.isPending || orcamentos.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 gap-2"
                  >
                    {criarOrcamentoMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Criar Orçamento
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Orçamento já criado!</h3>
                    <p className="text-sm text-gray-600">{orcamentosDB.length} orçamento(s) cadastrado(s)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Medições */}
        {activeTab === 'medicao' && (
          <div className="space-y-6">
            {!hasMedicao ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Registrar Primeira Medição</h2>
                <p className="text-gray-600 mb-6">
                  {hasOrcamento
                    ? 'Agora você pode registrar o progresso da obra!'
                    : 'Crie um orçamento primeiro para registrar medições'}
                </p>

                {hasOrcamento && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Período Início *
                        </label>
                        <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Período Fim *
                        </label>
                        <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                    </div>
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Registrar Medição
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Medições já registradas!</h3>
                    <p className="text-sm text-gray-600">{medicoes.length} medição(ões) cadastrada(s)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Configurar SINAPI */}
        {activeTab === 'sinapi' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Usar Tabela SINAPI?</h2>
            <p className="text-gray-600 mb-6">
              A tabela SINAPI contém custos unitários de insumos e serviços. Ative para usar preços da base SINAPI.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usarSinapi}
                  onChange={(e) => setUsarSinapi(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <p className="font-medium text-gray-900">Usar preços SINAPI</p>
                  <p className="text-sm text-gray-600">Preços referenciais do governo federal</p>
                </div>
              </label>
            </div>

            {usarSinapi && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
                SINAPI ativado! Use os preços da tabela ao criar itens do orçamento.
              </div>
            )}
          </div>
        )}

        {/* TAB: Materiais */}
        {activeTab === 'materiais' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Materiais da Obra</h2>
            
            {importedData && materiais.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-900">
                    {materiais.length} materiais importados automaticamente pela IA
                  </p>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {materiais.map((mat, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">{mat.nome}</p>
                        <p className="text-sm text-gray-600">{mat.quantidade} {mat.unidade}</p>
                      </div>
                      <p className="font-semibold text-gray-900">
                        R$ {mat.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-6">Cadastre os materiais que serão usados nesta obra.</p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Material</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Ex: Cimento"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option>kg</option>
                        <option>un</option>
                        <option>m²</option>
                        <option>m³</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unit.</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Material
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: Arquivos */}
        {activeTab === 'arquivos' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Arquivos da Obra</h2>
            <p className="text-gray-600 mb-6">Envie fotos, plantas, planilhas e documentos da obra.</p>
            
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <Paperclip className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Clique ou arraste arquivos</p>
              <p className="text-sm text-gray-600">Fotos, plantas, planilhas (PDF, Excel, JPG, PNG)</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileUpload}
            />

            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="font-medium text-gray-900">Arquivos enviados:</h3>
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Paperclip className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Botão continuar */}
        {hasOrcamento && hasMedicao && (
          <div className="mt-8">
            <Button
              onClick={handleContinuar}
              className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-base gap-2"
            >
              Ir para Dashboard da Obra <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}