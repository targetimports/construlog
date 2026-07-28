import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Users, Pencil, ChevronRight as Chevron } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import PageHeader from '../components/ui/PageHeader';
import GestorMembrosEquipe from '../components/equipes/GestorMembrosEquipe';
import HistoricoMembrosEquipe from '../components/equipes/HistoricoMembrosEquipe';
import { TableSkeleton } from '@/components/shared/Skeletons';

const statusConfig = {
  ativa: { label: 'Ativa', color: 'bg-emerald-100 text-emerald-700' },
  inativa: { label: 'Inativa', color: 'bg-gray-100 text-gray-600' },
};

const normCargo = (s) => {
  const v = String(s || '').toLowerCase();
  if (v.includes('mestre')) return 'mestre_obras';
  if (v.includes('engenh')) return 'engenheiro';
  if (v.includes('arquit')) return 'arquiteto';
  if (v.includes('encarreg')) return 'encarregado';
  return v;
};

export default function Equipes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [equipeSelecionada, setEquipeSelecionada] = useState(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ funcao: '', turno: 'integral', status: 'ativa' });
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    obra_id: '',
    responsavel_id: '',
    funcao: '',
    turno: 'integral',
    status: 'ativa',
    data_inicio: new Date().toISOString().split('T')[0],
    observacoes: ''
  });

  const { data: equipes = [], isLoading } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list('-created_date', 100)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Equipe.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      toast.success('Equipe criada!');
      resetForm();
    },
    onError: (e) => toast.error('Erro ao criar equipe: ' + (e?.message || 'tente novamente')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Equipe.update(id, data),
    onSuccess: (_res, { data }) => {
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      setEquipeSelecionada(prev => (prev ? { ...prev, ...data } : prev));
      setEditMode(false);
      toast.success('Equipe atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar a equipe')
  });

  const abrirEdicao = () => {
    setEditData({
      funcao: equipeSelecionada?.funcao || '',
      turno: equipeSelecionada?.turno || 'integral',
      status: equipeSelecionada?.status || 'ativa',
    });
    setEditMode(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      obra_id: '',
      responsavel_id: '',
      funcao: '',
      turno: 'integral',
      status: 'ativa',
      data_inicio: new Date().toISOString().split('T')[0],
      observacoes: ''
    });
    setDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) { toast.error('Informe o nome da equipe'); return; }
    createMutation.mutate({ ...formData, colaboradores_ids: [] });
  };

  const abrirDetalhes = (equipe) => {
    setEquipeSelecionada(equipe);
    setEditMode(false);
    setDetalhesAberto(true);
  };

  const lideresDisponiveis = useMemo(
    () => colaboradores.filter(c =>
      c.status !== 'inativo' && c.status !== 'demitido' &&
      ['mestre_obras', 'engenheiro', 'arquiteto', 'encarregado'].includes(normCargo(c.cargo))
    ),
    [colaboradores]
  );

  const filteredEquipes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return equipes.filter(e => {
      const matchBusca = !q || e.nome?.toLowerCase().includes(q) || e.funcao?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'todas' || (e.status || 'ativa') === statusFilter;
      return matchBusca && matchStatus;
    });
  }, [equipes, searchTerm, statusFilter]);

  const equipesAtivas = equipes.filter(e => (e.status || 'ativa') === 'ativa').length;
  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filteredEquipes, 20);
  const temFiltro = searchTerm || statusFilter !== 'todas';
  const resetPagina = () => goToPage(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipes de Trabalho"
        subtitle="Gestão de equipes"
        action={() => { resetForm(); setDialogOpen(true); }}
        actionLabel="Nova Equipe"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Total de Equipes</div>
            <div className="text-2xl font-bold text-gray-900">{equipes.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Equipes Ativas</div>
            <div className="text-2xl font-bold text-emerald-600">{equipesAtivas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-9 h-11" placeholder="Nome ou função..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); resetPagina(); }} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
              <ComboboxBusca
                options={[
                  { value: 'todas', label: 'Todas' },
                  { value: 'ativa', label: 'Ativas' },
                  { value: 'inativa', label: 'Inativas' },
                ]}
                value={statusFilter}
                onSelect={(v) => { setStatusFilter(v || 'todas'); resetPagina(); }}
                placeholder="Todas"
                searchPlaceholder="Buscar status..."
                emptyMessage="Nenhum status."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{filteredEquipes.length} equipe(s)</span>
            {temFiltro && <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-700" onClick={() => { setSearchTerm(''); setStatusFilter('todas'); resetPagina(); }}>Limpar filtros</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={7} />
          ) : filteredEquipes.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhuma equipe encontrada</h3>
              <p className="text-sm text-gray-500 mb-5">{temFiltro ? 'Ajuste os filtros ou' : 'Crie a primeira equipe'}</p>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Nova Equipe</Button>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {paginatedItems.map((e) => {
                  const obra = obras.find(o => o.id === e.obra_id);
                  const responsavel = colaboradores.find(c => c.id === e.responsavel_id);
                  const membros = e.colaboradores_ids?.length || 0;
                  const st = statusConfig[e.status] || statusConfig.ativa;
                  return (
                    <div
                      key={e.id}
                      onClick={() => abrirDetalhes(e)}
                      className="p-3 rounded-lg border border-gray-200 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{e.nome}</p>
                          <p className="text-xs text-gray-500 truncate">{e.funcao || 'Sem função'}</p>
                        </div>
                        <Badge className={`border-0 shrink-0 ${st.color}`}>{st.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span className="truncate">Resp.: {responsavel?.nome || '—'}</span>
                        <span className="truncate">Obra: {obra?.nome || '—'}</span>
                        <span>Membros: {membros}</span>
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
                      <th className="text-left p-3 font-semibold text-gray-600">Equipe</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Responsável</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Membros</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Turno</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((e) => {
                      const obra = obras.find(o => o.id === e.obra_id);
                      const responsavel = colaboradores.find(c => c.id === e.responsavel_id);
                      const membros = e.colaboradores_ids?.length || 0;
                      const st = statusConfig[e.status] || statusConfig.ativa;
                      return (
                        <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => abrirDetalhes(e)}>
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{e.nome}</p>
                            <p className="text-xs text-gray-500">{e.funcao || 'Sem função'}</p>
                          </td>
                          <td className="p-3 text-gray-600">{responsavel?.nome || <span className="text-gray-400 italic">Sem líder</span>}</td>
                          <td className="p-3 text-gray-600">{obra?.nome || <span className="text-gray-400">—</span>}</td>
                          <td className="p-3 text-gray-700 font-medium">{membros}</td>
                          <td className="p-3 text-gray-600 capitalize">{e.turno || '—'}</td>
                          <td className="p-3"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge></td>
                          <td className="p-3 text-right"><Chevron className="w-4 h-4 text-gray-300 inline" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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

      {/* Dialog Nova Equipe */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Equipe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome da Equipe *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                className="mt-1.5 h-11"
                placeholder="Ex: Equipe de Alvenaria"
              />
            </div>
            <div>
              <Label>Obra Vinculada</Label>
              <div className="mt-1.5">
                <ComboboxBusca
                  options={obras.map(o => ({ value: o.id, label: o.nome }))}
                  value={formData.obra_id}
                  onSelect={(v) => setFormData({ ...formData, obra_id: v })}
                  placeholder="Selecione a obra (opcional)"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra encontrada."
                />
              </div>
            </div>
            <div>
              <Label>Líder / Responsável</Label>
              <div className="mt-1.5">
                <ComboboxBusca
                  options={lideresDisponiveis.map(c => ({ value: c.id, label: `${c.nome} — ${c.cargo}` }))}
                  value={formData.responsavel_id}
                  onSelect={(v) => setFormData({ ...formData, responsavel_id: v })}
                  placeholder="Selecione o líder"
                  searchPlaceholder="Buscar líder..."
                  emptyMessage="Nenhum líder disponível (cadastre Mestre de Obras, Engenheiro, Arquiteto ou Encarregado)."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Função</Label>
                <Input
                  value={formData.funcao}
                  onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                  placeholder="Ex: Alvenaria"
                  className="mt-1.5 h-11"
                />
              </div>
              <div>
                <Label>Turno</Label>
                <Select value={formData.turno} onValueChange={(v) => setFormData({ ...formData, turno: v })}>
                  <SelectTrigger className="mt-1.5 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                    <SelectItem value="integral">Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {createMutation.isPending ? 'Criando...' : 'Criar Equipe'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes + Gerenciar Membros */}
      <Dialog open={detalhesAberto} onOpenChange={(o) => { setDetalhesAberto(o); if (!o) setEditMode(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{equipeSelecionada?.nome}</DialogTitle>
          </DialogHeader>

          {equipeSelecionada && (
            <div className="space-y-6">
              {/* Informações gerais */}
              {!editMode ? (
                <div>
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" onClick={abrirEdicao}>
                      <Pencil className="w-4 h-4 mr-1" /> Editar
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-600 mb-1">Função</p>
                      <p className="text-gray-900 font-semibold">{equipeSelecionada.funcao || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-600 mb-1">Turno</p>
                      <p className="text-gray-900 font-semibold capitalize">{equipeSelecionada.turno}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
                      <span className={`text-base font-semibold capitalize ${equipeSelecionada.status === 'ativa' ? 'text-emerald-600' : equipeSelecionada.status === 'inativa' ? 'text-gray-500' : 'text-amber-600'}`}>
                        {equipeSelecionada.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-600 mb-1">Desde</p>
                      <p className="text-gray-900 font-semibold">
                        {equipeSelecionada.data_inicio ? new Date(equipeSelecionada.data_inicio).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <Label>Função</Label>
                    <Input
                      value={editData.funcao}
                      onChange={(e) => setEditData({ ...editData, funcao: e.target.value })}
                      placeholder="Ex: Alvenaria"
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Turno</Label>
                      <Select value={editData.turno} onValueChange={(v) => setEditData({ ...editData, turno: v })}>
                        <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manha">Manhã</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="noite">Noite</SelectItem>
                          <SelectItem value="integral">Integral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                        <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativa">Ativa</SelectItem>
                          <SelectItem value="inativa">Inativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancelar</Button>
                    <Button
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: equipeSelecionada.id, data: editData })}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {/* Gerenciar Membros */}
              <div className="border-t pt-6">
                <GestorMembrosEquipe
                  equipe={equipes.find(e => e.id === equipeSelecionada.id) || equipeSelecionada}
                  onMembrosAtualizados={() => {
                    queryClient.invalidateQueries({ queryKey: ['equipes'] });
                  }}
                />
              </div>

              {/* Histórico */}
              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Histórico de Alterações</h4>
                <HistoricoMembrosEquipe equipeId={equipeSelecionada.id} />
              </div>

              {/* Botão fechar */}
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setDetalhesAberto(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
