import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Upload, Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { createPageUrl } from '@/utils';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { useAdvancedSearch } from '../components/shared/useAdvancedSearch';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import { calcularCompletude } from '../components/obra/obraCompletude';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

const FASE_OPTIONS = [
  { value: 'pre_orcamento', label: 'Pré-Orçamento' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'ativa', label: 'Ativa' },
  { value: 'concluida', label: 'Concluída' }
];
const STATUS_OPTIONS = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'a_iniciar', label: 'A Iniciar' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' }
];

// Detectar IDs Mongo (24-char hex)
const isMongoId = (str) => typeof str === 'string' && /^[a-f0-9]{24}$/i.test(str);

const faseConfig = {
  'pre_orcamento': { label: 'Pré-Orçamento', bg: 'bg-gray-100', text: 'text-gray-800' },
  'orcamento': { label: 'Orçamento', bg: 'bg-blue-100', text: 'text-blue-800' },
  'ativa': { label: 'Ativa', bg: 'bg-green-100', text: 'text-green-800' },
  'concluida': { label: 'Concluída', bg: 'bg-emerald-100', text: 'text-emerald-800' }
};

const statusConfig = {
  'orcamento': { label: 'Orçamento' },
  'a_iniciar': { label: 'A Iniciar' },
  'em_andamento': { label: 'Em Andamento' },
  'pausada': { label: 'Pausada' },
  'concluida': { label: 'Concluída' },
  'cancelada': { label: 'Cancelada' }
};

const fmtData = (d) => (d && !isNaN(new Date(d)) ? new Date(d).toLocaleDateString('pt-BR') : null);

function ObrasContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const search = useAdvancedSearch('obras');
  const { membros, acessoGlobal } = useEmpresa();

  // Buscar clientes para resolver IDs brutos
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-lookup'],
    queryFn: () => base44.entities.Cliente.list('-created_date', 500),
    staleTime: 300000
  });

  const clienteMap = useMemo(() => {
    const map = {};
    clientes.forEach((c) => {map[c.id] = c.nome || c.razao_social || '';});
    return map;
  }, [clientes]);

  // Config dos filtros. Cliente é combobox com a lista real de clientes; o valor
  // selecionado é o NOME (a obra normaliza `cliente` para o nome resolvido, então
  // o filtro por "contém o nome" funciona direto).
  const filterConfig = useMemo(() => {
    const clienteOptions = [...new Map(
      clientes
        .map((c) => c.nome || c.razao_social || '')
        .filter(Boolean)
        .map((nome) => [nome.toLowerCase(), { value: nome, label: nome }])
    ).values()].sort((a, b) => a.label.localeCompare(b.label));

    // Empresa só faz sentido para quem enxerga mais de uma (global/matriz);
    // a Matriz nunca é dona de obra, então listamos apenas as empresas-membro.
    const empresaOptions = (membros || [])
      .map((e) => ({ value: e.id, label: e.nome || e.razao_social || 'Empresa' }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [
      ...(acessoGlobal && empresaOptions.length
        ? [{ key: 'empresa_id', label: 'Empresa', type: 'combobox', placeholder: 'Selecione a empresa...', searchPlaceholder: 'Buscar empresa...', emptyMessage: 'Nenhuma empresa.', options: empresaOptions }]
        : []),
      { key: 'nome', label: 'Nome da Obra', type: 'text', placeholder: 'Digite o nome...' },
      { key: 'cliente', label: 'Cliente', type: 'combobox', placeholder: 'Selecione o cliente...', searchPlaceholder: 'Buscar cliente...', emptyMessage: 'Nenhum cliente.', options: clienteOptions },
      { key: 'fase', label: 'Fase', type: 'select', options: FASE_OPTIONS },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS }
    ];
  }, [clientes, membros, acessoGlobal]);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras'], // key consistente — invalidada por salvar/modal
    queryFn: async () => {
      const result = await base44.entities.Obra.list('-updated_date', 200);
      return result;
    },
    staleTime: 30000,
    gcTime: 60000,
    placeholderData: (prev) => prev
  });

  // Buscar BMs para verificar obras ativas sem medição
  const { data: allBMs = [] } = useQuery({
    queryKey: ['bms-obras-check'],
    queryFn: () => base44.entities.BM.list('-created_date', 5000),
    staleTime: 60000
  });

  const obrasComBM = useMemo(() => {
    const set = new Set();
    allBMs.forEach((bm) => { if (bm.obra_id) set.add(bm.obra_id); });
    return set;
  }, [allBMs]);

  // Helper local: normaliza campos para exibição
  const normalizeCard = (o) => {
    const nome = o.nome || o.titulo || '';
    const cliente = o.cliente_nome || o.contratante_nome || (
    o.cliente && !isMongoId(o.cliente) ? o.cliente : '') ||
    clienteMap[o.cliente_id] || clienteMap[o.cliente] || '';
    const cidade = o.cidade || o.cidade_nome || '';
    const uf = o.uf || o.estado || '';
    const logradouro = o.logradouro || o.rua || o.endereco || '';
    const numero = o.numero || '';
    const bairro = o.bairro || '';
    const enderecoDisplay = logradouro ?
    `${logradouro}${numero ? ', ' + numero : ''}${bairro ? ' - ' + bairro : ''}` :
    '';
    const localDisplay = cidade || uf ? `${cidade}${uf ? '/' + uf : ''}` : '';
    const responsavel = o.responsavel_tecnico_nome || o.responsavel_tecnico || '';
    return { ...o, nome, cliente, cidade, uf, logradouro, numero, bairro, enderecoDisplay, localDisplay, responsavel };
  };

  // NUNCA mutar o array original — usar spread antes de qualquer operação
  const obrasNormalizadas = useMemo(() => {
    return Array.isArray(obras) ? obras.map(normalizeCard) : [];
  }, [obras, clienteMap]);

  // Filtro por texto + filtros simples.
  const obrasFiltradas = useMemo(() => {
    let result = [...obrasNormalizadas];

    const cleanFilters = search.getCleanFilters();
    Object.entries(cleanFilters).forEach(([key, value]) => {
      if (key === 'orcamento_min' && value) {
        result = result.filter((o) => (o.total_final_orcamento || 0) >= parseFloat(value));
      } else if (value) {
        result = result.filter((o) => {
          const fieldValue = String(o[key] || '').toLowerCase();
          return fieldValue.includes(String(value).toLowerCase());
        });
      }
    });

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      result = result.filter((o) =>
      o.nome?.toLowerCase().includes(searchLower) ||
      o.cliente?.toLowerCase().includes(searchLower) ||
      o.codigo?.toLowerCase().includes(searchLower) ||
      o.enderecoDisplay?.toLowerCase().includes(searchLower) ||
      o.localDisplay?.toLowerCase().includes(searchLower)
      );
    }

    const sortField = search.sortBy || 'updated_date';
    result = [...result].sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      if (typeof aVal === 'number') {
        return search.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return search.sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [obrasNormalizadas, search.filters, search.sortBy, search.sortOrder, searchText]);

  // Paginação (padrão do sistema) + reset para a 1ª página quando os filtros mudam.
  const pag = usePagination(obrasFiltradas, 15);
  const filtroSig = JSON.stringify({
    s: searchText,
    f: search.getCleanFilters ? search.getCleanFilters() : {}
  });
  useEffect(() => { pag.goToPage(1); }, [filtroSig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Obras</h1>
          <p className="text-gray-500 mt-1 text-sm">Acompanhamento de todos os projetos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => navigate(createPageUrl('ObraForm'))}
            className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none">

            <Plus className="w-4 h-4 mr-2" />
            Nova Obra
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('ImportarOrcaFacil'))}
            variant="outline"
            className="flex-1 sm:flex-none">

            <Upload className="w-4 h-4 mr-2" />
            Importar OrçaFascio
          </Button>
        </div>
      </div>

      {/* Busca + Filtros unificados num único card */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
          <Button
            onClick={() => setShowFilterPanel((v) => !v)}
            variant={Object.keys(search.getCleanFilters()).length > 0 ? 'default' : 'outline'}
            className={`h-11 ${Object.keys(search.getCleanFilters()).length > 0 ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {Object.keys(search.getCleanFilters()).length > 0 && (
              <span className="ml-2 bg-white text-blue-600 rounded-full px-1.5 text-xs font-bold">●</span>
            )}
          </Button>
        </div>

        {showFilterPanel && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filterConfig.map((cfg) => (
                <div key={cfg.key} className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">{cfg.label}</label>
                  {cfg.type === 'text' && (
                    <Input
                      className="h-11"
                      placeholder={cfg.placeholder || 'Digite...'}
                      value={search.filters[cfg.key] || ''}
                      onChange={(e) => search.applyFilter(cfg.key, e.target.value)}
                    />
                  )}
                  {cfg.type === 'combobox' && (
                    <ComboboxBusca
                      options={cfg.options || []}
                      value={search.filters[cfg.key] || ''}
                      onSelect={(v) => search.applyFilter(cfg.key, v)}
                      placeholder={cfg.placeholder || 'Selecione...'}
                      searchPlaceholder={cfg.searchPlaceholder || 'Buscar...'}
                      emptyMessage={cfg.emptyMessage || 'Nada encontrado.'}
                    />
                  )}
                  {cfg.type === 'select' && (
                    <Select
                      value={search.filters[cfg.key] || ''}
                      onValueChange={(v) => search.applyFilter(cfg.key, v === '__all__' ? '' : v)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={cfg.placeholder || 'Selecione...'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos</SelectItem>
                        {(cfg.options || []).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" className="h-10" onClick={search.clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Obras */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={8} cols={7} />
          ) : obrasFiltradas.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              Nenhuma obra encontrada
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pag.paginatedItems.map((obra) => {
                  const statusInfo = statusConfig[obra.status] || { label: obra.status || '—' };
                  const semOrcamento = !obra.total_orcamento || obra.total_orcamento === 0;
                  const irParaObra = () => navigate(createPageUrl(`ObraDetalhes?id=${obra.id}`));
                  return (
                    <div
                      key={obra.id}
                      onClick={irParaObra}
                      className="p-3 rounded-lg border border-gray-200 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{obra.nome || 'Sem nome'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {obra.cliente || 'Cliente não informado'}
                          </p>
                        </div>
                        <Badge className={`border-0 shrink-0 ${obra.status === 'concluida' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className={`text-sm font-semibold ${semOrcamento ? 'text-amber-600' : 'text-gray-900'}`}>
                          Orçamento: R$ {(obra.total_orcamento || 0).toLocaleString('pt-BR')}
                        </div>
                        {obra.valor_contrato > 0 && (
                          <div className="text-xs text-gray-500">
                            Contrato: R$ {obra.valor_contrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orçamento</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Contrato</th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500">Término est.</th>
                      <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500">Pendências</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pag.paginatedItems.map((obra) => {
                      const statusInfo = statusConfig[obra.status] || { label: obra.status || '—' };
                      const faseInfo = faseConfig[obra.fase] || { label: obra.fase, bg: 'bg-gray-100', text: 'text-gray-800' };
                      const semOrcamento = !obra.total_orcamento || obra.total_orcamento === 0;
                      const faltaMedicao = (['em_andamento', 'EM_ANDAMENTO', 'ativa'].includes(obra.status) || obra.fase === 'ativa') && !obrasComBM.has(obra.id);
                      const comp = calcularCompletude(obra);
                      const irParaObra = () => navigate(createPageUrl(`ObraDetalhes?id=${obra.id}`));

                      const terminoStr = fmtData(obra.data_prevista_fim);
                      let terminoBadge = null;
                      if (obra.data_prevista_fim && obra.fase !== 'pre_orcamento') {
                        const atrasada = new Date() > new Date(obra.data_prevista_fim) && obra.status !== 'concluida';
                        terminoBadge = (
                          <Badge className={`border-0 ml-2 ${atrasada ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {atrasada ? 'Atrasada' : 'Em dia'}
                          </Badge>
                        );
                      }

                      return (
                        <tr key={obra.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={irParaObra}>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{obra.nome || 'Sem nome'}</span>
                              {obra.fase === 'pre_orcamento' && <Badge className={`border-0 ${faseInfo.bg} ${faseInfo.text}`}>{faseInfo.label}</Badge>}
                            </div>
                            {(obra.enderecoDisplay || obra.localDisplay) && (
                              <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
                                {[obra.enderecoDisplay, obra.localDisplay].filter(Boolean).join(' — ')}
                              </p>
                            )}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-gray-700 align-top">
                            {obra.cliente || <span className="text-amber-500 italic">Não informado</span>}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Badge className={`border-0 w-32 justify-center whitespace-nowrap ${obra.status === 'concluida' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap align-top ${semOrcamento ? 'text-amber-600' : 'text-gray-900'}`}>
                            R$ {(obra.total_orcamento || 0).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                            {obra.valor_contrato > 0
                              ? <span className="font-semibold text-gray-900">R$ {obra.valor_contrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-gray-700 whitespace-nowrap align-top">
                            {terminoStr || <span className="text-amber-500">Pendente</span>}
                            {terminoBadge}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {semOrcamento && <Badge className="border-0 bg-red-100 text-red-700">Sem orçamento</Badge>}
                              {faltaMedicao && <Badge className="border-0 bg-orange-100 text-orange-700">Falta medição PO</Badge>}
                              {!comp.completa && <Badge className="border-0 bg-amber-100 text-amber-700">Cadastro {comp.percent}%</Badge>}
                              {!semOrcamento && !faltaMedicao && comp.completa && <span className="text-gray-400">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right align-top">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); irParaObra(); }}>
                              Acessar
                            </Button>
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
    </div>);

}

// Wrap with RouteGuard - FAIL-CLOSED (OBRAS_VIEW required)
export default function Obras() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="OBRAS_VIEW">
      <ObrasContent />
    </RouteGuardFinalV2>);

}
