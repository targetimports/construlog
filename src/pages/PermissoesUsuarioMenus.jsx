import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Pencil, Search, Users, ShieldCheck, SlidersHorizontal, RotateCcw, Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

const ITENS_POR_PAGINA = 15;

// Perfis com acesso total — não há o que personalizar (herdam tudo).
const PERFIS_TOTAIS = ['admin', 'programador', 'admin_empresa'];

const getRole = (u) => String(u?.role || u?.perfil_acesso || u?.perfil_sistema || '').toLowerCase().trim();
const ehAcessoTotal = (u) => PERFIS_TOTAIS.includes(getRole(u)) || u?.isOwner === true;

export default function PermissoesUsuarioMenus() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // usuário em edição
  const [sel, setSel] = useState(new Set());       // chaves marcadas no modal
  const [salvando, setSalvando] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: overridesData = [] } = useQuery({
    queryKey: ['perm-overrides'],
    queryFn: () => base44.entities.UserPermissionOverride.list()
  });

  const { data: catalogo } = useQuery({
    queryKey: ['perm-catalogo'],
    queryFn: () => base44.functions.invoke('getPermissoesCatalogo').then((r) => r.data),
    staleTime: 10 * 60 * 1000
  });

  const areas = catalogo?.areas || [];
  const roleBase = catalogo?.roleBase || {};

  const overridesPorUsuario = useMemo(() => {
    const m = new Map();
    overridesData.forEach((o) => {
      if (!m.has(o.user_id)) m.set(o.user_id, []);
      m.get(o.user_id).push(o);
    });
    return m;
  }, [overridesData]);

  // Áreas que a role concede por padrão (base).
  const baseDoUsuario = (user) => {
    if (ehAcessoTotal(user)) return areas.map((a) => a.key);
    return roleBase[getRole(user)] || [];
  };

  // Áreas efetivas = base ± overrides.
  const efetivasDoUsuario = (user) => {
    const set = new Set(baseDoUsuario(user));
    (overridesPorUsuario.get(user?.email) || []).forEach((o) => {
      if (o.allowed === true) set.add(o.permission_key);
      else if (o.allowed === false) set.delete(o.permission_key);
    });
    return set;
  };

  const temPersonalizacao = (user) => (overridesPorUsuario.get(user?.email) || []).length > 0;

  const abrirModal = (user) => {
    setEditando(user);
    setSel(new Set(efetivasDoUsuario(user)));
  };
  const fecharModal = () => { setEditando(null); setSel(new Set()); };

  const toggleArea = (key) => setSel((prev) => {
    const n = new Set(prev);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });

  // Salva: para cada área, compara desejado vs base e cria/atualiza/apaga o override.
  const salvar = async () => {
    if (!editando) return;
    setSalvando(true);
    try {
      const email = editando.email;
      const base = new Set(baseDoUsuario(editando));
      const existentes = overridesPorUsuario.get(email) || [];
      const porChave = new Map(existentes.map((o) => [o.permission_key, o]));

      for (const area of areas) {
        const desejado = sel.has(area.key);
        const naBase = base.has(area.key);
        const existente = porChave.get(area.key);

        if (desejado === naBase) {
          // voltou ao padrão da role → remove override se houver
          if (existente) await base44.entities.UserPermissionOverride.delete(existente.id);
        } else if (existente) {
          if (existente.allowed !== desejado) {
            await base44.entities.UserPermissionOverride.update(existente.id, { allowed: desejado });
          }
        } else {
          await base44.entities.UserPermissionOverride.create({
            user_id: email,
            permission_key: area.key,
            allowed: desejado,
            reason: 'Ajuste manual via Permissões de Usuários'
          });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['perm-overrides'] });
      toast.success('Permissões atualizadas');
      fecharModal();
    } catch {
      toast.error('Erro ao salvar permissões');
    } finally {
      setSalvando(false);
    }
  };

  // Remove todos os overrides do usuário (volta 100% ao perfil).
  const resetarParaPerfil = async () => {
    if (!editando) return;
    setSalvando(true);
    try {
      for (const o of overridesPorUsuario.get(editando.email) || []) {
        await base44.entities.UserPermissionOverride.delete(o.id);
      }
      await queryClient.invalidateQueries({ queryKey: ['perm-overrides'] });
      toast.success('Permissões restauradas para o perfil');
      fecharModal();
    } catch {
      toast.error('Erro ao resetar');
    } finally {
      setSalvando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => [u.full_name, u.email, u.role].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [usuarios, busca]);

  const stats = useMemo(() => ({
    total: usuarios.length,
    personalizados: usuarios.filter((u) => temPersonalizacao(u)).length,
    areas: areas.length
  }), [usuarios, overridesPorUsuario, areas]);

  const pag = usePagination(filtrados, ITENS_POR_PAGINA);
  React.useEffect(() => { pag.goToPage(1); /* eslint-disable-next-line */ }, [busca]);

  // Agrupa as áreas por grupo para o modal.
  const areasPorGrupo = useMemo(() => {
    const g = {};
    areas.forEach((a) => { (g[a.grupo] ||= []).push(a); });
    return g;
  }, [areas]);

  const editandoTotal = editando && ehAcessoTotal(editando);
  const baseModal = editando ? new Set(baseDoUsuario(editando)) : new Set();

  return (
    <div className="space-y-6 pb-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permissões de Usuários</h1>
          <p className="text-gray-500 mt-1">Cada usuário herda as áreas do seu perfil — aqui você ajusta exceções (adiciona ou remove uma área)</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600">Usuários</p><p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{stats.total}</p></div>
              <div className="hidden sm:flex p-2.5 rounded-xl bg-gray-100"><Users className="w-6 h-6 text-gray-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600">Personalizados</p><p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{stats.personalizados}</p></div>
              <div className="hidden sm:flex p-2.5 rounded-xl bg-blue-50"><SlidersHorizontal className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600">Áreas ajustáveis</p><p className="text-lg sm:text-2xl font-bold text-violet-600 tabular-nums">{stats.areas}</p></div>
              <div className="hidden sm:flex p-2.5 rounded-xl bg-violet-50"><ShieldCheck className="w-6 h-6 text-violet-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="h-11 pl-9" placeholder="Buscar por nome, e-mail ou perfil..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={5} />
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Users className="w-10 h-10" />
              <p className="text-sm text-gray-500">{usuarios.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum usuário encontrado'}</p>
            </div>
          ) : (
            <>
              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pag.paginatedItems.map((user) => {
                  const total = ehAcessoTotal(user);
                  const nEf = total ? areas.length : efetivasDoUsuario(user).size;
                  return (
                    <div key={user.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{user.full_name || '—'}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <Badge variant="outline" className="capitalize flex-shrink-0">{getRole(user) || '—'}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {total
                            ? <Badge className="border-0 bg-amber-50 text-amber-700">Acesso total</Badge>
                            : <Badge className="border-0 bg-blue-50 text-blue-700">{nEf} / {areas.length} áreas</Badge>}
                          {temPersonalizacao(user) && <Badge className="border-0 bg-violet-50 text-violet-700">Personalizado</Badge>}
                        </div>
                        {!total && (
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-blue-600" onClick={() => abrirModal(user)}><Pencil className="w-4 h-4" /> Ajustar</Button>
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Usuário</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Perfil</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Áreas liberadas</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Personalização</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pag.paginatedItems.map((user) => {
                      const total = ehAcessoTotal(user);
                      const nEf = total ? areas.length : efetivasDoUsuario(user).size;
                      return (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{user.full_name || '—'}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </td>
                          <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{getRole(user) || '—'}</Badge></td>
                          <td className="px-4 py-3 text-center">
                            {total ? (
                              <Badge className="border-0 bg-amber-50 text-amber-700">Acesso total</Badge>
                            ) : (
                              <Badge className="border-0 bg-blue-50 text-blue-700">{nEf} / {areas.length}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {temPersonalizacao(user) ? (
                              <Badge className="border-0 bg-violet-50 text-violet-700">Personalizado</Badge>
                            ) : (
                              <span className="text-xs text-gray-400">Padrão do perfil</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                                      onClick={() => abrirModal(user)}
                                      disabled={total}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{total ? 'Perfil com acesso total' : 'Ajustar permissões'}</TooltipContent>
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

      {/* Modal de ajuste */}
      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) fecharModal(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões de {editando?.full_name || editando?.email}</DialogTitle>
            <p className="text-sm text-gray-500">{editando?.email} · perfil <span className="capitalize font-medium">{getRole(editando)}</span></p>
          </DialogHeader>

          {editandoTotal ? (
            <Alert className="border-amber-200 bg-amber-50">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">Este perfil tem acesso total ao sistema — não há áreas para ajustar.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-5 py-1">
              <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900">
                  As áreas marcadas com fundo são as que <strong>já vêm do perfil</strong>. Desmarcar remove para este usuário; marcar uma extra adiciona. O que ficar igual ao perfil não vira exceção.
                </p>
              </div>

              {Object.entries(areasPorGrupo).map(([grupo, lista]) => (
                <div key={grupo}>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">{grupo}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lista.map((a) => {
                      const naBase = baseModal.has(a.key);
                      const marcado = sel.has(a.key);
                      return (
                        <label
                          key={a.key}
                          htmlFor={`area-${a.key}`}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${naBase ? 'border-gray-200 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          <Checkbox id={`area-${a.key}`} checked={marcado} onCheckedChange={() => toggleArea(a.key)} />
                          <span className="text-sm text-gray-700 flex-1">{a.label}</span>
                          {naBase
                            ? <span className="text-[10px] text-gray-400">perfil</span>
                            : (marcado && <span className="text-[10px] text-violet-600 font-medium">extra</span>)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!editandoTotal && (
            <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
              <Button
                variant="outline"
                onClick={resetarParaPerfil}
                disabled={salvando || !temPersonalizacao(editando)}
                className="gap-2 text-gray-600"
              >
                <RotateCcw className="w-4 h-4" /> Resetar para o perfil
              </Button>
              <div className="flex gap-2 sm:ml-auto">
                <Button variant="outline" onClick={fecharModal} disabled={salvando}>Cancelar</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={salvar} disabled={salvando}>
                  <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
