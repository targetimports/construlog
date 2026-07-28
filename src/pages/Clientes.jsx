import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { Plus, Search, Edit2, Trash2, Eye, Mail, Phone, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ClienteForm from '../components/clientes/ClienteForm';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function Clientes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [clienteParaDeletar, setClienteParaDeletar] = useState(null);
  const [deletando, setDeletando] = useState(false);
  const itensPorPagina = 20;

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const filteredClientes = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return clientes.filter(c => {
      const matchSearch =
        (c.nome || '').toLowerCase().includes(termo) ||
        (c.cnpj_cpf && c.cnpj_cpf.includes(searchTerm)) ||
        (c.email && c.email.toLowerCase().includes(termo)) ||
        (c.telefone && c.telefone.includes(searchTerm));

      const matchStatus = filterStatus === 'todos' || c.status === filterStatus;

      return matchSearch && matchStatus;
    });
  }, [clientes, searchTerm, filterStatus]);

  const {
    paginatedItems: clientesPaginados,
    currentPage, totalPages, goToPage, startIndex, endIndex, totalItems,
  } = usePagination(filteredClientes, itensPorPagina);

  const handleOpenForm = (cliente = null) => {
    setSelectedCliente(cliente);
    setDialogOpen(true);
  };

  const handleCloseForm = () => {
    setDialogOpen(false);
    setSelectedCliente(null);
  };

  const handleSave = async () => {
    await queryClient.refetchQueries({ queryKey: ['clientes'] });
    handleCloseForm();
  };

  const confirmarDelete = async () => {
    if (!clienteParaDeletar) return;
    setDeletando(true);
    try {
      await base44.entities.Cliente.delete(clienteParaDeletar.id);
      await queryClient.refetchQueries({ queryKey: ['clientes'] });
      toast.success('Cliente deletado com sucesso!');
      setClienteParaDeletar(null);
    } catch (err) {
      toast.error('Erro ao deletar: ' + err.message);
    } finally {
      setDeletando(false);
    }
  };

  const handleImportOrcaFacil = async (file) => {
    setImportLoading(true);
    try {
      // Parse do xlsx no cliente e envio das linhas como JSON (invoke não transporta File).
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) {
        toast.error('Planilha vazia ou sem linhas reconhecíveis');
        return;
      }

      const response = await base44.functions.invoke('importarClientesOrcaFacil', { rows });

      if (response.data.success) {
        toast.success(`${response.data.clientesImportados} cliente(s) importado(s)`);
        if (response.data.erros?.length) {
          toast.warning(`${response.data.erros.length} linha(s) ignorada(s) (sem nome ou inválidas)`);
        }
        await queryClient.refetchQueries({ queryKey: ['clientes'] });
        setImportOpen(false);
      } else {
        toast.error(response.data.mensagem || 'Erro ao importar');
      }
    } catch (err) {
      toast.error('Erro ao importar: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const statusBadge = (status) => status === 'ativo'
    ? <Badge className="bg-green-100 text-green-700 border-0 shrink-0">Ativo</Badge>
    : <Badge className="bg-gray-100 text-gray-600 border-0 shrink-0">Inativo</Badge>;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">Gerenciar clientes e contatos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full sm:w-auto gap-2 border-gray-300 text-gray-700">
            <Upload className="w-4 h-4" />
            Importar OrçaFácil
          </Button>
          <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filtros (colapsáveis) */}
      <FiltrosColapsaveis
        ativos={(searchTerm ? 1 : 0) + (filterStatus !== 'todos' ? 1 : 0)}
        onLimpar={() => { setSearchTerm(''); setFilterStatus('todos'); goToPage(1); }}
        rodape={<span className="text-xs text-gray-500">{filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} encontrado{filteredClientes.length !== 1 ? 's' : ''}</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Nome, CNPJ, email ou telefone..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); goToPage(1); }} className="pl-9 h-11" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <ComboboxBusca
              options={[{ value: 'todos', label: 'Todos os Status' }, { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]}
              value={filterStatus}
              onSelect={(v) => { setFilterStatus(v || 'todos'); goToPage(1); }}
              placeholder="Todos os Status"
              searchPlaceholder="Buscar..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      {/* Lista (desktop tabela / mobile cards) */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton bare rows={6} cols={6} /></div>
          ) : filteredClientes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-600 mb-4">Nenhum cliente encontrado</p>
              <Button onClick={() => handleOpenForm()} variant="outline">Criar primeiro cliente</Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Nome</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">CNPJ / CPF</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Contato</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Cidade / UF</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientesPaginados.map(cliente => (
                      <tr key={cliente.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{cliente.nome}</td>
                        <td className="p-3 text-gray-600">{cliente.cnpj_cpf || '-'}</td>
                        <td className="p-3 text-gray-600">
                          <div className="space-y-0.5">
                            {cliente.email && (
                              <a href={`mailto:${cliente.email}`} className="flex items-center gap-1.5 hover:text-blue-600">
                                <Mail className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate max-w-[200px]">{cliente.email}</span>
                              </a>
                            )}
                            {cliente.telefone && (
                              <a href={`tel:${cliente.telefone}`} className="flex items-center gap-1.5 hover:text-blue-600">
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {cliente.telefone}
                              </a>
                            )}
                            {!cliente.email && !cliente.telefone && '-'}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">
                          {cliente.cidade || cliente.estado
                            ? `${cliente.cidade || ''}${cliente.cidade && cliente.estado ? ', ' : ''}${cliente.estado || ''}`
                            : '-'}
                        </td>
                        <td className="p-3 text-center">{statusBadge(cliente.status)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Ver" onClick={() => { setSelectedCliente(cliente); setDetailsOpen(true); }}>
                              <Eye className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar" onClick={() => handleOpenForm(cliente)}>
                              <Edit2 className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Deletar" onClick={() => setClienteParaDeletar(cliente)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {clientesPaginados.map(cliente => (
                  <div key={cliente.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{cliente.nome}</p>
                        {cliente.cnpj_cpf && <p className="text-xs text-gray-500">{cliente.cnpj_cpf}</p>}
                      </div>
                      {statusBadge(cliente.status)}
                    </div>
                    {(cliente.email || cliente.telefone) && (
                      <div className="space-y-1 text-sm">
                        {cliente.email && (
                          <a href={`mailto:${cliente.email}`} className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600">
                            <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{cliente.email}</span>
                          </a>
                        )}
                        {cliente.telefone && (
                          <a href={`tel:${cliente.telefone}`} className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600">
                            <Phone className="w-3.5 h-3.5 shrink-0" /> {cliente.telefone}
                          </a>
                        )}
                      </div>
                    )}
                    {(cliente.cidade || cliente.estado) && (
                      <p className="text-xs text-gray-500">{cliente.cidade || ''}{cliente.cidade && cliente.estado ? ', ' : ''}{cliente.estado || ''}</p>
                    )}
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                      <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => { setSelectedCliente(cliente); setDetailsOpen(true); }}>
                        <Eye className="w-3.5 h-3.5 text-gray-500" /> Ver
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => handleOpenForm(cliente)}>
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 h-8 text-red-500 ml-auto" onClick={() => setClienteParaDeletar(cliente)}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!isLoading && filteredClientes.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={totalItems}
            />
          )}
        </CardContent>
      </Card>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!clienteParaDeletar} onOpenChange={(o) => { if (!o) setClienteParaDeletar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{clienteParaDeletar?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarDelete(); }}
              disabled={deletando}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletando ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Formulário */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <ClienteForm
            cliente={selectedCliente}
            onSave={handleSave}
            onCancel={handleCloseForm}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Importar */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Clientes do OrçaFácil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Selecione um arquivo Excel (.xlsx) exportado do OrçaFácil
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportOrcaFacil(file);
                }
              }}
              disabled={importLoading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importLoading} className="w-full">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          {selectedCliente && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="font-semibold text-lg">{selectedCliente.nome}</p>
              </div>

              {selectedCliente.cnpj_cpf && (
                <div>
                  <p className="text-sm text-gray-600">CNPJ/CPF</p>
                  <p className="font-semibold">{selectedCliente.cnpj_cpf}</p>
                </div>
              )}

              {selectedCliente.email && (
                <div>
                  <p className="text-sm text-gray-600">E-mail</p>
                  <a href={`mailto:${selectedCliente.email}`} className="font-semibold text-blue-600 hover:underline">
                    {selectedCliente.email}
                  </a>
                </div>
              )}

              {selectedCliente.telefone && (
                <div>
                  <p className="text-sm text-gray-600">Telefone</p>
                  <a href={`tel:${selectedCliente.telefone}`} className="font-semibold text-blue-600 hover:underline">
                    {selectedCliente.telefone}
                  </a>
                </div>
              )}

              {(selectedCliente.endereco || selectedCliente.bairro || selectedCliente.cep || selectedCliente.cidade || selectedCliente.estado) && (
                <div>
                  <p className="text-sm text-gray-600">Endereço Completo</p>
                  <div className="font-semibold">
                    {selectedCliente.endereco && <div>{selectedCliente.endereco}</div>}
                    {selectedCliente.bairro && <div>{selectedCliente.bairro}</div>}
                    <div>
                      {selectedCliente.cidade}{selectedCliente.cidade && selectedCliente.estado ? ', ' : ''}{selectedCliente.estado}
                      {selectedCliente.cep && <span> - {selectedCliente.cep}</span>}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge variant={selectedCliente.status === 'ativo' ? 'default' : 'secondary'}>
                  {selectedCliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {selectedCliente.observacoes && (
                <div>
                  <p className="text-sm text-gray-600">Observações</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedCliente.observacoes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={() => {
                  setDetailsOpen(false);
                  handleOpenForm(selectedCliente);
                }} className="flex-1">
                  Editar
                </Button>
                <Button variant="outline" onClick={() => setDetailsOpen(false)} className="flex-1">
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
