import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

const FONTES = [
  { value: 'obras', label: 'Obras' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'compras', label: 'Compras' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'medicoes', label: 'Medições' },
  { value: 'ordens_compra', label: 'Ordens de Compra' },
];

const CAMPOS_POR_FONTE = {
  obras: [
    { value: 'nome', label: 'Nome da Obra' }, { value: 'status', label: 'Status' },
    { value: 'valor_orcado', label: 'Valor Orçado' }, { value: 'valor_realizado', label: 'Valor Realizado' },
    { value: 'data_inicio', label: 'Data Início' }, { value: 'data_fim', label: 'Data Fim' },
    { value: 'cliente', label: 'Cliente' }, { value: 'municipio', label: 'Município' },
  ],
  financeiro: [
    { value: 'descricao', label: 'Descrição' }, { value: 'valor', label: 'Valor' },
    { value: 'status', label: 'Status' }, { value: 'tipo', label: 'Tipo' },
    { value: 'data_vencimento', label: 'Vencimento' }, { value: 'categoria', label: 'Categoria' },
  ],
  compras: [
    { value: 'titulo', label: 'Título' }, { value: 'status', label: 'Status' },
    { value: 'prioridade', label: 'Prioridade' }, { value: 'valor_total_estimado', label: 'Valor Total' },
    { value: 'data_necessidade', label: 'Necessidade' }, { value: 'solicitante_nome', label: 'Solicitante' },
  ],
  estoque: [
    { value: 'descricao_insumo', label: 'Insumo' }, { value: 'saldo_atual', label: 'Saldo Atual' },
    { value: 'unidade', label: 'Unidade' }, { value: 'deposito_nome', label: 'Depósito' },
  ],
  medicoes: [
    { value: 'numero', label: 'Número' }, { value: 'status', label: 'Status' },
    { value: 'percentual_executado', label: '% Executado' }, { value: 'valor_medicao', label: 'Valor Medição' },
    { value: 'data_medicao', label: 'Data Medição' },
  ],
  ordens_compra: [
    { value: 'numero', label: 'Número OC' }, { value: 'status', label: 'Status' },
    { value: 'valor_total', label: 'Valor Total' }, { value: 'fornecedor_nome', label: 'Fornecedor' },
    { value: 'data_emissao', label: 'Emissão' }, { value: 'data_entrega', label: 'Entrega' },
  ],
};

const OPERADORES = [
  { value: 'igual', label: '= Igual a' }, { value: 'diferente', label: '≠ Diferente de' },
  { value: 'contem', label: '⊃ Contém' }, { value: 'maior_que', label: '> Maior que' },
  { value: 'menor_que', label: '< Menor que' }, { value: 'entre', label: '↔ Entre (min,max)' },
];

const DEFAULT_FORM = {
  nome: '', descricao: '', fonte_dados: 'obras',
  campos_visibles: [], filtros: [], agrupamento: '',
  ordenacao: '', ordem_direcao: 'asc',
};

export default function RelatorioForm({ relatorio, onClose, onSuccess }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM, ...(relatorio || {}) });
  const [novoFiltro, setNovoFiltro] = useState({ campo: '', operador: 'igual', valor: '' });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });

  const saveMutation = useMutation({
    mutationFn: (data) => relatorio?.id
      ? base44.entities.RelatorioCustomizado.update(relatorio.id, data)
      : base44.entities.RelatorioCustomizado.create({ ...data, criado_por: user?.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatorios-customizados'] });
      toast.success(relatorio ? 'Relatório atualizado!' : 'Relatório criado!');
      onSuccess();
    },
    onError: () => toast.error('Erro ao salvar relatório'),
  });

  const campos = CAMPOS_POR_FONTE[form.fonte_dados] || [];

  const toggleCampo = (campo) => {
    const atual = form.campos_visibles || [];
    setForm({ ...form, campos_visibles: atual.includes(campo) ? atual.filter(c => c !== campo) : [...atual, campo] });
  };

  const addFiltro = () => {
    if (!novoFiltro.campo || !novoFiltro.valor) return;
    setForm({ ...form, filtros: [...(form.filtros || []), { ...novoFiltro }] });
    setNovoFiltro({ campo: '', operador: 'igual', valor: '' });
  };

  const removeFiltro = (i) => setForm({ ...form, filtros: form.filtros.filter((_, idx) => idx !== i) });

  const setFonteDados = (fonte) => setForm({ ...form, fonte_dados: fonte, campos_visibles: [], agrupamento: '', ordenacao: '' });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{relatorio ? 'Editar Relatório' : 'Novo Relatório Dinâmico'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Básico */}
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Obras em Andamento — Q1 2025" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Objetivo do relatório" rows={2} />
            </div>
            <div>
              <Label>Fonte de Dados *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {FONTES.map(f => (
                  <button key={f.value} type="button"
                    onClick={() => setFonteDados(f.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${form.fonte_dados === f.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Campos */}
          <div>
            <Label className="mb-2 block">Colunas a Exibir</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-gray-50">
              {campos.map(c => (
                <label key={c.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.campos_visibles?.includes(c.value)}
                    onCheckedChange={() => toggleCampo(c.value)}
                  />
                  <span className="text-sm text-gray-700">{c.label}</span>
                </label>
              ))}
            </div>
            {(!form.campos_visibles || form.campos_visibles.length === 0) && (
              <p className="text-xs text-gray-500 mt-1">Nenhum campo selecionado — todos os campos padrão serão exibidos.</p>
            )}
          </div>

          {/* Filtros */}
          <div>
            <Label className="mb-2 block">Filtros</Label>
            <div className="space-y-2">
              {(form.filtros || []).map((f, i) => {
                const campoLabel = campos.find(c => c.value === f.campo)?.label || f.campo;
                const opLabel = OPERADORES.find(o => o.value === f.operador)?.label || f.operador;
                return (
                  <div key={i} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <Badge variant="secondary">{campoLabel}</Badge>
                    <span className="text-gray-500">{opLabel}</span>
                    <span className="font-medium text-gray-800">{f.valor}</span>
                    <button onClick={() => removeFiltro(i)} className="ml-auto text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 p-3 border rounded-lg bg-gray-50 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Select value={novoFiltro.campo} onValueChange={v => setNovoFiltro({ ...novoFiltro, campo: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Campo" /></SelectTrigger>
                  <SelectContent>{campos.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={novoFiltro.operador} onValueChange={v => setNovoFiltro({ ...novoFiltro, operador: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERADORES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="text-sm" placeholder="Valor" value={novoFiltro.valor} onChange={e => setNovoFiltro({ ...novoFiltro, valor: e.target.value })} />
              </div>
              <Button size="sm" variant="outline" onClick={addFiltro} className="w-full gap-1" disabled={!novoFiltro.campo || !novoFiltro.valor}>
                <Plus className="w-3.5 h-3.5" /> Adicionar Filtro
              </Button>
            </div>
          </div>

          {/* Agrupamento e Ordenação */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Agrupar Por</Label>
              <Select value={form.agrupamento || '__none__'} onValueChange={v => setForm({ ...form, agrupamento: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sem agrupamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem agrupamento</SelectItem>
                  {campos.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordenar Por</Label>
              <div className="flex gap-1">
                <Select value={form.ordenacao || '__none__'} onValueChange={v => setForm({ ...form, ordenacao: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem ordenação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem ordenação</SelectItem>
                    {campos.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button type="button"
                  onClick={() => setForm({ ...form, ordem_direcao: form.ordem_direcao === 'asc' ? 'desc' : 'asc' })}
                  className="px-2 border rounded text-gray-500 hover:text-blue-600 hover:border-blue-400"
                  title={form.ordem_direcao === 'asc' ? 'Crescente' : 'Decrescente'}>
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
              {form.ordenacao && (
                <p className="text-xs text-gray-500 mt-1">{form.ordem_direcao === 'asc' ? '↑ Crescente' : '↓ Decrescente'}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate(form)} disabled={!form.nome || saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar Relatório'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}