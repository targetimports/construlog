import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import VeiculoForm from '../components/frota/VeiculoForm';
import Pagination from '@/components/shared/Pagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

const LIMIT = 15;

const TIPOS_VEICULO = {
  carro: 'Carro',
  moto: 'Moto',
  caminhonete: 'Caminhonete',
  caminhao: 'Caminhão',
  outro: 'Outro'
};

// Status do veículo (enum) → rótulo + cor da badge (tema claro).
const STATUS_CFG = {
  ativo: { label: 'Ativo', cls: 'bg-green-100 text-green-800' },
  manutencao: { label: 'Manutenção', cls: 'bg-amber-100 text-amber-700' },
  inativo: { label: 'Inativo', cls: 'bg-gray-100 text-gray-600' },
};
const statusDe = (v) => (v.status && STATUS_CFG[v.status] ? v.status : (v.ativo === false ? 'inativo' : 'ativo'));

export default function Frota() {
  const [searchPlaca, setSearchPlaca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [deleteVeiculo, setDeleteVeiculo] = useState(null);
  const [pagina, setPagina] = useState(0);

  const queryClient = useQueryClient();

  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list('-updated_date', 1000)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('excluirVeiculoComAtivo', { veiculo_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['ativos'] });
      toast.success('Veículo excluído com sucesso');
      setDeleteVeiculo(null);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
  });

  const veiculosFiltrados = useMemo(() => {
    let filtered = veiculos;
    if (statusFiltro !== 'todos') {
      filtered = filtered.filter((v) => statusDe(v) === statusFiltro);
    }
    if (searchPlaca.trim()) {
      const search = searchPlaca.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          (v.placa && v.placa.toLowerCase().includes(search)) ||
          (v.modelo && v.modelo.toLowerCase().includes(search))
      );
    }
    return filtered;
  }, [veiculos, searchPlaca, statusFiltro]);

  // Reseta a paginação quando os filtros mudam.
  useEffect(() => { setPagina(0); }, [searchPlaca, statusFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(veiculosFiltrados.length / LIMIT));
  const paginados = veiculosFiltrados.slice(pagina * LIMIT, (pagina + 1) * LIMIT);

  const handleNovoVeiculo = () => { setSelectedVeiculo(null); setFormOpen(true); };
  const handleEditarVeiculo = (veiculo) => { setSelectedVeiculo(veiculo); setFormOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Frota de Veículos</h1>
          <p className="text-gray-500 mt-1">Cadastro e gerenciamento da frota</p>
        </div>
        <Button onClick={handleNovoVeiculo} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" /> Novo Veículo
        </Button>
      </div>

      {/* Filtros */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Placa ou Modelo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchPlaca}
                  onChange={(e) => setSearchPlaca(e.target.value)}
                  placeholder="ABC-1234, Ford F-150..."
                  className="pl-9 h-10 border-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Status</label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="h-10 border-gray-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="manutencao">Em manutenção</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={8} cols={6} />
          ) : veiculosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhum veículo encontrado</p>
              <p className="text-xs text-gray-400 mt-1">Use "Novo Veículo" para cadastrar.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Placa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Modelo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rastreador</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginados.map((veiculo) => {
                      const st = STATUS_CFG[statusDe(veiculo)];
                      return (
                        <tr key={veiculo.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{veiculo.placa || '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{veiculo.modelo || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{TIPOS_VEICULO[veiculo.tipo] || veiculo.tipo || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`border-0 ${st.cls}`}>{st.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {veiculo.rastreador_id
                              ? <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">{veiculo.rastreador_id}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button onClick={() => handleEditarVeiculo(veiculo)} size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:text-blue-600">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button onClick={() => setDeleteVeiculo(veiculo)} size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={pagina + 1}
                totalPages={totalPaginas}
                onPageChange={(p) => setPagina(p - 1)}
                startIndex={pagina * LIMIT}
                endIndex={Math.min((pagina + 1) * LIMIT, veiculosFiltrados.length)}
                totalItems={veiculosFiltrados.length}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Formulário */}
      <VeiculoForm open={formOpen} onOpenChange={setFormOpen} veiculo={selectedVeiculo} />

      {/* Dialog Excluir */}
      <AlertDialog open={!!deleteVeiculo} onOpenChange={(open) => !open && setDeleteVeiculo(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogTitle className="text-gray-900">Excluir veículo?</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-500">
            Tem certeza que deseja excluir o veículo <span className="font-semibold text-gray-700">{deleteVeiculo?.placa}</span>? Esta ação é irreversível.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-6">
            <AlertDialogCancel className="border-gray-300 text-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteVeiculo.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
