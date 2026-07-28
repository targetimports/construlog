import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Filter, Download, Receipt, Users, Package, Utensils, 
  Truck, Building2, FileText, TrendingDown, TrendingUp, DollarSign,
  Calendar, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ListSkeleton } from '@/components/shared/Skeletons';

const CATEGORIAS = [
  { value: 'folha_pagamento', label: 'Folha de Pagamento (Mensal)', icon: Users, page: 'Colaboradores', entity: 'LancamentoFolhaPagamento' },
  { value: 'nota_fiscal', label: 'Notas Fiscais', icon: Receipt, page: 'ObraNotasFiscais', entity: 'NotaFiscal' },
  { value: 'mao_obra', label: 'Mão de Obra', icon: Users, page: 'ObraMaoDeObra', entity: 'MaoDeObra' },
  { value: 'material', label: 'Material', icon: Package, page: 'ObraMaterial', entity: 'Material' },
  { value: 'alimentacao', label: 'Alimentação', icon: Utensils, page: 'ObraAlimentacao', entity: 'Alimentacao' },
  { value: 'aluguel', label: 'Aluguel/Combustível', icon: Truck, page: 'ObraAluguelCombustivel', entity: 'AluguelEquipamento' },
  { value: 'frete', label: 'Fretes', icon: Truck, page: 'ObraFretes', entity: 'Frete' },
  { value: 'estadia', label: 'Estadias', icon: Building2, page: 'ObraEstadias', entity: 'Estadia' },
  { value: 'imposto', label: 'Impostos', icon: FileText, page: 'ObraImpostos', entity: 'Imposto' },
  { value: 'retirada', label: 'Retiradas', icon: TrendingDown, page: 'ObraRetiradas', entity: 'Retirada' },
  { value: 'pessoa', label: 'Pessoas', icon: Users, page: 'ObraPessoas', entity: 'Pessoa' }
];

export default function Lancamentos({ embedded = false }) {
  if (embedded) return <LancamentosContent />;
  return (
    <RouteGuardFinalV2 requiredPermissionKey="FINANCEIRO_VIEW">
      <LancamentosContent />
    </RouteGuardFinalV2>
  );
}

function LancamentosContent() {
  const [categoriaAtiva, setCategoriaAtiva] = useState('todas');
  const [filtros, setFiltros] = useState({
    obra_id: 'todas',
    tipo: 'todas',
    periodo_inicio: '',
    periodo_fim: '',
    status: 'todas'
  });
  const [dialogNovoLancamento, setDialogNovoLancamento] = useState(false);
  const [novoLancamento, setNovoLancamento] = useState({
    categoria: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    descricao: '',
    obra_id: '',
    fornecedor_cliente: '',
    forma_pagamento: 'pix'
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 100)
  });

  // Buscar lançamentos de todas as categorias
  const { data: notasFiscais = [], isLoading: loadingNF } = useQuery({
    queryKey: ['notas-fiscais', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.NotaFiscal.list('-data', 100)
      : base44.entities.NotaFiscal.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'nota_fiscal'
  });

  const { data: maoObra = [], isLoading: loadingMO } = useQuery({
    queryKey: ['mao-obra', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.MaoDeObra.list('-data', 100)
      : base44.entities.MaoDeObra.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'mao_obra'
  });

  const { data: materiais = [], isLoading: loadingMat } = useQuery({
    queryKey: ['materiais', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Material.list('-data', 100)
      : base44.entities.Material.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'material'
  });

  const { data: alimentacao = [], isLoading: loadingAlim } = useQuery({
    queryKey: ['alimentacao', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Alimentacao.list('-data', 100)
      : base44.entities.Alimentacao.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'alimentacao'
  });

  const { data: fretes = [], isLoading: loadingFrete } = useQuery({
    queryKey: ['fretes', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Frete.list('-data', 100)
      : base44.entities.Frete.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'frete'
  });

  const { data: estadias = [], isLoading: loadingEst } = useQuery({
    queryKey: ['estadias', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Estadia.list('-data', 100)
      : base44.entities.Estadia.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'estadia'
  });

  const { data: alugueis = [], isLoading: loadingAlug } = useQuery({
    queryKey: ['alugueis', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.AluguelEquipamento.list('-data', 100)
      : base44.entities.AluguelEquipamento.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'aluguel'
  });

  const { data: impostos = [], isLoading: loadingImp } = useQuery({
    queryKey: ['impostos', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Imposto.list('-data', 100)
      : base44.entities.Imposto.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'imposto'
  });

  const { data: retiradas = [], isLoading: loadingRet } = useQuery({
    queryKey: ['retiradas', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Retirada.list('-data', 100)
      : base44.entities.Retirada.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'retirada'
  });

  const { data: pessoas = [], isLoading: loadingPes } = useQuery({
    queryKey: ['pessoas', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.Pessoa.list('-created_date', 100)
      : base44.entities.Pessoa.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'pessoa'
  });

  const { data: folhaPagamento = [], isLoading: loadingFolha } = useQuery({
    queryKey: ['folha-pagamento', filtros.obra_id],
    queryFn: () => filtros.obra_id === 'todas' 
      ? base44.entities.LancamentoFolhaPagamento.list('-created_date', 100)
      : base44.entities.LancamentoFolhaPagamento.filter({ obra_id: filtros.obra_id }),
    enabled: categoriaAtiva === 'todas' || categoriaAtiva === 'folha_pagamento'
  });

  // Consolidar todos os lançamentos
  const todosLancamentos = [
    ...folhaPagamento.map(fp => ({ ...fp, _categoria: 'folha_pagamento', _tipo: 'despesa' })),
    ...notasFiscais.map(nf => ({ ...nf, _categoria: 'nota_fiscal', _tipo: 'despesa' })),
    ...maoObra.map(mo => ({ ...mo, _categoria: 'mao_obra', _tipo: 'despesa' })),
    ...materiais.map(mat => ({ ...mat, _categoria: 'material', _tipo: 'despesa' })),
    ...alimentacao.map(ali => ({ ...ali, _categoria: 'alimentacao', _tipo: 'despesa' })),
    ...fretes.map(frt => ({ ...frt, _categoria: 'frete', _tipo: 'despesa' })),
    ...estadias.map(est => ({ ...est, _categoria: 'estadia', _tipo: 'despesa' })),
    ...alugueis.map(alug => ({ ...alug, _categoria: 'aluguel', _tipo: 'despesa' })),
    ...impostos.map(imp => ({ ...imp, _categoria: 'imposto', _tipo: 'despesa' })),
    ...retiradas.map(ret => ({ ...ret, _categoria: 'retirada', _tipo: 'despesa' })),
    ...pessoas.map(pes => ({ ...pes, _categoria: 'pessoa', _tipo: 'despesa' }))
  ].sort((a, b) => new Date(b.data || b.created_date) - new Date(a.data || a.created_date));

  const lancamentosFiltrados = todosLancamentos.filter(lanc => {
    if (categoriaAtiva !== 'todas' && lanc._categoria !== categoriaAtiva) return false;
    if (filtros.tipo !== 'todas' && lanc._tipo !== filtros.tipo) return false;
    return true;
  });

  const totalDespesas = lancamentosFiltrados
    .filter(l => l._tipo === 'despesa')
    .reduce((acc, l) => acc + (l.valor_total || l.valor || 0), 0);

  const isLoading = loadingFolha || loadingNF || loadingMO || loadingMat || loadingAlim || loadingFrete || loadingEst || loadingAlug || loadingImp || loadingRet || loadingPes;

  const getCategoriaConfig = (categoria) => CATEGORIAS.find(c => c.value === categoria);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lançamentos Financeiros</h1>
          <p className="text-gray-600 mt-1">Central de gastos e receitas por categoria</p>
        </div>
        <Button onClick={() => setDialogNovoLancamento(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Lançamentos</CardTitle>
            <FileText className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{lancamentosFiltrados.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Despesas</CardTitle>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Categorias Ativas</CardTitle>
            <Filter className="w-5 h-5 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {categoriaAtiva === 'todas' ? CATEGORIAS.length : 1}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Obra</Label>
              <Select value={filtros.obra_id} onValueChange={(value) => setFiltros({ ...filtros, obra_id: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filtros.tipo} onValueChange={(value) => setFiltros({ ...filtros, tipo: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input 
                type="date" 
                value={filtros.periodo_inicio}
                onChange={(e) => setFiltros({ ...filtros, periodo_inicio: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input 
                type="date" 
                value={filtros.periodo_fim}
                onChange={(e) => setFiltros({ ...filtros, periodo_fim: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Categorias */}
      <Tabs value={categoriaAtiva} onValueChange={setCategoriaAtiva}>
        <TabsList className="flex flex-wrap gap-2 bg-white p-2 border rounded-lg h-auto">
          <TabsTrigger value="todas" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Todas
          </TabsTrigger>
          {CATEGORIAS.map(cat => {
            const Icon = cat.icon;
            return (
              <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {cat.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="todas" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Todos os Lançamentos ({lancamentosFiltrados.length})</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={6} />
              ) : lancamentosFiltrados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Nenhum lançamento encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lancamentosFiltrados.map((lanc, idx) => {
                    const catConfig = getCategoriaConfig(lanc._categoria);
                    const Icon = catConfig?.icon || FileText;
                    return (
                      <div key={`${lanc._categoria}-${lanc.id}`} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3 flex-1">
                         <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                           <Icon className="w-5 h-5 text-blue-600" />
                         </div>
                         <div className="flex-1">
                           <p className="font-medium text-gray-900">
                             {lanc._categoria === 'folha_pagamento' 
                               ? `${lanc.nome_colaborador} - ${lanc.cargo}` 
                               : (lanc.descricao || lanc.descricao_material || catConfig?.label)}
                           </p>
                           <div className="flex items-center gap-2 text-sm text-gray-600">
                             <Badge variant="outline" className="text-xs">{catConfig?.label}</Badge>
                             {lanc._categoria === 'folha_pagamento' && lanc.competencia && (
                               <span className="flex items-center gap-1">
                                 <Calendar className="w-3 h-3" />
                                 {lanc.competencia}
                               </span>
                             )}
                             {lanc.data && (
                               <span className="flex items-center gap-1">
                                 <Calendar className="w-3 h-3" />
                                 {format(new Date(lanc.data), 'dd/MM/yyyy', { locale: ptBR })}
                               </span>
                             )}
                           </div>
                         </div>
                        </div>
                        <div className="text-right">
                         <p className="font-bold text-gray-900">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                             lanc._categoria === 'folha_pagamento' ? lanc.custo_total_mensal : (lanc.valor_total || lanc.valor || 0)
                           )}
                         </p>
                         {lanc._categoria === 'folha_pagamento' && (
                           <span className="text-xs text-gray-500">Mensal</span>
                         )}
                         <Link to={`/${catConfig?.page}`} className="text-xs text-blue-600 hover:underline block mt-1">
                           Ver detalhes →
                         </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {CATEGORIAS.map(cat => {
          const Icon = cat.icon;
          const dadosCategoria = {
            folha_pagamento: folhaPagamento,
            nota_fiscal: notasFiscais,
            mao_obra: maoObra,
            material: materiais,
            alimentacao: alimentacao,
            frete: fretes,
            estadia: estadias,
            aluguel: alugueis,
            imposto: impostos,
            retirada: retiradas,
            pessoa: pessoas
          }[cat.value] || [];

          return (
            <TabsContent key={cat.value} value={cat.value} className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {cat.label} ({dadosCategoria.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Link to={`/${cat.page}`}>
                        <Button variant="outline" size="sm">
                          Ver Tela Completa →
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dadosCategoria.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Icon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>Nenhum lançamento de {cat.label}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dadosCategoria.slice(0, 10).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900">
                              {cat.value === 'folha_pagamento' 
                                ? `${item.nome_colaborador} - ${item.cargo}` 
                                : (item.descricao || item.descricao_material || item.nome || 'Sem descrição')}
                            </p>
                            <p className="text-sm text-gray-600">
                              {cat.value === 'folha_pagamento' && item.competencia 
                                ? `Competência: ${item.competencia}`
                                : (item.data && format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR }))}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                cat.value === 'folha_pagamento' ? item.custo_total_mensal : (item.valor_total || item.valor || 0)
                              )}
                            </p>
                            {cat.value === 'folha_pagamento' && (
                              <span className="text-xs text-gray-500">Mensal</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {dadosCategoria.length > 10 && (
                        <p className="text-center text-sm text-gray-500 py-2">
                          + {dadosCategoria.length - 10} lançamentos (
                          <Link to={`/${cat.page}`} className="text-blue-600 hover:underline">
                            ver todos
                          </Link>
                          )
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Dialog Novo Lançamento */}
      <Dialog open={dialogNovoLancamento} onOpenChange={setDialogNovoLancamento}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select 
                value={novoLancamento.categoria}
                onValueChange={(value) => setNovoLancamento({ ...novoLancamento, categoria: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="0,00"
                  value={novoLancamento.valor}
                  onChange={(e) => setNovoLancamento({ ...novoLancamento, valor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input 
                  type="date"
                  value={novoLancamento.data}
                  onChange={(e) => setNovoLancamento({ ...novoLancamento, data: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input 
                placeholder="Descrição do lançamento"
                value={novoLancamento.descricao}
                onChange={(e) => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select 
                value={novoLancamento.obra_id}
                onValueChange={(value) => setNovoLancamento({ ...novoLancamento, obra_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor/Cliente</Label>
                <Input 
                  placeholder="Nome"
                  value={novoLancamento.fornecedor_cliente}
                  onChange={(e) => setNovoLancamento({ ...novoLancamento, fornecedor_cliente: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select 
                  value={novoLancamento.forma_pagamento}
                  onValueChange={(value) => setNovoLancamento({ ...novoLancamento, forma_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Este formulário simplificado cria o lançamento. Para edições completas, acesse a tela específica da categoria.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovoLancamento(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                if (!novoLancamento.categoria || !novoLancamento.valor || !novoLancamento.obra_id) {
                  toast.error('Preencha os campos obrigatórios');
                  return;
                }
                
                const catConfig = getCategoriaConfig(novoLancamento.categoria);
                if (!catConfig) {
                  toast.error('Categoria inválida');
                  return;
                }

                try {
                  const dataToCreate = {
                    descricao: novoLancamento.descricao,
                    valor_total: parseFloat(novoLancamento.valor),
                    data: novoLancamento.data,
                    obra_id: novoLancamento.obra_id,
                    fornecedor: novoLancamento.fornecedor_cliente,
                    forma_pagamento: novoLancamento.forma_pagamento
                  };

                  await base44.entities[catConfig.entity].create(dataToCreate);
                  toast.success('Lançamento criado com sucesso!');
                  setDialogNovoLancamento(false);
                  setNovoLancamento({
                    categoria: '',
                    valor: '',
                    data: format(new Date(), 'yyyy-MM-dd'),
                    descricao: '',
                    obra_id: '',
                    fornecedor_cliente: '',
                    forma_pagamento: 'pix'
                  });
                } catch (error) {
                  toast.error('Erro ao criar lançamento: ' + error.message);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}