import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertCircle, Loader2, Download, Search, TrendingUp, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { montarCSV, baixarCSV } from '@/lib/csvBR';

export default function AtualizarPrecos() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [novoPreco, setNovoPreco] = useState('');
  const [showComposicoesImpactadas, setShowComposicoesImpactadas] = useState(null);
  const queryClient = useQueryClient();

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list('-created_date', 500),
    initialData: []
  });

  const { data: composicoes = [] } = useQuery({
    queryKey: ['composicoes'],
    queryFn: () => base44.entities.Composicao.list('-created_date', 500)
  });

  const { data: composicoesInsumos = [] } = useQuery({
    queryKey: ['composicoes-insumos'],
    queryFn: () => base44.entities.ComposicaoInsumo.list('-created_date', 2000)
  });

  // Recalcula as composições que usam um insumo quando o preço muda (custo_parcial
  // de cada ComposicaoInsumo + custo_unitario da Composicao). Reusado pelo edit
  // individual E pela importação em lote — antes só o individual recalculava.
  const recalcularComposicoesDoInsumo = async (insumo_id, preco_novo) => {
    const preco = parseFloat(preco_novo) || 0;
    const relacoes = composicoesInsumos.filter((ci) => ci.insumo_id === insumo_id);
    for (const rel of relacoes) {
      const todasRelacoes = composicoesInsumos.filter((ci) => ci.composicao_id === rel.composicao_id);
      const novoCustoParcial = (rel.coeficiente || 0) * preco;
      await base44.entities.ComposicaoInsumo.update(rel.id, { custo_parcial: novoCustoParcial });
      let custoTotal = 0;
      for (const r of todasRelacoes) {
        custoTotal += r.id === rel.id ? novoCustoParcial : (r.custo_parcial || 0);
      }
      await base44.entities.Composicao.update(rel.composicao_id, {
        custo_unitario: custoTotal,
        ultima_atualizacao: new Date().toISOString()
      });
    }
    return relacoes.length;
  };

  const updatePrecoMutation = useMutation({
    mutationFn: async ({ insumo_id, preco_novo }) => {
      await base44.entities.Insumo.update(insumo_id, {
        preco_unitario: parseFloat(preco_novo),
        data_preco: new Date().toISOString()
      });

      // Busca composições impactadas
      const relacoes = composicoesInsumos.filter(ci => ci.insumo_id === insumo_id);
      
      // Recalcula cada composição impactada
      for (const rel of relacoes) {
        const todasRelacoes = composicoesInsumos.filter(ci => ci.composicao_id === rel.composicao_id);
        
        // Recalcula custo parcial desta relação
        const novoCustoParcial = rel.coeficiente * parseFloat(preco_novo);
        await base44.entities.ComposicaoInsumo.update(rel.id, {
          custo_parcial: novoCustoParcial
        });

        // Recalcula custo total da composição
        let custoTotal = 0;
        for (const r of todasRelacoes) {
          if (r.id === rel.id) {
            custoTotal += novoCustoParcial;
          } else {
            custoTotal += r.custo_parcial || 0;
          }
        }

        await base44.entities.Composicao.update(rel.composicao_id, {
          custo_unitario: custoTotal,
          ultima_atualizacao: new Date().toISOString()
        });
      }

      return relacoes.length;
    },
    onSuccess: (numComposicoes) => {
      queryClient.invalidateQueries(['insumos']);
      queryClient.invalidateQueries(['composicoes']);
      queryClient.invalidateQueries(['composicoes-insumos']);
      setEditingInsumo(null);
      setNovoPreco('');
      toast.success(`Preço atualizado! ${numComposicoes} composição(ões) recalculada(s)`);
    }
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(selectedFile.type)) {
        toast.error('Arquivo inválido. Use CSV ou Excel');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    baixarCSV('template_precos', montarCSV([
      ['Código Insumo', 'Descrição', 'Unidade', 'Preço Novo', 'Data Atualização'],
      ['EX001', 'Cimento Portland 50kg', 'sc', '50.00', hoje],
      ['EX002', 'Areia Média', 'm3', '120.00', hoje],
    ]));
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo');
      return;
    }

    setIsLoading(true);
    try {
      // Ler arquivo
      const text = await file.text();
      const lines = text.split('\n').slice(1).filter(l => l.trim());
      
      let atualizados = 0;
      let erros = 0;
      const errosList = [];

      const sep = (lines[0] || '').includes(';') ? ';' : ',';
      for (const line of lines) {
        const [codigo, descricao, unidade, preco] = line.split(sep).map(s => s.trim());
        
        if (!codigo || !preco) {
          erros++;
          errosList.push(`Linha inválida: ${line}`);
          continue;
        }

        try {
          // Procura insumo por código
          const insumo = insumos.find(i => i.codigo === codigo);
          
          if (insumo) {
            await base44.entities.Insumo.update(insumo.id, {
              preco_unitario: parseFloat(preco),
              data_preco: new Date().toISOString()
            });
            await recalcularComposicoesDoInsumo(insumo.id, preco);
            atualizados++;
          } else {
            erros++;
            errosList.push(`Insumo não encontrado: ${codigo}`);
          }
        } catch (err) {
          erros++;
          errosList.push(`Erro ao atualizar ${codigo}: ${err.message}`);
        }
      }

      setResult({
        atualizados,
        erros,
        total: lines.length,
        errosList: errosList.slice(0, 5)
      });

      if (atualizados > 0) {
        queryClient.invalidateQueries(['insumos']);
        queryClient.invalidateQueries(['composicoes']);
        queryClient.invalidateQueries(['composicoes-insumos']);
        toast.success(`${atualizados} preço(s) atualizado(s)`);
      }
    } catch (err) {
      toast.error('Erro ao processar arquivo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const composicoesImpactadas = (insumoId) => {
    return composicoesInsumos
      .filter(ci => ci.insumo_id === insumoId)
      .map(ci => {
        const comp = composicoes.find(c => c.id === ci.composicao_id);
        return comp;
      })
      .filter(Boolean);
  };

  const insumosOrdenados = [...insumos]
    .filter(ins => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        ins.codigo?.toLowerCase().includes(term) ||
        ins.descricao?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const dataA = a.data_preco ? new Date(a.data_preco) : new Date(0);
      const dataB = b.data_preco ? new Date(b.data_preco) : new Date(0);
      return dataA - dataB; // Mais antigos primeiro
    });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Atualizar Preços</h1>
        <p className="text-gray-600 mt-2">Atualize preços de insumos e recalcule composições automaticamente</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Insumos</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{insumos.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Composições</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{composicoes.length}</p>
              </div>
              <Calculator className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Desatualizados</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600">
                  {insumos.filter(i => {
                    if (!i.data_preco) return true;
                    const mesesAtras = new Date();
                    mesesAtras.setMonth(mesesAtras.getMonth() - 6);
                    return new Date(i.data_preco) < mesesAtras;
                  }).length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Importar Arquivo</CardTitle>
          <CardDescription>CSV ou Excel com os novos preços</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <label className="cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Clique para selecionar</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {file && <p className="text-sm text-blue-600 mt-2">✓ {file.name}</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={downloadTemplate} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!file || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Atualizar Preços'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <Card className={result.erros === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.erros === 0 ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded p-3 text-center">
                <p className="text-gray-600 text-sm">Atualizado</p>
                <p className="text-2xl font-bold text-emerald-600">{result.atualizados}</p>
              </div>
              <div className="bg-white rounded p-3 text-center">
                <p className="text-gray-600 text-sm">Erros</p>
                <p className="text-2xl font-bold text-red-600">{result.erros}</p>
              </div>
              <div className="bg-white rounded p-3 text-center">
                <p className="text-gray-600 text-sm">Total</p>
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
              </div>
            </div>

            {result.errosList.length > 0 && (
              <div className="bg-white rounded p-3 text-sm">
                <p className="font-medium text-gray-900 mb-2">Erros detectados:</p>
                <ul className="space-y-1 text-gray-700">
                  {result.errosList.map((erro, i) => (
                    <li key={i}>• {erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Atualização Individual */}
      <Card>
        <CardHeader>
          <CardTitle>Atualizar Preços Individualmente</CardTitle>
          <CardDescription>Busque e atualize o preço de insumos específicos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {insumosOrdenados.slice(0, 20).map(ins => {
              const isEditing = editingInsumo === ins.id;
              const composImpactadas = composicoesImpactadas(ins.id);
              const diasDesatualizados = ins.data_preco 
                ? Math.floor((new Date() - new Date(ins.data_preco)) / (1000 * 60 * 60 * 24))
                : 999;

              return (
                <div 
                  key={ins.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-mono text-sm text-gray-600">{ins.codigo}</p>
                        <Badge className={
                          ins.tipo === 'material' ? 'bg-blue-100 text-blue-700' :
                          ins.tipo === 'mao_obra' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-amber-100 text-amber-700'
                        }>
                          {ins.tipo}
                        </Badge>
                        {diasDesatualizados > 180 && (
                          <Badge className="bg-orange-100 text-orange-700">
                            {diasDesatualizados} dias
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 mb-2 break-words">{ins.descricao}</p>
                      <p className="text-xs text-gray-600">
                        Última atualização: {ins.data_preco 
                          ? new Date(ins.data_preco).toLocaleDateString('pt-BR') 
                          : 'Nunca'}
                      </p>
                      {composImpactadas.length > 0 && (
                        <button
                          onClick={() => setShowComposicoesImpactadas(ins.id)}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          {composImpactadas.length} composição(ões) serão recalculadas
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right shrink-0">
                      <div className="sm:text-right">
                        <p className="text-sm text-gray-600">Preço Atual</p>
                        <p className="text-xl font-bold text-gray-900">
                          {(ins.preco_unitario || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </p>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={novoPreco}
                            onChange={(e) => setNovoPreco(e.target.value)}
                            placeholder="Novo preço"
                            className="w-32"
                          />
                          <div className="flex gap-1">
                            <Button 
                              size="sm"
                              onClick={() => updatePrecoMutation.mutate({ 
                                insumo_id: ins.id, 
                                preco_novo: novoPreco 
                              })}
                              disabled={updatePrecoMutation.isPending || !novoPreco}
                            >
                              Salvar
                            </Button>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingInsumo(null);
                                setNovoPreco('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => {
                            setEditingInsumo(ins.id);
                            setNovoPreco(ins.preco_unitario?.toString() || '');
                          }}
                        >
                          Atualizar Preço
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Composições Impactadas */}
                  {showComposicoesImpactadas === ins.id && composImpactadas.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        Composições que serão recalculadas:
                      </p>
                      <div className="space-y-1">
                        {composImpactadas.slice(0, 5).map(comp => (
                          <div key={comp.id} className="text-xs text-gray-700 flex items-center gap-2">
                            <span className="font-mono">{comp.codigo}</span>
                            <span>-</span>
                            <span className="truncate">{comp.descricao}</span>
                          </div>
                        ))}
                        {composImpactadas.length > 5 && (
                          <p className="text-xs text-gray-500 mt-1">
                            +{composImpactadas.length - 5} mais...
                          </p>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setShowComposicoesImpactadas(null)}
                        className="mt-2 text-xs"
                      >
                        Ocultar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {insumosOrdenados.length > 20 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Mostrando 20 de {insumosOrdenados.length} insumos. Use a busca para refinar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Formato do Arquivo (Importação em Lote)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>A planilha deve conter as seguintes colunas:</p>
          <ul className="ml-4 space-y-1">
            <li><strong>Código Insumo:</strong> Código do insumo no sistema</li>
            <li><strong>Descrição:</strong> Nome do insumo</li>
            <li><strong>Unidade:</strong> Unidade de medida</li>
            <li><strong>Preço Novo:</strong> Novo preço (use ponto como separador decimal)</li>
            <li><strong>Data Atualização:</strong> Data da atualização</li>
          </ul>
          <p className="mt-3 text-blue-700 font-medium">
            Ao atualizar um preço, todas as composições que usam esse insumo são automaticamente recalculadas!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}