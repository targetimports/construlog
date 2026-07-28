import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import FormRelatorioAgendado from '../components/relatorios/FormRelatorioAgendado';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function RelatoriosAgendados() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRelatorio, setSelectedRelatorio] = useState(null);
  const [relParaDeletar, setRelParaDeletar] = useState(null);
  const [deletando, setDeletando] = useState(false);

  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ['relatorios-agendados'],
    queryFn: () => base44.entities.RelatorioAgendado.list('-created_date'),
    staleTime: 60000
  });

  const { paginatedItems: relatoriosPag, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(relatorios, 20);

  const confirmarDelete = async () => {
    if (!relParaDeletar) return;
    setDeletando(true);
    try {
      await base44.entities.RelatorioAgendado.delete(relParaDeletar.id);
      await queryClient.refetchQueries({ queryKey: ['relatorios-agendados'] });
      toast.success('Agendamento removido');
      setRelParaDeletar(null);
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setDeletando(false);
    }
  };

  const handleEnviar = async (id) => {
    try {
      const response = await base44.functions.invoke('enviarRelatorioPorEmail', { relatorio_id: id });
      if (response.data.success) {
        toast.success(`Relatório enviado para ${response.data.emailsEnviados.length} pessoa(s)`);
        await queryClient.refetchQueries({ queryKey: ['relatorios-agendados'] });
      } else {
        toast.error(response.data.error);
      }
    } catch (err) {
      toast.error('Erro ao enviar: ' + err.message);
    }
  };

  const handleOpenForm = (relatorio = null) => {
    setSelectedRelatorio(relatorio);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios Agendados</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie relatórios periódicos das obras</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Tabela de agendamentos */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={8} />
          ) : relatorios.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              Nenhum relatório agendado
            </div>
          ) : (
            <>
              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {relatoriosPag.map(rel => (
                  <div key={rel.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{rel.nome}</p>
                        <p className="text-xs text-gray-500">{rel.obra_nome || '—'}</p>
                      </div>
                      {rel.ativa
                        ? <Badge className="bg-green-100 text-green-700 border-0 flex-shrink-0">Ativo</Badge>
                        : <Badge className="bg-gray-100 text-gray-600 border-0 flex-shrink-0">Inativo</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                      <div className="capitalize"><span className="text-gray-400">Frequência: </span>{rel.frequencia || '—'}</div>
                      <div><span className="text-gray-400">Hora: </span>{rel.hora_envio || '—'}</div>
                      <div><span className="text-gray-400">Destinatários: </span>{rel.stakeholders?.length || 0}</div>
                      <div><span className="text-gray-400">Próx.: </span>{rel.proximo_envio ? new Date(rel.proximo_envio).toLocaleDateString('pt-BR') : '—'}</div>
                    </div>
                    <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => handleOpenForm(rel)}><Edit2 className="w-4 h-4" /> Editar</Button>
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-blue-600" onClick={() => handleEnviar(rel.id)}><Send className="w-4 h-4" /> Enviar</Button>
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setRelParaDeletar(rel)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Nome</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Frequência</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500">Hora</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500">Destinatários</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500">Próximo Envio</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {relatoriosPag.map(rel => (
                      <tr key={rel.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{rel.nome}</td>
                        <td className="p-3 text-gray-600">{rel.obra_nome || '-'}</td>
                        <td className="p-3 text-gray-600 capitalize">{rel.frequencia || '-'}</td>
                        <td className="p-3 text-center text-gray-600">{rel.hora_envio || '-'}</td>
                        <td className="p-3 text-center text-gray-600">{rel.stakeholders?.length || 0}</td>
                        <td className="p-3 text-center text-gray-600">{rel.proximo_envio ? new Date(rel.proximo_envio).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="p-3 text-center">
                          {rel.ativa
                            ? <Badge className="bg-green-100 text-green-700 border-0">Ativo</Badge>
                            : <Badge className="bg-gray-100 text-gray-600 border-0">Inativo</Badge>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar" onClick={() => handleOpenForm(rel)}>
                              <Edit2 className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Enviar por e-mail agora" onClick={() => handleEnviar(rel.id)}>
                              <Send className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Excluir" onClick={() => setRelParaDeletar(rel)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!relParaDeletar} onOpenChange={(o) => { if (!o) setRelParaDeletar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{relParaDeletar?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarDelete(); }} disabled={deletando} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              {deletando ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Formulário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRelatorio ? 'Editar Relatório' : 'Novo Relatório Agendado'}
            </DialogTitle>
          </DialogHeader>
          <FormRelatorioAgendado
            relatorio={selectedRelatorio}
            onClose={() => {
              setDialogOpen(false);
              setSelectedRelatorio(null);
            }}
            onSuccess={() => {
              queryClient.refetchQueries({ queryKey: ['relatorios-agendados'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}