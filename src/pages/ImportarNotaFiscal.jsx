import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import DialogMapeamentoNF from '../components/nf/DialogMapeamentoNF';

export default function ImportarNotaFiscal() {
  const [file, setFile] = useState(null);
  const [tipoArquivo, setTipoArquivo] = useState('xml');
  const [dadosExtraidos, setDadosExtraidos] = useState(null);
  const [mapeamentoDialogAberto, setMapeamentoDialogAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mapeamento, setMapeamento] = useState({});
  const [searchTermoMaterial, setSearchTermoMaterial] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState({});
  const queryClient = useQueryClient();

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados'],
    queryFn: () => base44.entities.Almoxarifado.list()
  });

  const processarNFMutation = useMutation({
    mutationFn: async () => {
      setProcessando(true);
      
      // Criar FormData para upload
      const formData = new FormData();
      formData.append('file', file);

      const uploadResult = await base44.integrations.Core.UploadFile({
        file: file
      });

      console.log('Upload resultado:', uploadResult);

      const resultado = await base44.functions.invoke('processarNotaFiscal', {
        file_url: uploadResult.file_url,
        tipo_arquivo: tipoArquivo
      });

      console.log('Processamento resultado:', resultado);

      if (!resultado.data) {
        throw new Error('Nenhum dado retornado da função');
      }

      return resultado.data;
    },
    onSuccess: (dados) => {
      console.log('Dados extraídos:', dados);
      
      if (!dados || !dados.itens || dados.itens.length === 0) {
        toast.error('Nenhum item foi extraído da nota fiscal');
        setProcessando(false);
        return;
      }

      setDadosExtraidos(dados);
      
      // Inicializar mapeamento com match automático
      const mapeaAuto = {};
      dados.itens.forEach((item, idx) => {
        const materialBuscado = materiais.find(m =>
          m.nome.toLowerCase().includes(item.descricao.toLowerCase()) ||
          item.descricao.toLowerCase().includes(m.nome.toLowerCase())
        );
        if (materialBuscado) {
          mapeaAuto[idx] = {
            material_id: materialBuscado.id,
            preco_compra: item.valor_unitario,
            quantidade: item.quantidade,
            unidade: item.unidade,
            automatico: true
          };
        }
      });
      
      setMapeamento(mapeaAuto);
      setMapeamentoDialogAberto(true);
      setProcessando(false);
      
      const qtdMapeados = Object.keys(mapeaAuto).length;
      toast.success(`Nota fiscal processada! ${qtdMapeados} itens mapeados automaticamente`);
    },
    onError: (error) => {
      setProcessando(false);
      toast.error('Erro ao processar nota fiscal: ' + error.message);
    }
  });

  const importarMutation = useMutation({
    mutationFn: async () => {
      // Criar/atualizar fornecedor
      let fornecedorId = null;
      const fornecedorExiste = fornecedores.find(f => f.cnpj === dadosExtraidos.cnpj_fornecedor);
      
      if (fornecedorExiste) {
        fornecedorId = fornecedorExiste.id;
      } else {
        const novoFornecedor = await base44.entities.Fornecedor.create({
          nome: dadosExtraidos.fornecedor_nome,
          cnpj: dadosExtraidos.cnpj_fornecedor,
          tipo: 'distribuidor'
        });
        fornecedorId = novoFornecedor.id;
      }

      // Criar recebimento
      const itensRecebimento = dadosExtraidos.itens
        .map((item, idx) => {
          const mapeado = mapeamento[idx];
          if (!mapeado) return null;
          return {
            material_id: mapeado.material_id,
            descricao: item.descricao,
            quantidade_recebida: mapeado.quantidade,
            unidade: mapeado.unidade || item.unidade,
            data_recebimento: dadosExtraidos.data_emissao,
            nota_fiscal: dadosExtraidos.nf_numero,
            valor_nota: item.valor_total
          };
        })
        .filter(Boolean);

      // Criar recebimento
      const recebimento = await base44.entities.RecebimentoMaterial.create({
        descricao: `NF ${dadosExtraidos.nf_numero} - ${dadosExtraidos.fornecedor_nome}`,
        quantidade_recebida: itensRecebimento.reduce((sum, item) => sum + item.quantidade_recebida, 0),
        data_recebimento: dadosExtraidos.data_emissao,
        nota_fiscal: dadosExtraidos.nf_numero,
        valor_nota: dadosExtraidos.valor_total,
        qualidade: 'aprovado'
      });

      // Atualizar materiais com novo estoque e preço
      for (let i = 0; i < dadosExtraidos.itens.length; i++) {
        const mapeado = mapeamento[i];
        if (!mapeado) continue;

        const material = materiais.find(m => m.id === mapeado.material_id);
        if (!material) continue;

        // Calcular novo preço médio
        const novoEstoque = (material.estoque_atual || 0) + mapeado.quantidade;
        const custoAtual = (material.preco_medio || 0) * (material.estoque_atual || 0);
        const custoNovo = mapeado.preco_compra * mapeado.quantidade;
        const novoPrecoMedio = novoEstoque > 0 ? (custoAtual + custoNovo) / novoEstoque : mapeado.preco_compra;

        await base44.entities.Material.update(mapeado.material_id, {
          estoque_atual: novoEstoque,
          preco_medio: Math.round(novoPrecoMedio * 100) / 100
        });

        // Criar movimentação de estoque
        await base44.entities.MovimentacaoEstoque.create({
          material_id: mapeado.material_id,
          tipo: 'entrada',
          quantidade: mapeado.quantidade,
          valor_unitario: mapeado.preco_compra,
          valor_total: mapeado.preco_compra * mapeado.quantidade,
          data_movimentacao: dadosExtraidos.data_emissao,
          nota_fiscal: dadosExtraidos.nf_numero,
          responsavel: 'importacao_nf'
        });
      }

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['materiais']);
      queryClient.invalidateQueries(['recebimentos']);
      toast.success('Importação concluída com sucesso!');
      setFile(null);
      setDadosExtraidos(null);
      setMapeamento({});
      setMapeamentoDialogAberto(false);
    },
    onError: (error) => {
      toast.error('Erro na importação: ' + error.message);
    }
  });

  const materiaisFiltrados = materiais.filter(m =>
    m.nome.toLowerCase().includes(searchTermoMaterial.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar Nota Fiscal</h1>
          <p className="text-gray-600 mt-1">Importe produtos de notas fiscais em XML ou PDF</p>
        </div>
      </div>

      {/* Card Principal de Upload */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload da Nota Fiscal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-700 mb-2 block font-medium">Tipo de Arquivo</Label>
              <Select value={tipoArquivo} onValueChange={setTipoArquivo} disabled={!!dadosExtraidos}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xml">XML (.xml)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-700 mb-2 block font-medium">Selecionar Arquivo</Label>
              <div className="relative">
                <input
                  type="file"
                  accept={tipoArquivo === 'xml' ? '.xml' : '.pdf'}
                  onChange={(e) => setFile(e.target.files?.[0])}
                  disabled={!!dadosExtraidos}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-700"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="truncate">{file ? file.name : 'Nenhum arquivo selecionado'}</span>
                  </div>
                  <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </label>
              </div>
            </div>
          </div>

          {file && !dadosExtraidos && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-blue-900 font-medium">Arquivo pronto para processamento</p>
                  <p className="text-blue-700 text-sm mt-1 truncate">{file.name}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={() => processarNFMutation.mutate()}
            disabled={!file || processando || !!dadosExtraidos}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11"
            size="lg"
          >
            {processando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando Nota Fiscal...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Processar Nota Fiscal
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dados Extraídos */}
      {dadosExtraidos && (
        <div className="space-y-4">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="bg-green-50 border-b border-green-200">
              <CardTitle className="text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Dados Extraídos com Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <Label className="text-gray-600 text-xs font-medium block mb-1">NF</Label>
                  <div className="text-gray-900 font-semibold">{dadosExtraidos.nf_numero}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <Label className="text-gray-600 text-xs font-medium block mb-1">Data</Label>
                  <div className="text-gray-900 font-semibold">
                    {new Date(dadosExtraidos.data_emissao).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <Label className="text-gray-600 text-xs font-medium block mb-1">Fornecedor</Label>
                  <div className="text-gray-900 font-semibold truncate">{dadosExtraidos.fornecedor_nome}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <Label className="text-blue-700 text-xs font-medium block mb-1">Valor Total</Label>
                  <div className="text-blue-900 font-bold">
                    {dadosExtraidos.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-gray-700 font-semibold">
                    Itens da Nota Fiscal
                  </Label>
                  <Badge className="bg-gray-100 text-gray-700">
                    {dadosExtraidos.itens?.length || 0} {dadosExtraidos.itens?.length === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {dadosExtraidos.itens?.map((item, idx) => {
                    const mapeado = mapeamento[idx];
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border transition-all ${
                          mapeado
                            ? 'bg-green-50 border-green-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 font-medium mb-1">{item.descricao}</p>
                            <div className="flex gap-4 text-sm text-gray-600">
                              <span>Qtd: <strong className="text-gray-900">{item.quantidade} {item.unidade}</strong></span>
                              <span>Unit: <strong className="text-gray-900">{item.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                              <span>Total: <strong className="text-blue-600">{item.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                            </div>
                          </div>
                          {mapeado && (
                            <Badge className="bg-green-600 text-white flex-shrink-0">
                              ✓ Mapeado
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDadosExtraidos(null);
                    setFile(null);
                    setMapeamento({});
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setMapeamentoDialogAberto(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mapear Produtos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog de Mapeamento */}
      <Dialog open={mapeamentoDialogAberto} onOpenChange={setMapeamentoDialogAberto}>
        <DialogContent className="bg-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-gray-900 text-xl">Mapear Produtos da Nota Fiscal</DialogTitle>
            <p className="text-gray-600 text-sm mt-1">Associe os itens da nota aos materiais do sistema</p>
          </DialogHeader>

          {dadosExtraidos && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar material no sistema..."
                    value={searchTermoMaterial}
                    onChange={(e) => setSearchTermoMaterial(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  {dadosExtraidos.itens?.map((item, idx) => {
                    const mapeado = mapeamento[idx];
                    const materialSelecionado = materiais.find(m => m.id === mapeado?.material_id);

                    return (
                      <Card
                        key={idx}
                        className={`border transition-all ${
                          mapeado
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-gray-900 font-semibold text-base mb-1">{item.descricao}</p>
                                <div className="flex gap-4 text-sm text-gray-600">
                                  <span>Qtd: <strong>{item.quantidade} {item.unidade}</strong></span>
                                  <span>Unit: <strong>{item.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                  <span className="text-blue-600">Total: <strong>{item.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                </div>
                              </div>
                              {mapeado && (
                                <Badge className="bg-green-600 text-white">
                                  ✓ Mapeado
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-gray-700 font-medium">Selecionar Material do Sistema</Label>
                              <Select
                                value={mapeado?.material_id || ''}
                                onValueChange={(materialId) => {
                                  const mat = materiais.find(m => m.id === materialId);
                                  setMapeamento({
                                    ...mapeamento,
                                    [idx]: {
                                      material_id: materialId,
                                      preco_compra: item.valor_unitario,
                                      quantidade: item.quantidade,
                                      unidade: mat?.unidade || item.unidade
                                    }
                                  });
                                }}
                              >
                                <SelectTrigger className={mapeado ? 'border-green-400 bg-green-50' : ''}>
                                  <SelectValue placeholder="Clique para selecionar um material..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-80">
                                  {materiaisFiltrados.map(mat => (
                                    <SelectItem key={mat.id} value={mat.id}>
                                      <div className="flex items-center justify-between w-full gap-8">
                                        <span>{mat.nome}</span>
                                        <span className="text-gray-500 text-xs">({mat.unidade})</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {materialSelecionado && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700">Estoque Atual:</span>
                                  <span className="text-gray-900 font-semibold">{materialSelecionado.estoque_atual} {materialSelecionado.unidade}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700">Preço Médio Atual:</span>
                                  <span className="text-gray-900 font-semibold">{materialSelecionado.preco_medio?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                                  <span className="text-blue-700 font-medium">Preço de Compra (Nota):</span>
                                  <span className="text-blue-900 font-bold">{mapeado?.preco_compra?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Button
                  variant="outline"
                  onClick={() => setMapeamentoDialogAberto(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => importarMutation.mutate()}
                  disabled={importarMutation.isPending || Object.keys(mapeamento).length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {importarMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Importação ({Object.keys(mapeamento).length} {Object.keys(mapeamento).length === 1 ? 'item' : 'itens'})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}