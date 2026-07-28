import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings, Save, Plus, Trash2, Pencil, Lock, Search, Sliders, ShieldCheck, Layers,
  Info, Wrench, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { CONFIG_CATALOG, catalogoPorChave } from '@/components/shared/configCatalog';

const ITENS_POR_PAGINA = 15;

const CATEGORIAS = [
  { value: 'geral', label: 'Geral' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'obras', label: 'Obras' },
  { value: 'frota', label: 'Frota' },
  { value: 'rh', label: 'RH' },
  { value: 'notificacoes', label: 'Notificações' }
];

const TIPOS = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' }
];

const BOOL_OPCOES = [
  { value: 'true', label: 'true (ativado)' },
  { value: 'false', label: 'false (desativado)' }
];

const TIPO_COR = {
  texto: 'bg-blue-100 text-blue-700',
  numero: 'bg-violet-100 text-violet-700',
  boolean: 'bg-emerald-100 text-emerald-700',
  json: 'bg-amber-100 text-amber-700'
};

const FORM_VAZIO = { chave: '', valor: '', tipo: 'texto', categoria: 'geral', descricao: '', editavel: true };

const labelCategoria = (v) => CATEGORIAS.find(c => c.value === v)?.label || v || '—';

export default function ConfiguracoesSistema() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [modoManual, setModoManual] = useState(false); // criar chave fora do catálogo (avançado)
  const [excluir, setExcluir] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['configuracoes-sistema'],
    queryFn: () => base44.entities.ConfiguracaoSistema.list()
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['configuracoes-sistema'] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfiguracaoSistema.create(data),
    onSuccess: () => { invalidar(); toast.success('Configuração criada!'); resetForm(); },
    onError: () => toast.error('Erro ao criar configuração')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ConfiguracaoSistema.update(id, data),
    onSuccess: () => { invalidar(); toast.success('Configuração atualizada!'); resetForm(); },
    onError: () => toast.error('Erro ao atualizar configuração')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracaoSistema.delete(id),
    onSuccess: () => { invalidar(); toast.success('Configuração excluída!'); setExcluir(null); },
    onError: () => toast.error('Erro ao excluir configuração')
  });

  const resetForm = () => {
    setFormData(FORM_VAZIO);
    setEditingConfig(null);
    setModoManual(false);
    setDialogOpen(false);
  };

  const abrirNova = () => { setEditingConfig(null); setModoManual(false); setFormData(FORM_VAZIO); setDialogOpen(true); };

  // Ao escolher uma regra do catálogo, preenche tudo e já sugere o valor padrão.
  const escolherDoCatalogo = (chave) => {
    const cat = catalogoPorChave(chave);
    if (!cat) return;
    setFormData({
      chave: cat.chave,
      valor: cat.padrao ?? '',
      tipo: cat.tipo || 'texto',
      categoria: cat.categoria || 'geral',
      descricao: cat.descricao || '',
      editavel: true
    });
  };

  const handleEdit = (config) => {
    if (config.editavel === false) { toast.error('Esta configuração é somente leitura'); return; }
    setEditingConfig(config);
    setModoManual(false);
    setFormData({
      chave: config.chave || '',
      valor: config.valor ?? '',
      tipo: config.tipo || 'texto',
      categoria: config.categoria || 'geral',
      descricao: config.descricao || '',
      editavel: config.editavel !== false
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.chave.trim()) { toast.error('Escolha uma configuração ou informe a chave'); return; }
    if (String(formData.valor).trim() === '') { toast.error('Informe o valor'); return; }
    // Valida JSON antes de salvar (senão o módulo que lê cai no padrão).
    if (formData.tipo === 'json') {
      try { JSON.parse(formData.valor); }
      catch { toast.error('O valor não é um JSON válido'); return; }
    }
    if (editingConfig) updateMutation.mutate({ id: editingConfig.id, data: formData });
    else createMutation.mutate(formData);
  };

  // Categorias para o filtro: predefinidas + extras já gravadas.
  const opcoesFiltro = useMemo(() => {
    const extras = [...new Set(configs.map(c => c.categoria).filter(Boolean))]
      .filter(v => !CATEGORIAS.some(c => c.value === v))
      .map(v => ({ value: v, label: v }));
    return [{ value: 'todas', label: 'Todas as categorias' }, ...CATEGORIAS, ...extras];
  }, [configs]);

  // Regras do catálogo ainda NÃO cadastradas (para o seletor guiado).
  const catalogoDisponivel = useMemo(() => {
    const jaExistem = new Set(configs.map(c => c.chave));
    return CONFIG_CATALOG.filter(c => !jaExistem.has(c.chave))
      .map(c => ({ value: c.chave, label: `${c.label}  ·  ${c.modulo}` }));
  }, [configs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return configs.filter(c => {
      if (filtroCategoria !== 'todas' && c.categoria !== filtroCategoria) return false;
      if (!q) return true;
      const cat = catalogoPorChave(c.chave);
      return [c.chave, c.valor, c.descricao, cat?.label].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [configs, busca, filtroCategoria]);

  const stats = useMemo(() => ({
    total: configs.length,
    editaveis: configs.filter(c => c.editavel !== false).length,
    bloqueadas: configs.filter(c => c.editavel === false).length,
    categorias: new Set(configs.map(c => c.categoria).filter(Boolean)).size
  }), [configs]);

  const pag = usePagination(filtrados, ITENS_POR_PAGINA);
  React.useEffect(() => { pag.goToPage(1); /* eslint-disable-next-line */ }, [busca, filtroCategoria]);

  const catSelecionado = catalogoPorChave(formData.chave);
  // No modo criar guiado, só mostra os campos depois de escolher a chave.
  const mostrarCampos = !!editingConfig || modoManual || !!formData.chave;

  // Renderiza o campo de valor adequado ao tipo / opções do catálogo.
  const renderCampoValor = () => {
    if (catSelecionado?.opcoes) {
      return (
        <ComboboxBusca
          options={catSelecionado.opcoes}
          value={formData.valor}
          onSelect={(v) => setFormData({ ...formData, valor: v })}
          placeholder="Selecione o valor"
        />
      );
    }
    if (formData.tipo === 'boolean') {
      return (
        <ComboboxBusca
          options={BOOL_OPCOES}
          value={formData.valor}
          onSelect={(v) => setFormData({ ...formData, valor: v })}
          placeholder="Selecione"
        />
      );
    }
    if (formData.tipo === 'json') {
      return (
        <Textarea
          value={formData.valor}
          onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
          rows={6}
          className="font-mono text-xs"
          placeholder='[{"item_nome":"Pneus","status":"OK"}]'
        />
      );
    }
    if (formData.tipo === 'numero') {
      return (
        <Input
          type="number"
          step="any"
          className="h-11"
          value={formData.valor}
          onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
          placeholder="Ex.: 5000"
        />
      );
    }
    return (
      <Input
        className="h-11"
        value={formData.valor}
        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
      />
    );
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
          <p className="text-gray-500 mt-1">Regras de negócio (chave/valor) consumidas pelos módulos do ERP</p>
        </div>
        <Button onClick={abrirNova} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Configuração
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
              <div className="p-2.5 rounded-xl bg-gray-100"><Sliders className="w-6 h-6 text-gray-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Editáveis</p><p className="text-2xl font-bold text-emerald-600">{stats.editaveis}</p></div>
              <div className="p-2.5 rounded-xl bg-emerald-50"><Settings className="w-6 h-6 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Somente leitura</p><p className="text-2xl font-bold text-amber-600">{stats.bloqueadas}</p></div>
              <div className="p-2.5 rounded-xl bg-amber-50"><ShieldCheck className="w-6 h-6 text-amber-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Categorias</p><p className="text-2xl font-bold text-blue-600">{stats.categorias}</p></div>
              <div className="p-2.5 rounded-xl bg-blue-50"><Layers className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dica: como a tela funciona */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900">
          Cada configuração é uma <strong>regra que sobrescreve o padrão do sistema</strong>. Enquanto a chave não
          existe, o módulo usa o valor padrão embutido. Use <strong>Nova Configuração</strong> para escolher uma
          regra do catálogo e só preencher o valor — sem decorar nomes.
        </p>
      </div>

      {/* Filtros */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="h-11 pl-9"
                placeholder="Buscar por chave, valor ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="md:w-64">
              <ComboboxBusca
                options={opcoesFiltro}
                value={filtroCategoria}
                onSelect={setFiltroCategoria}
                placeholder="Filtrar por categoria"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Sliders className="w-10 h-10" />
              <p className="text-sm text-gray-500">
                {configs.length === 0 ? 'Nenhuma regra configurada — o sistema está usando os padrões' : 'Nenhuma configuração encontrada com esse filtro'}
              </p>
              {configs.length === 0 && (
                <Button onClick={abrirNova} variant="outline" className="mt-1">
                  <Plus className="w-4 h-4 mr-2" /> Configurar uma regra
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pag.paginatedItems.map((config) => {
                  const cat = catalogoPorChave(config.chave);
                  const bloqueada = config.editavel === false;
                  return (
                    <div key={config.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{cat?.label || config.chave}</p>
                            {!cat && <Badge className="border-0 bg-gray-100 text-gray-500 text-[10px] gap-1"><Wrench className="w-2.5 h-2.5" /> Avançada</Badge>}
                          </div>
                          <p className="text-xs text-gray-400 font-mono">{config.chave}</p>
                        </div>
                        <Badge className={`border-0 flex-shrink-0 ${TIPO_COR[config.tipo] || 'bg-gray-100 text-gray-700'}`}>{config.tipo || '—'}</Badge>
                      </div>
                      <p className="font-mono text-xs text-gray-700 break-all line-clamp-2">{String(config.valor ?? '')}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{labelCategoria(config.categoria)}</span>
                          {bloqueada
                            ? <Badge className="border-0 bg-gray-100 text-gray-500 gap-1"><Lock className="w-3 h-3" /> Bloqueada</Badge>
                            : <Badge className="border-0 bg-emerald-50 text-emerald-700">Editável</Badge>}
                        </div>
                        {!bloqueada && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-blue-600" onClick={() => handleEdit(config)}><Pencil className="w-4 h-4" /> Editar</Button>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-red-600" onClick={() => setExcluir(config)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Configuração</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Categoria</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Acesso</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pag.paginatedItems.map((config) => {
                      const cat = catalogoPorChave(config.chave);
                      return (
                        <tr key={config.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{cat?.label || config.chave}</p>
                              {!cat && <Badge className="border-0 bg-gray-100 text-gray-500 text-[10px] gap-1"><Wrench className="w-2.5 h-2.5" /> Avançada</Badge>}
                            </div>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{config.chave}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-gray-700 line-clamp-2 max-w-[260px] break-all">{String(config.valor ?? '')}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`border-0 ${TIPO_COR[config.tipo] || 'bg-gray-100 text-gray-700'}`}>{config.tipo || '—'}</Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{labelCategoria(config.categoria)}</td>
                          <td className="px-4 py-3 text-center">
                            {config.editavel === false ? (
                              <Badge className="border-0 bg-gray-100 text-gray-500 gap-1"><Lock className="w-3 h-3" /> Bloqueada</Badge>
                            ) : (
                              <Badge className="border-0 bg-emerald-50 text-emerald-700">Editável</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                                      onClick={() => handleEdit(config)}
                                      disabled={config.editavel === false}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{config.editavel === false ? 'Somente leitura' : 'Editar'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
                                      onClick={() => setExcluir(config)}
                                      disabled={config.editavel === false}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{config.editavel === false ? 'Somente leitura' : 'Excluir'}</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={pag.currentPage}
                totalPages={pag.totalPages}
                onPageChange={pag.goToPage}
                startIndex={pag.startIndex}
                endIndex={pag.endIndex}
                totalItems={pag.totalItems}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Editar Configuração' : (modoManual ? 'Nova Configuração (avançado)' : 'Nova Configuração')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CRIAR — guiado: escolher a regra do catálogo */}
            {!editingConfig && !modoManual && (
              <div>
                <Label className="mb-1.5 block">Configuração</Label>
                <ComboboxBusca
                  options={catalogoDisponivel}
                  value={formData.chave}
                  onSelect={escolherDoCatalogo}
                  placeholder={catalogoDisponivel.length ? 'Escolha uma regra...' : 'Todas as regras do catálogo já estão configuradas'}
                  searchPlaceholder="Buscar regra..."
                />
                <button
                  type="button"
                  onClick={() => { setModoManual(true); setFormData(FORM_VAZIO); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline mt-2"
                >
                  Cadastrar chave manual (avançado)
                </button>
              </div>
            )}

            {/* CRIAR — manual/avançado */}
            {!editingConfig && modoManual && (
              <>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Modo avançado: a chave precisa bater <strong>exatamente</strong> com o nome que o código procura.
                    Um nome errado é salvo mas ignorado pelo sistema.
                  </p>
                </div>
                <div>
                  <Label className="mb-1.5 block">Chave *</Label>
                  <Input
                    className="h-11 font-mono"
                    value={formData.chave}
                    onChange={(e) => setFormData({ ...formData, chave: e.target.value })}
                    placeholder="Ex.: ops_outbox_batch_size"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Tipo</Label>
                    <ComboboxBusca options={TIPOS} value={formData.tipo} onSelect={(v) => setFormData({ ...formData, tipo: v })} placeholder="Tipo" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Categoria</Label>
                    <ComboboxBusca options={CATEGORIAS} value={formData.categoria} onSelect={(v) => setFormData({ ...formData, categoria: v })} placeholder="Categoria" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setModoManual(false); setFormData(FORM_VAZIO); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  ← Voltar para o catálogo
                </button>
              </>
            )}

            {/* EDITAR — chave travada */}
            {editingConfig && (
              <div>
                <Label className="mb-1.5 block">Chave</Label>
                <Input className="h-11 font-mono bg-gray-50" value={formData.chave} disabled />
              </div>
            )}

            {/* Ficha do catálogo (descrição, módulo, padrão, formato) */}
            {catSelecionado && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                <p className="text-sm text-gray-700">{catSelecionado.descricao}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span><strong className="text-gray-600">Módulo:</strong> {catSelecionado.modulo}</span>
                  <span><strong className="text-gray-600">Padrão:</strong> <span className="font-mono">{catSelecionado.padrao}</span></span>
                </div>
                {catSelecionado.formato && <p className="text-xs text-gray-500"><strong className="text-gray-600">Formato:</strong> {catSelecionado.formato}</p>}
                {catSelecionado.nota && <p className="text-xs text-blue-700">ℹ {catSelecionado.nota}</p>}
              </div>
            )}

            {/* Campo de valor — só após escolher a chave (ou ao editar) */}
            {mostrarCampos && (
              <div>
                <Label className="mb-1.5 block">Valor *</Label>
                {renderCampoValor()}
              </div>
            )}

            {mostrarCampos && (
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <span className="font-mono font-medium text-gray-900">{excluir?.chave}</span> será removida.
              O módulo que depende dela volta a usar o <strong>valor padrão</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => excluir && deleteMutation.mutate(excluir.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
