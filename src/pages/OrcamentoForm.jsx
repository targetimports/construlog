import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save, Plus, Trash2, FileDown, FileSpreadsheet, Database, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { TableSkeleton } from '@/components/shared/Skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const toNum = (v) => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  let s = String(v).trim().replace(/r\$/i, '').replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s) || 0;
};
const txt = (v) => (v == null ? '' : String(v).trim());
const normHdr = (v) => txt(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CATEGORIAS_VALIDAS = ['materiais', 'mao_obra', 'equipamentos', 'transporte'];
const ITENS_POR_PAGINA = 15;

// Executa fn sobre o array em lotes paralelos (evita centenas de requisições sequenciais).
async function emLotes(arr, tamanho, fn) {
  for (let i = 0; i < arr.length; i += tamanho) {
    await Promise.all(arr.slice(i, i + tamanho).map(fn));
  }
}

export default function OrcamentoForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const orcamentoId = urlParams.get('id');
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    obra_id: '',
    versao: '1.0',
    titulo: '',
    descricao: '',
    status: 'rascunho',
    margem_lucro_percentual: 15,
    data_validade: '',
    observacoes: '',
    usar_sinapi: false
  });

  const [itens, setItens] = useState([]);
  const [novoItem, setNovoItem] = useState({
    categoria: 'materiais',
    descricao: '',
    unidade: '',
    quantidade: '',
    valor_unitario: '',
    mes_previsto: 1
  });

  const [searchSinapi, setSearchSinapi] = useState('');
  const [itensPagina, setItensPagina] = useState(1);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: orcamento } = useQuery({
    queryKey: ['orcamento', orcamentoId],
    queryFn: () => base44.entities.Orcamento.filter({ id: orcamentoId }),
    enabled: !!orcamentoId
  });

  const { data: itensExistentes = [] } = useQuery({
    queryKey: ['itens-orcamento', orcamentoId],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId }),
    enabled: !!orcamentoId
  });

  const { data: itensSinapi = [], isLoading: loadingSinapi } = useQuery({
    queryKey: ['sinapi-items'],
    queryFn: () => base44.entities.TabelaSINAPI.list('-created_date', 10000),
    enabled: formData.usar_sinapi
  });

  useEffect(() => {
    if (orcamento && orcamento.length > 0) {
      setFormData({
        obra_id: orcamento[0].obra_id || '',
        versao: orcamento[0].versao || '1.0',
        titulo: orcamento[0].titulo || '',
        descricao: orcamento[0].descricao || '',
        status: orcamento[0].status || 'rascunho',
        margem_lucro_percentual: orcamento[0].margem_lucro_percentual || 15,
        data_validade: orcamento[0].data_validade || '',
        observacoes: orcamento[0].observacoes || '',
        usar_sinapi: orcamento[0].usar_sinapi || false
      });
    }
  }, [orcamento]);

  useEffect(() => {
    if (itensExistentes.length > 0) {
      setItens(itensExistentes);
    }
  }, [itensExistentes]);

  const calcularTotais = () => {
    const totais = {
      materiais: 0,
      mao_obra: 0,
      equipamentos: 0,
      transporte: 0
    };

    let total = 0;
    itens.forEach(item => {
      const valor = Number(item.valor_total) || (Number(item.quantidade) * Number(item.valor_unitario)) || 0;
      total += valor;
      // só soma nas categorias conhecidas; itens sem categoria entram apenas no total
      if (totais[item.categoria] !== undefined) totais[item.categoria] += valor;
    });

    const margem = Number(formData.margem_lucro_percentual) || 0;
    const valorProposta = total + (total * (margem / 100));
    const outros = total - (totais.materiais + totais.mao_obra + totais.equipamentos + totais.transporte);

    return { ...totais, outros, total, margem, valorProposta };
  };

  const buscarPrecoSINAPI = async (descricao) => {
    if (!formData.usar_sinapi || !descricao || descricao.length < 3) return;

    try {
      const resultados = await base44.entities.TabelaSINAPI.list('-created_date', 10000);

      const match = resultados.find(item =>
        item.descricao && item.descricao.toLowerCase().includes(descricao.toLowerCase())
      );

      if (match) {
        setNovoItem(prev => ({
          ...prev,
          valor_unitario: match.preco_unitario.toString(),
          unidade: match.unidade || prev.unidade
        }));
        toast.success(`Preço SINAPI: R$ ${match.preco_unitario.toFixed(2)}`);
      } else {
        toast.info('Nenhum item SINAPI encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar SINAPI:', error);
    }
  };

  const adicionarItem = () => {
    if (!novoItem.descricao || !novoItem.quantidade || !novoItem.valor_unitario) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const valorTotal = Number(novoItem.quantidade) * Number(novoItem.valor_unitario);
    setItens([...itens, { ...novoItem, valor_total: valorTotal, id: Date.now() }]);
    setItensPagina(Math.ceil((itens.length + 1) / ITENS_POR_PAGINA));
    setNovoItem({
      categoria: 'materiais',
      descricao: '',
      unidade: '',
      quantidade: '',
      valor_unitario: '',
      mes_previsto: 1
    });
  };

  const removerItem = (id) => {
    setItens(itens.filter(item => item.id !== id));
  };

  // Importa itens de uma planilha (XLSX/CSV) — leitura local, sem IA.
  const handleImportPlanilha = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('Planilha vazia.');
      const linhas = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const novos = linhas.map((linha, idx) => {
        const o = {};
        for (const k in linha) o[normHdr(k)] = linha[k];
        const get = (...keys) => {
          for (const key of keys) for (const kk in o) if (kk.includes(key)) return o[kk];
          return '';
        };
        const descricao = txt(get('descri'));
        if (!descricao) return null;
        const quantidade = toNum(get('quant', 'qtd'));
        const valor_unitario = toNum(get('valor unit', 'valor_unit', 'vlr', 'preco', 'unitario'));
        let categoria = normHdr(get('categoria')).replace(/\s+/g, '_');
        if (!CATEGORIAS_VALIDAS.includes(categoria)) {
          categoria = categoria.includes('mao') ? 'mao_obra'
            : categoria.includes('equip') ? 'equipamentos'
            : categoria.includes('transp') ? 'transporte'
            : 'materiais';
        }
        return {
          categoria,
          descricao,
          unidade: txt(get('unidade', 'und', 'unid')),
          quantidade,
          valor_unitario,
          valor_total: quantidade * valor_unitario,
          mes_previsto: toNum(get('mes')) || 1,
          id: Date.now() + idx,
        };
      }).filter(Boolean);

      if (novos.length === 0) {
        toast.error('Nenhum item válido na planilha. Confira as colunas (descrição, quantidade, valor unitário).');
        return;
      }
      setItens((prev) => [...prev, ...novos]);
      toast.success(`${novos.length} itens importados da planilha`);
    } catch (error) {
      toast.error('Erro ao ler planilha: ' + error.message);
    }
  };

  // Gera um modelo CSV client-side para preenchimento.
  const baixarModelo = () => {
    const linhas = [
      ['categoria', 'descricao', 'unidade', 'quantidade', 'valor_unitario'],
      ['materiais', 'Cimento CP II', 'SC', '100', '32,50'],
      ['mao_obra', 'Pedreiro', 'H', '160', '18,00'],
    ];
    const csv = '﻿' + linhas.map((l) => l.join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo-orcamento.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const totais = calcularTotais();
      const orcamentoData = {
        ...data,
        valor_total_materiais: totais.materiais,
        valor_total_mao_obra: totais.mao_obra,
        valor_total_equipamentos: totais.equipamentos,
        valor_total_transporte: totais.transporte,
        valor_total: totais.total,
        valor_proposta: totais.valorProposta,
      };

      let savedOrcamento;
      if (orcamentoId) {
        savedOrcamento = await base44.entities.Orcamento.update(orcamentoId, orcamentoData);
        // remove itens antigos em paralelo (lotes de 25)
        await emLotes(itensExistentes, 25, (item) => base44.entities.ItemOrcamento.delete(item.id));
      } else {
        savedOrcamento = await base44.entities.Orcamento.create({ ...orcamentoData, data_criacao: new Date().toISOString().split('T')[0] });
      }

      // cria todos os novos itens de uma vez (1 requisição)
      const novosItens = itens.map((item) => ({
        orcamento_id: savedOrcamento.id,
        categoria: item.categoria || 'materiais',
        descricao: item.descricao,
        unidade: item.unidade || '',
        quantidade: Number(item.quantidade) || 0,
        valor_unitario: Number(item.valor_unitario) || 0,
        valor_total: Number(item.valor_total) || 0,
        mes_previsto: item.mes_previsto || 1,
      }));
      if (novosItens.length) {
        await base44.entities.ItemOrcamento.bulkCreate(novosItens);
      }

      return savedOrcamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success('Orçamento salvo com sucesso!');
      window.location.href = createPageUrl('Orcamentos');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  const totais = calcularTotais();
  const itensTotalPaginas = Math.max(1, Math.ceil(itens.length / ITENS_POR_PAGINA));
  const itensPagAtual = Math.min(itensPagina, itensTotalPaginas);
  const itensPage = itens.slice((itensPagAtual - 1) * ITENS_POR_PAGINA, itensPagAtual * ITENS_POR_PAGINA);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.href = createPageUrl('Orcamentos')}
          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {orcamentoId ? 'Editar Orçamento' : 'Novo Orçamento'}
          </h1>
          <p className="text-gray-600 text-sm">
            Preencha os dados do orçamento e adicione os itens
          </p>
        </div>
      </div>

      {/* Dados Básicos */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Dados do Orçamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label className="text-gray-700 font-medium">Obra *</Label>
            <div className="mt-1.5">
              <ComboboxBusca
                options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                value={formData.obra_id}
                onSelect={(v) => setFormData({ ...formData, obra_id: v })}
                placeholder="Selecione a obra"
                searchPlaceholder="Buscar obra..."
              />
            </div>
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Versão</Label>
            <Input
              value={formData.versao}
              onChange={(e) => setFormData({...formData, versao: e.target.value})}
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
              <SelectTrigger className="mt-1.5 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="vigente">Vigente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-gray-700 font-medium">Título *</Label>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData({...formData, titulo: e.target.value})}
              placeholder="Título do orçamento"
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Margem de Lucro (%)</Label>
            <Input
              type="number"
              value={formData.margem_lucro_percentual}
              onChange={(e) => setFormData({...formData, margem_lucro_percentual: Number(e.target.value)})}
              className="mt-1.5 h-11"
            />
          </div>
          
          <div className="md:col-span-3 mt-4">
            <div className="flex items-center space-x-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Checkbox
                id="usar_sinapi"
                checked={formData.usar_sinapi}
                onCheckedChange={(checked) => setFormData({ ...formData, usar_sinapi: checked })}
              />
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <Label htmlFor="usar_sinapi" className="cursor-pointer font-medium text-emerald-900">
                  Orçar com SINAPI (busca automática de preços de referência ao adicionar itens)
                </Label>
              </div>
            </div>
          </div>
        </div>

        {formData.usar_sinapi && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              Materiais SINAPI Disponíveis
            </h3>
            
            {loadingSinapi ? (
              <TableSkeleton bare rows={6} cols={5} className="border border-gray-200 rounded-lg" />
            ) : itensSinapi.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                <Database className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                <h4 className="font-semibold text-amber-900 mb-2">
                  Nenhum item SINAPI encontrado
                </h4>
                <p className="text-sm text-amber-700 mb-4">
                  Você precisa importar a tabela SINAPI primeiro para usar os preços de referência
                </p>
                <Button
                  onClick={() => window.location.href = createPageUrl('ImportarSINAPI')}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Ir para Importar SINAPI
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <Input
                    placeholder="Buscar material na SINAPI..."
                    value={searchSinapi}
                    onChange={(e) => setSearchSinapi(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                {/* overflow-auto: rola nos dois eixos — vertical pela altura
                    limitada, horizontal para a tabela caber no celular. */}
                <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg">
                  <Table className="min-w-[560px]">
                    <TableHeader className="bg-emerald-50 sticky top-0">
                      <TableRow>
                        <TableHead className="text-emerald-900 font-semibold">Código</TableHead>
                        <TableHead className="text-emerald-900 font-semibold">Descrição</TableHead>
                        <TableHead className="text-emerald-900 font-semibold">Unidade</TableHead>
                        <TableHead className="text-emerald-900 font-semibold text-right">Preço</TableHead>
                        <TableHead className="text-emerald-900 font-semibold"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensSinapi
                        .filter(item => 
                          !searchSinapi || 
                          item.descricao?.toLowerCase().includes(searchSinapi.toLowerCase()) ||
                          item.codigo_sinapi?.toLowerCase().includes(searchSinapi.toLowerCase())
                        )
                        .slice(0, 50)
                        .map((item) => (
                          <TableRow key={item.id} className="hover:bg-emerald-50/50">
                            <TableCell className="text-gray-600 font-mono text-sm">
                              {item.codigo_sinapi}
                            </TableCell>
                            <TableCell className="text-gray-900 text-sm">
                              {item.descricao}
                            </TableCell>
                            <TableCell className="text-gray-600 font-medium">
                              {item.unidade}
                            </TableCell>
                            <TableCell className="text-gray-900 text-right font-semibold">
                              {item.preco_unitario?.toLocaleString('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              })}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                onClick={() => {
                                  setNovoItem({
                                    ...novoItem,
                                    descricao: item.descricao,
                                    unidade: item.unidade || '',
                                    valor_unitario: (item.preco_unitario ?? 0).toString()
                                  });
                                  toast.success('Item preenchido com dados SINAPI');
                                }}
                              >
                                Usar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Mostrando até 50 resultados. Use a busca para filtrar.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Itens do Orçamento */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Itens do Orçamento</h2>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportPlanilha} className="hidden" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 border-gray-300 text-gray-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importar Planilha
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFormData((p) => ({ ...p, usar_sinapi: true }));
                toast.success('Painel SINAPI ativado acima — busque e clique em "Usar".');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            >
              <Database className="w-4 h-4" />
              Itens da SINAPI
            </Button>
            <Button variant="outline" size="sm" onClick={baixarModelo} className="gap-2 border-gray-300 text-gray-700">
              <FileDown className="w-4 h-4" />
              Baixar Modelo
            </Button>
          </div>
        </div>
        
        {/* Adicionar Item */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <Select value={novoItem.categoria} onValueChange={(v) => setNovoItem({...novoItem, categoria: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="materiais">Materiais</SelectItem>
                <SelectItem value="mao_obra">Mão de Obra</SelectItem>
                <SelectItem value="equipamentos">Equipamentos</SelectItem>
                <SelectItem value="transporte">Transporte</SelectItem>
              </SelectContent>
            </Select>
            <div className="md:col-span-2 flex gap-2">
              <Input
                placeholder="Descrição"
                value={novoItem.descricao}
                onChange={(e) => setNovoItem({...novoItem, descricao: e.target.value})}
              />
              {formData.usar_sinapi && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => buscarPrecoSINAPI(novoItem.descricao)}
                  disabled={!novoItem.descricao || novoItem.descricao.length < 3}
                  className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                  title="Buscar preço na SINAPI"
                >
                  <Search className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Input
              placeholder="Unidade"
              value={novoItem.unidade}
              onChange={(e) => setNovoItem({...novoItem, unidade: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Qtd"
              value={novoItem.quantidade}
              onChange={(e) => setNovoItem({...novoItem, quantidade: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Valor Unit."
              value={novoItem.valor_unitario}
              onChange={(e) => setNovoItem({...novoItem, valor_unitario: e.target.value})}
            />
            <Button onClick={adicionarItem} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-gray-700 font-semibold">Categoria</TableHead>
                <TableHead className="text-gray-700 font-semibold">Descrição</TableHead>
                <TableHead className="text-gray-700 font-semibold">Unidade</TableHead>
                <TableHead className="text-gray-700 font-semibold text-right">Quantidade</TableHead>
                <TableHead className="text-gray-700 font-semibold text-right">Valor Unit.</TableHead>
                <TableHead className="text-gray-700 font-semibold text-right">Total</TableHead>
                <TableHead className="text-gray-700 font-semibold"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhum item adicionado ainda.</TableCell></TableRow>
              ) : itensPage.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="text-gray-900 capitalize font-medium">{(item.categoria || '—').replace('_', ' ')}</TableCell>
                  <TableCell className="text-gray-900">{item.descricao}</TableCell>
                  <TableCell className="text-gray-600">{item.unidade}</TableCell>
                  <TableCell className="text-gray-900 text-right">{item.quantidade}</TableCell>
                  <TableCell className="text-gray-900 text-right">
                    {(Number(item.valor_unitario) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell className="text-gray-900 text-right font-semibold">
                    {(Number(item.valor_total) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginação dos itens */}
        {itens.length > 0 && (
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-xs text-gray-500">Mostrando {(itensPagAtual - 1) * ITENS_POR_PAGINA + 1}–{Math.min(itensPagAtual * ITENS_POR_PAGINA, itens.length)} de {itens.length} itens</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={itensPagAtual <= 1} onClick={() => setItensPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
              <span className="text-xs text-gray-600">Página {itensPagAtual} de {itensTotalPaginas}</span>
              <Button variant="outline" size="sm" disabled={itensPagAtual >= itensTotalPaginas} onClick={() => setItensPagina((p) => Math.min(itensTotalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Resumo do Orçamento</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { key: 'materiais', label: 'Materiais', cls: 'bg-blue-50 border-blue-200', txt: 'text-blue-700' },
            { key: 'mao_obra', label: 'Mão de Obra', cls: 'bg-emerald-50 border-emerald-200', txt: 'text-emerald-700' },
            { key: 'equipamentos', label: 'Equipamentos', cls: 'bg-purple-50 border-purple-200', txt: 'text-purple-700' },
            { key: 'transporte', label: 'Transporte', cls: 'bg-amber-50 border-amber-200', txt: 'text-amber-700' },
            { key: 'outros', label: 'Serviços / Sem categoria', cls: 'bg-gray-50 border-gray-200', txt: 'text-gray-600' },
          ]
            .filter((c) => c.key !== 'outros' ? true : (totais.outros || 0) > 0.005)
            .map((c) => (
              <div key={c.key} className={`p-4 rounded-lg border ${c.cls}`}>
                <p className={`${c.txt} text-sm font-medium mb-1`}>{c.label}</p>
                <p className="text-gray-900 font-bold text-lg tabular-nums">{(totais[c.key] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            ))}

          <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
            <p className="text-gray-600 text-sm font-medium mb-1">Custo Total</p>
            <p className="text-gray-900 font-bold text-lg tabular-nums">{(totais.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
            <p className="text-blue-100 text-sm font-medium mb-1">Valor Proposta <span className="opacity-80">(+{totais.margem || 0}% margem)</span></p>
            <p className="text-white font-bold text-xl tabular-nums">{(totais.valorProposta || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => window.location.href = createPageUrl('Orcamentos')}
        >
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending || !formData.obra_id || !formData.titulo}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Orçamento'}
        </Button>
      </div>

    </div>
  );
}