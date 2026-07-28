import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash2, MoreVertical, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';
import EmpresaForm from '@/components/empresas/EmpresaForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { PageSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';

const POR_PAGINA = 10;

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Empresas() {
  const [showForm, setShowForm] = useState(false);
  const [empresaEdit, setEmpresaEdit] = useState(null);
  const [repasse, setRepasse] = useState({ open: false, empresa: null });
  const [repasseValor, setRepasseValor] = useState('');
  const [repasseDesc, setRepasseDesc] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagina, setPagina] = useState(1);
  const queryClient = useQueryClient();

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // A queryKey ['empresas'] é COMPARTILHADA (useBranding global, ConfiguracoesEmpresa, etc.).
  // Buscamos a lista COMPLETA — filtrar aqui encolheria o cache comum e esconderia o
  // registro de branding de quem precisa dele. O filtro é feito no render (abaixo).
  const { data: empresasRaw = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
  });
  // Nesta tela de gestão mostramos só matriz + membros; oculta o registro de
  // branding/identidade (tipo=null, sem nome/CNPJ) que não é uma empresa gerenciável.
  const empresas = useMemo(
    () => empresasRaw.filter((e) => e.tipo === 'matriz' || e.tipo === 'membro'),
    [empresasRaw]
  );

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-empresa'],
    queryFn: () => base44.entities.User.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Empresa.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      toast.success('Empresa deletada');
    },
    onError: (err) => toast.error(err.message || 'Erro ao deletar empresa'),
  });

  const abrirRepasse = (empresa) => { setRepasse({ open: true, empresa }); setRepasseValor(''); setRepasseDesc(''); };
  const repasseMutation = useMutation({
    mutationFn: () => base44.functions.invoke('repassarVerba', {
      empresa_id: repasse.empresa.id,
      valor: Number(repasseValor),
      descricao: repasseDesc || null,
    }),
    onSuccess: (res) => {
      if (res.data?.success === false) { toast.error(res.data.error || 'Falha no repasse'); return; }
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      toast.success(`Orçamento alocado. Novo limite: ${fmtBRL(res.data?.saldo_verba)}`);
      setRepasse({ open: false, empresa: null });
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message),
  });

  const handleClose = () => {
    setShowForm(false);
    setEmpresaEdit(null);
  };

  const usuariosPorEmpresa = (empresa) => usuarios.filter((u) => u.empresa_id === empresa.id).length || empresa.usuarios?.length || 0;

  const filtered = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) =>
      (e.nome || '').toLowerCase().includes(termo)
      || (e.cnpj || '').toLowerCase().includes(termo)
      || (e.razao_social || '').toLowerCase().includes(termo)
    );
  }, [empresas, searchTerm]);

  // Volta p/ a 1ª página sempre que a busca muda.
  useEffect(() => { setPagina(1); }, [searchTerm]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const startIndex = (pagAtual - 1) * POR_PAGINA;
  const endIndex = Math.min(startIndex + POR_PAGINA, filtered.length);
  const pageEmpresas = filtered.slice(startIndex, endIndex);

  if (loadingUser || isLoading) {
    return <PageSkeleton kpis={4} rows={5} cols={7} />;
  }

  // Super-roles (admin + TI/programador) e staff da matriz (acesso_global) têm acesso total.
  const isSuper = ['admin', 'programador'].includes(user?.role) || user?.acesso_global === true;
  if (!isSuper) {
    return <div className="p-4 text-red-600">Acesso negado - Apenas administradores / TI</div>;
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as empresas e suas configurações</p>
        </div>
        <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2 flex-shrink-0" onClick={() => { setEmpresaEdit(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Nova Empresa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{empresas.length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Ativas</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{empresas.filter((e) => e.ativa).length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Matriz</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{empresas.filter((e) => e.tipo === 'matriz').length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Membros</p>
          <p className="text-lg sm:text-2xl font-bold text-purple-600 mt-1 tabular-nums">{empresas.filter((e) => e.tipo === 'membro').length}</p>
        </CardContent></Card>
      </div>

      {/* Busca */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6 space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Buscar</label>
            <Input
              placeholder="Nome, CNPJ ou razão social..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 max-w-md"
            />
          </div>
          <span className="text-xs text-gray-500">{filtered.length} empresa(s)</span>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2 p-2">
            {pageEmpresas.length === 0 ? (
              <p className="text-center py-10 text-gray-400">Nenhuma empresa encontrada</p>
            ) : pageEmpresas.map((empresa) => (
              <div key={empresa.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{empresa.nome}</p>
                    <p className="font-mono text-xs text-gray-500">{empresa.cnpj || '—'}</p>
                    {empresa.razao_social && <p className="text-xs text-gray-500 truncate">{empresa.razao_social}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {empresa.tipo === 'matriz'
                      ? <Badge className="bg-blue-100 text-blue-700 border-0">Matriz</Badge>
                      : <Badge className="bg-purple-100 text-purple-700 border-0">Membro</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEmpresaEdit(empresa); setShowForm(true); }}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        {empresa.tipo === 'membro' && <DropdownMenuItem onClick={() => abrirRepasse(empresa)}><Wallet className="w-4 h-4 mr-2" /> Alocar orçamento</DropdownMenuItem>}
                        <DropdownMenuItem onClick={async () => { if (await confirmar({ titulo: 'Deletar empresa', descricao: `Deletar a empresa "${empresa.nome}"?`, destrutivo: true })) deleteMutation.mutate(empresa.id); }} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Deletar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{usuariosPorEmpresa(empresa)} usuário(s)</span>
                  {empresa.tipo === 'membro' && (
                    <span className={`font-semibold tabular-nums ${Number(empresa.saldo_verba) < 0 ? 'text-red-600' : 'text-purple-700'}`}>{fmtBRL(empresa.saldo_verba)}</span>
                  )}
                  <Badge className={empresa.ativa ? 'bg-green-100 text-green-800 border-0' : 'bg-gray-100 text-gray-600 border-0'}>{empresa.ativa ? 'Ativa' : 'Inativa'}</Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Razão Social</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Limite Orçamentário</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Usuários</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageEmpresas.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-400">Nenhuma empresa encontrada</td></tr>
                ) : (
                  pageEmpresas.map((empresa) => (
                    <tr key={empresa.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{empresa.nome}</div>
                        <div className="font-mono text-xs text-gray-500">{empresa.cnpj || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{empresa.razao_social || '—'}</td>
                      <td className="px-4 py-3">
                        {empresa.tipo === 'matriz' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-0">Matriz</Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-700 border-0">Membro</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {empresa.tipo === 'membro' ? (
                          <span className={`font-semibold tabular-nums ${Number(empresa.saldo_verba) < 0 ? 'text-red-600' : 'text-purple-700'}`}>
                            {fmtBRL(empresa.saldo_verba)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 tabular-nums">{usuariosPorEmpresa(empresa)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={empresa.ativa ? 'bg-green-100 text-green-800 border-0' : 'bg-gray-100 text-gray-600 border-0'}>
                          {empresa.ativa ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEmpresaEdit(empresa); setShowForm(true); }}>
                                <Edit className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              {empresa.tipo === 'membro' && (
                                <DropdownMenuItem onClick={() => abrirRepasse(empresa)}>
                                  <Wallet className="w-4 h-4 mr-2" /> Alocar orçamento
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={async () => { if (await confirmar({ titulo: 'Deletar empresa', descricao: `Deletar a empresa "${empresa.nome}"?`, destrutivo: true })) deleteMutation.mutate(empresa.id); }}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={pagAtual} totalPages={totalPaginas} onPageChange={setPagina} startIndex={startIndex} endIndex={endIndex} totalItems={filtered.length} />
        </CardContent>
      </Card>

      {/* Dialog de Formulário */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{empresaEdit ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            <DialogDescription>
              Configure os dados da empresa
            </DialogDescription>
          </DialogHeader>
          <EmpresaForm empresa={empresaEdit} onClose={handleClose} />
        </DialogContent>
      </Dialog>

      {/* Dialog de Repasse de Verba (Matriz aloca verba p/ empresa-membro) */}
      <Dialog open={repasse.open} onOpenChange={(o) => !o && setRepasse({ open: false, empresa: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-purple-600" /> Alocar Orçamento</DialogTitle>
            <DialogDescription>
              {repasse.empresa?.nome} — limite atual {fmtBRL(repasse.empresa?.saldo_verba)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor a alocar *</Label>
              <Input type="number" min="0" step="0.01" value={repasseValor} onChange={(e) => setRepasseValor(e.target.value)} placeholder="0,00" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Descrição <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input value={repasseDesc} onChange={(e) => setRepasseDesc(e.target.value)} placeholder="Ex: Orçamento de julho" className="mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setRepasse({ open: false, empresa: null })} className="flex-1">Cancelar</Button>
              <Button onClick={() => { if (!(Number(repasseValor) > 0)) return toast.error('Informe um valor'); repasseMutation.mutate(); }} disabled={repasseMutation.isPending} className="flex-1 bg-purple-600 hover:bg-purple-700">
                {repasseMutation.isPending ? 'Alocando...' : 'Alocar Orçamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
