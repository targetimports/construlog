import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Users, Trash2, Pencil, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import FormIntegrado from '../components/colaboradores/FormIntegrado';
import { ROLE_BY_VALUE } from '@/components/shared/roles';
import { criarAcessoColaborador, EMAIL_RE } from '@/components/shared/acessoColaborador';
import { UserPlus } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeletons';

const POR_PAGINA = 20;

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  ferias: { label: 'Férias', color: 'bg-blue-100 text-blue-700' },
  afastado: { label: 'Afastado', color: 'bg-amber-100 text-amber-700' },
  desligado: { label: 'Desligado', color: 'bg-red-100 text-red-700' },
};

const iniciais = (nome) => (nome || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';

export default function Colaboradores() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="RH_VIEW">
      <ColaboradoresContent />
    </RouteGuardFinalV2>
  );
}

function ColaboradoresContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [empresaFilter, setEmpresaFilter] = useState('todos');
  const [cargoFilter, setCargoFilter] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState(null);
  const [colaboradorToDelete, setColaboradorToDelete] = useState(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    cargo: '',
    departamento: 'producao',
    status: 'ativo',
    data_admissao: '',
    salario: '',
    telefone: '',
    email: '',
    endereco: '',
    user_email: '',
    user_role: 'user',
    empresa_id: '',
    obra_atual: '',
    obras_vinculadas: []
  });

  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 200)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 100)
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => [])
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list('-created_date', 2000).catch(() => []),
  });

  // Sincroniza acessos: cria usuário para todo colaborador com email que ainda não é usuário.
  const sincronizarAcessos = useMutation({
    mutationFn: async () => {
      const usuariosPorEmail = new Set(usuarios.map((u) => (u.email || '').toLowerCase()));
      const res = { criado: 0, ja_existe: 0, sem_email: 0, cpf_invalido: 0, erro: 0 };
      for (const col of colaboradores) {
        if (col.status === 'desligado') continue;
        try {
          const r = await criarAcessoColaborador(col, usuariosPorEmail);
          res[r.status] = (res[r.status] || 0) + 1;
          if (r.status === 'criado') usuariosPorEmail.add((col.email || '').toLowerCase());
        } catch { res.erro += 1; }
      }
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      const partes = [`${res.criado} criado(s)`];
      if (res.ja_existe) partes.push(`${res.ja_existe} já tinham acesso`);
      if (res.sem_email) partes.push(`${res.sem_email} sem email (ignorados)`);
      if (res.cpf_invalido) partes.push(`${res.cpf_invalido} sem CPF`);
      toast.success('Acessos sincronizados: ' + partes.join(' · '));
    },
    onError: (e) => toast.error('Erro ao sincronizar acessos: ' + e.message),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Colaborador.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador cadastrado com sucesso!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar colaborador: ' + (error?.message || 'Tente novamente'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Colaborador.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador atualizado com sucesso!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar colaborador: ' + (error?.message || 'Tente novamente'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Colaborador.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador removido!');
      setDeleteDialogOpen(false);
      setColaboradorToDelete(null);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      cargo: '',
      departamento: 'producao',
      status: 'ativo',
      data_admissao: '',
      salario: '',
      telefone: '',
      email: '',
      endereco: '',
      user_email: '',
      user_role: 'user',
      empresa_id: '',
      obra_atual: '',
      obras_vinculadas: []
    });
    setEditingColaborador(null);
  };

  const handleEdit = (colaborador) => {
    setEditingColaborador(colaborador);
    setFormData({
      nome: colaborador.nome || '',
      cpf: colaborador.cpf || '',
      cargo: colaborador.cargo || '',
      departamento: colaborador.departamento || 'producao',
      status: colaborador.status || 'ativo',
      data_admissao: colaborador.data_admissao || '',
      salario: colaborador.salario || '',
      telefone: colaborador.telefone || '',
      email: colaborador.email || '',
      endereco: colaborador.endereco || '',
      user_email: colaborador.user_email || '',
      user_role: colaborador.user_role || 'user',
      empresa_id: colaborador.empresa_id || '',
      obra_atual: colaborador.obra_atual || '',
      obras_vinculadas: colaborador.obras_vinculadas || [],
      equipes_vinculadas: colaborador.equipes_vinculadas || [],
      remuneracao: colaborador.remuneracao || {}
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.cpf.trim() || !formData.cargo.trim()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    // Calcular custo total antes de salvar
    const rem = formData.remuneracao || {};
    const salarioBase = Number(rem.salario_base_mensal || 0);
    const bonificacao = Number(rem.bonificacao_mensal || 0);
    const fgts = Number(rem.fgts_calculado || 0);
    const inssPat = Number(rem.inss_patronal_calculado || 0);
    const beneficios = Number(rem.beneficios_total_empresa || 0);
    const extras = Number(rem.custos_extras_total_empresa || 0);
    
    const custoTotalMensal = salarioBase + bonificacao + fgts + inssPat + beneficios + extras;

    const dataToSubmit = {
      ...formData,
      salario: formData.salario ? Number(formData.salario) : null,
      remuneracao: {
        ...rem,
        salario_bruto: salarioBase + bonificacao,
        total_encargos_empresa: fgts + inssPat,
        custo_total_mensal_empresa: custoTotalMensal
      }
    };

    try {
      let colaboradorId = editingColaborador?.id;
      
      if (editingColaborador) {
        await updateMutation.mutateAsync({ id: editingColaborador.id, data: dataToSubmit });
        // Sincroniza o e-mail de ACESSO (login do usuário) se o e-mail do colaborador mudou.
        const novoEmail = (dataToSubmit.email || '').toLowerCase().trim();
        const emailAcesso = (editingColaborador.user_email || '').toLowerCase().trim();
        if (emailAcesso && novoEmail && novoEmail !== emailAcesso && EMAIL_RE.test(novoEmail)) {
          const u = usuarios.find((x) => (x.email || '').toLowerCase() === emailAcesso);
          if (u) {
            try {
              await base44.entities.User.update(u.id, { email: novoEmail });
              await base44.entities.Colaborador.update(editingColaborador.id, { user_email: novoEmail });
              queryClient.invalidateQueries({ queryKey: ['usuarios'] });
              queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
              toast.success('E-mail de acesso (login) atualizado também.');
            } catch (err) {
              toast.error('Colaborador salvo, mas não consegui trocar o e-mail de acesso: ' + (err?.message || 'talvez já exista um usuário com esse e-mail.'));
            }
          }
        } else if (!emailAcesso && EMAIL_RE.test(novoEmail)) {
          // Não tinha acesso e agora tem e-mail válido → tenta criar (idempotente, senha=CPF).
          const emailsUsuarios = new Set(usuarios.map((x) => (x.email || '').toLowerCase()));
          try {
            const r = await criarAcessoColaborador({ ...dataToSubmit, id: editingColaborador.id }, emailsUsuarios);
            if (r.status === 'criado') {
              queryClient.invalidateQueries({ queryKey: ['usuarios'] });
              toast.success('Acesso de usuário criado (senha inicial = CPF).');
            } else if (r.status === 'cpf_invalido') {
              toast.warning('Colaborador salvo, mas sem acesso: informe o CPF para gerar o login.');
            }
          } catch (err) { toast.error('Colaborador salvo, mas falhou criar o acesso: ' + err.message); }
        }
      } else {
        const result = await createMutation.mutateAsync(dataToSubmit);
        colaboradorId = result.id;
        // Cria automaticamente o acesso (usuário) se o colaborador tiver email
        if (EMAIL_RE.test((dataToSubmit.email || '').toLowerCase())) {
          const emailsUsuarios = new Set(usuarios.map((u) => (u.email || '').toLowerCase()));
          try {
            const r = await criarAcessoColaborador({ ...dataToSubmit, id: colaboradorId }, emailsUsuarios);
            if (r.status === 'criado') {
              queryClient.invalidateQueries({ queryKey: ['usuarios'] });
              toast.success('Acesso de usuário criado (senha inicial = CPF).');
            } else if (r.status === 'cpf_invalido') {
              toast.warning('Colaborador salvo, mas sem acesso: informe o CPF para gerar o login.');
            }
          } catch (err) { toast.error('Colaborador salvo, mas falhou criar o acesso: ' + err.message); }
        } else {
          // Sem e-mail válido → colaborador fica sem login (regra: todo colaborador deve ser usuário).
          toast.warning('Colaborador salvo sem acesso: informe um e-mail válido para gerar o login.');
        }
      }

      // Criar lançamento financeiro se tiver custo mensal
      if (custoTotalMensal > 0 && colaboradorId) {
        const competencia = new Date().toISOString().slice(0, 7);
        await base44.entities.LancamentoFolhaPagamento.create({
          colaborador_id: colaboradorId,
          nome_colaborador: formData.nome,
          cargo: formData.cargo,
          custo_total_mensal: custoTotalMensal,
          competencia: competencia,
          obra_id: formData.obra_atual || null
        });
      }
    } catch (error) {
      toast.error('Erro: ' + (error?.message || 'Tente novamente'));
    }
  };

  const filteredColaboradores = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return colaboradores.filter(c => {
      const matchSearch = !q || c.nome?.toLowerCase().includes(q) ||
                         c.cargo?.toLowerCase().includes(q) ||
                         (c.cpf || '').includes(searchTerm);
      const matchStatus = statusFilter === 'todos' || (c.status || 'ativo') === statusFilter;
      const matchEmpresa = empresaFilter === 'todos' ||
                         (empresaFilter === '__none' ? !c.empresa_id : c.empresa_id === empresaFilter);
      const matchCargo = cargoFilter === 'todos' || c.cargo === cargoFilter;
      return matchSearch && matchStatus && matchEmpresa && matchCargo;
    });
  }, [colaboradores, searchTerm, statusFilter, empresaFilter, cargoFilter]);

  // Opções dinâmicas dos filtros (dados reais).
  const empresaNome = (id) => {
    const e = empresas.find((x) => x.id === id);
    return e?.nome || e?.nome_fantasia || e?.razao_social || null;
  };
  const empresaOptions = useMemo(() => {
    const ids = [...new Set(colaboradores.map((c) => c.empresa_id).filter(Boolean))];
    const opts = ids.map((id) => ({ value: id, label: empresaNome(id) || 'Empresa' })).sort((a, b) => a.label.localeCompare(b.label));
    const temSemEmpresa = colaboradores.some((c) => !c.empresa_id);
    return [
      { value: 'todos', label: 'Todas as empresas' },
      ...opts,
      ...(temSemEmpresa ? [{ value: '__none', label: 'Sem empresa (Matriz)' }] : []),
    ];
  }, [colaboradores, empresas]);
  const cargoOptions = useMemo(() => {
    const cargos = [...new Set(colaboradores.map((c) => c.cargo).filter(Boolean))].sort();
    return [{ value: 'todos', label: 'Todas as funções' }, ...cargos.map((c) => ({ value: c, label: c }))];
  }, [colaboradores]);

  const ativos = colaboradores.filter(c => c.status === 'ativo').length;
  const emailsUsuariosSet = useMemo(() => new Set(usuarios.map((u) => (u.email || '').toLowerCase())), [usuarios]);

  const {
    paginatedItems: pageItens,
    currentPage, totalPages, goToPage, startIndex, endIndex, totalItems,
  } = usePagination(filteredColaboradores, POR_PAGINA);
  const temFiltro = searchTerm || statusFilter !== 'todos' || empresaFilter !== 'todos' || cargoFilter !== 'todos';
  const qtdFiltros = (searchTerm ? 1 : 0) + (statusFilter !== 'todos' ? 1 : 0) + (empresaFilter !== 'todos' ? 1 : 0) + (cargoFilter !== 'todos' ? 1 : 0);
  const resetPagina = () => goToPage(1);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
          <PageHeader
            title="Colaboradores"
            subtitle={`${ativos} colaboradores ativos`}
            action={() => { resetForm(); setDialogOpen(true); }}
            actionLabel="Novo Colaborador"
          />

          {/* Acessos de usuário */}
          {(() => {
            const emailsUsuarios = new Set(usuarios.map((u) => (u.email || '').toLowerCase()));
            const semAcesso = colaboradores.filter((c) => c.status !== 'desligado' && EMAIL_RE.test((c.email || '').toLowerCase()) && !emailsUsuarios.has((c.email || '').toLowerCase()));
            const semEmail = colaboradores.filter((c) => c.status !== 'desligado' && !EMAIL_RE.test((c.email || '').toLowerCase()));
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-900">
                  <span className="font-semibold">{semAcesso.length}</span> colaborador(es) com email ainda sem acesso ao sistema.
                  {semEmail.length > 0 && <span className="text-blue-700"> · <span className="font-semibold">{semEmail.length}</span> sem email (precisam de email para virar usuário).</span>}
                </div>
                <Button onClick={() => sincronizarAcessos.mutate()} disabled={sincronizarAcessos.isPending || semAcesso.length === 0} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="w-4 h-4" /> {sincronizarAcessos.isPending ? 'Gerando acessos...' : 'Gerar acessos de usuário'}
                </Button>
              </div>
            );
          })()}

          {/* Filtros (colapsáveis) */}
          <FiltrosColapsaveis
            ativos={qtdFiltros}
            onLimpar={() => { setSearchTerm(''); setStatusFilter('todos'); setEmpresaFilter('todos'); setCargoFilter('todos'); resetPagina(); }}
            rodape={<span className="text-xs text-gray-500">{filteredColaboradores.length} colaborador(es)</span>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-9 h-11" placeholder="Nome, cargo ou CPF..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); resetPagina(); }} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                <ComboboxBusca
                  options={[{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }, { value: 'ferias', label: 'Férias' }, { value: 'afastado', label: 'Afastado' }, { value: 'desligado', label: 'Desligado' }]}
                  value={statusFilter}
                  onSelect={(v) => { setStatusFilter(v || 'todos'); resetPagina(); }}
                  placeholder="Todos os status"
                  searchPlaceholder="Buscar..."
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Empresa</Label>
                <ComboboxBusca
                  options={empresaOptions}
                  value={empresaFilter}
                  onSelect={(v) => { setEmpresaFilter(v || 'todos'); resetPagina(); }}
                  placeholder="Todas as empresas"
                  searchPlaceholder="Buscar empresa..."
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Função</Label>
                <ComboboxBusca
                  options={cargoOptions}
                  value={cargoFilter}
                  onSelect={(v) => { setCargoFilter(v || 'todos'); resetPagina(); }}
                  placeholder="Todas as funções"
                  searchPlaceholder="Buscar função..."
                />
              </div>
            </div>
          </FiltrosColapsaveis>

          {/* Lista */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {isLoading ? (
                <TableSkeleton bare rows={6} cols={7} />
              ) : filteredColaboradores.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhum colaborador encontrado</h3>
                  <p className="text-sm text-gray-500 mb-5">{temFiltro ? 'Ajuste os filtros ou' : 'Cadastre o primeiro colaborador'}</p>
                  <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Novo Colaborador</Button>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Empresa</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Contato</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Acesso</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pageItens.map((c) => {
                          const st = statusConfig[c.status] || statusConfig.ativo;
                          const emp = empresaNome(c.empresa_id) || '—';
                          const temAcesso = !!c.user_email || emailsUsuariosSet.has((c.email || '').toLowerCase());
                          const roleLabel = c.user_role ? (ROLE_BY_VALUE[c.user_role]?.label || c.user_role) : null;
                          return (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-9 h-9">
                                    <AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">{iniciais(c.nome)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                                    <p className="text-xs text-gray-500 truncate">{c.cargo || '—'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-gray-600">{emp}</td>
                              <td className="p-3">
                                <div className="text-gray-600">
                                  <p className="truncate max-w-[180px]">{c.email || <span className="text-gray-400">—</span>}</p>
                                  {c.telefone && <p className="text-xs text-gray-400">{c.telefone}</p>}
                                </div>
                              </td>
                              <td className="p-3">
                                {temAcesso ? (
                                  <Badge className="bg-green-100 text-green-700 border-0 gap-1"><LogIn className="w-3 h-3" />{roleLabel || 'Com acesso'}</Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-500 border-0">Sem acesso</Badge>
                                )}
                              </td>
                              <td className="p-3"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge></td>
                              <td className="p-3">
                                <div className="flex gap-1 justify-end">
                                  <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(c)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => { setColaboradorToDelete(c); setDeleteDialogOpen(true); }} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {pageItens.map((c) => {
                      const st = statusConfig[c.status] || statusConfig.ativo;
                      const emp = empresaNome(c.empresa_id) || '—';
                      const temAcesso = !!c.user_email || emailsUsuariosSet.has((c.email || '').toLowerCase());
                      const roleLabel = c.user_role ? (ROLE_BY_VALUE[c.user_role]?.label || c.user_role) : null;
                      return (
                        <div key={c.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="w-9 h-9 shrink-0"><AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">{iniciais(c.nome)}</AvatarFallback></Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                                <p className="text-xs text-gray-500 truncate">{c.cargo || '—'}</p>
                              </div>
                            </div>
                            <Badge className={`border-0 shrink-0 ${st.color}`}>{st.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span>{emp}</span>
                            {c.email && <span className="truncate max-w-full">· {c.email}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            {temAcesso
                              ? <Badge className="bg-green-100 text-green-700 border-0 gap-1"><LogIn className="w-3 h-3" />{roleLabel || 'Com acesso'}</Badge>
                              : <Badge className="bg-gray-100 text-gray-500 border-0">Sem acesso</Badge>}
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => handleEdit(c)}><Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar</Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => { setColaboradorToDelete(c); setDeleteDialogOpen(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    totalItems={totalItems}
                  />
                </>
              )}
            </CardContent>
          </Card>

      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="dialog-colaborador-desc">
          <DialogHeader>
            <DialogTitle>
              {editingColaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
            <p id="dialog-colaborador-desc" className="sr-only">
              Formulário para cadastro e edição de colaborador
            </p>
          </DialogHeader>
          <FormIntegrado
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {colaboradorToDelete?.nome}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(colaboradorToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}