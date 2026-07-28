import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, AlertCircle, ClipboardList, CheckCircle, Clock, XCircle, Camera, Eye, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import OfflineSyncBanner from '@/components/logistica/OfflineSyncBanner';
import { useSyncQueue } from '@/components/shared/hooks/useSyncQueue';
import { useOfflineInspections } from '@/components/shared/hooks/useOfflineInspections';
import { useOfflineVehicles } from '@/components/shared/hooks/useOfflineVehicles';
import { getPhotosForInspection, deleteInspectionOffline } from '@/components/shared/db/offlineDatabase';
import InspectionForm from '@/components/logistica/InspectionForm';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

const ITENS_POR_PAGINA = 15;

const syncConfig = {
  synced: { label: 'Sincronizada', color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  error: { label: 'Erro', color: 'bg-red-100 text-red-700' }
};
const syncBadge = (s) => syncConfig[s] || { label: s || '—', color: 'bg-gray-100 text-gray-700' };

function FrotaVistoriasContent() {
  const { syncStatus, processSyncQueue, isOnline } = useSyncQueue();
  const { inspections, loading, reload } = useOfflineInspections();
  const { vehicles, loading: vehiclesLoading } = useOfflineVehicles();
  const [showForm, setShowForm] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [fotosDetalhe, setFotosDetalhe] = useState([]);
  const [excluir, setExcluir] = useState(null);

  const handleInspectionSaved = () => { setShowForm(false); reload(); };

  const abrirDetalhe = async (insp) => {
    setDetalhe(insp);
    try { setFotosDetalhe(await getPhotosForInspection(insp.id_local)); }
    catch { setFotosDetalhe([]); }
  };

  const confirmarExclusao = async () => {
    const ok = await deleteInspectionOffline(excluir.id_local);
    setExcluir(null);
    if (ok) { toast.success('Vistoria excluída'); reload(); }
    else toast.error('Erro ao excluir vistoria');
  };

  const sincronizarAgora = async () => {
    if (!isOnline) { toast.error('Sem internet — sincronize quando estiver online'); return; }
    try { await processSyncQueue(); reload(); }
    catch { /* o banner já mostra o erro de sync */ }
  };

  const veiculoLabel = useMemo(() => {
    const m = new Map((vehicles || []).map(v => [v.id, v]));
    return (id) => m.get(id);
  }, [vehicles]);

  const stats = useMemo(() => ({
    total: inspections.length,
    sincronizadas: inspections.filter(i => i.status_sync === 'synced').length,
    pendentes: inspections.filter(i => i.status_sync === 'pending').length,
    erro: inspections.filter(i => i.status_sync === 'error').length
  }), [inspections]);

  const pag = usePagination(inspections, ITENS_POR_PAGINA);

  return (
    <>
      <OfflineSyncBanner
        isOnline={isOnline}
        isSyncing={syncStatus.isSyncing}
        pendingCount={syncStatus.pendingCount}
        lastError={syncStatus.lastError}
        onSyncNow={processSyncQueue}
      />

      <div className={`space-y-6 ${syncStatus.pendingCount > 0 ? 'pt-16' : 'pt-0'}`}>
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vistorias Diárias</h1>
            <p className="text-gray-500 mt-1">Gerencie vistorias de veículos com suporte offline</p>
          </div>
          <div className="flex gap-2">
            {stats.pendentes + stats.erro > 0 && (
              <Button onClick={sincronizarAgora} variant="outline" disabled={syncStatus.isSyncing || !isOnline} className="gap-2 border-gray-300 text-gray-700">
                <RefreshCw className={`w-4 h-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                {syncStatus.isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            )}
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nova Vistoria
            </Button>
          </div>
        </div>

        {/* Aviso offline sem cache */}
        {!isOnline && vehicles.length === 0 && (
          <Card className="border-amber-200 bg-amber-50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Sem internet e sem cache de veículos</p>
                  <p className="text-sm text-amber-700 mt-1">Conecte-se à internet uma vez para baixar a lista de veículos.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
                <div className="p-2.5 rounded-xl bg-gray-100"><ClipboardList className="w-6 h-6 text-gray-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Sincronizadas</p><p className="text-2xl font-bold text-emerald-600">{stats.sincronizadas}</p></div>
                <div className="p-2.5 rounded-xl bg-emerald-50"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Pendentes</p><p className="text-2xl font-bold text-amber-600">{stats.pendentes}</p></div>
                <div className="p-2.5 rounded-xl bg-amber-50"><Clock className="w-6 h-6 text-amber-600" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-600">Com Erro</p><p className="text-2xl font-bold text-red-600">{stats.erro}</p></div>
                <div className="p-2.5 rounded-xl bg-red-50"><XCircle className="w-6 h-6 text-red-600" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de vistorias */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-0">
            {(loading || vehiclesLoading) ? (
              <TableSkeleton bare rows={6} cols={6} />
            ) : inspections.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                <ClipboardList className="w-10 h-10" />
                <p className="text-sm text-gray-500">Nenhuma vistoria criada ainda</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Veículo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Placa</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Fotos</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pag.paginatedItems.map((insp) => {
                        const v = veiculoLabel(insp.vehicle_id);
                        const sb = syncBadge(insp.status_sync);
                        return (
                          <tr key={insp.id_local} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{v?.nome || v?.placa || 'Veículo desconhecido'}</td>
                            <td className="px-4 py-3 text-gray-600">{v?.placa || '—'}</td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {insp.photos?.length > 0 ? (
                                <span className="inline-flex items-center gap-1"><Camera className="w-3.5 h-3.5 text-gray-400" />{insp.photos.length}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{insp.created_at ? new Date(insp.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="px-4 py-3 text-center"><Badge className={`border-0 ${sb.color}`}>{sb.label}</Badge></td>
                            <td className="px-4 py-3">
                              <TooltipProvider delayDuration={200}>
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => abrirDetalhe(insp)}>
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver detalhes</TooltipContent>
                                  </Tooltip>
                                  {insp.status_sync !== 'synced' && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setExcluir(insp)}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Excluir</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TooltipProvider>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage} startIndex={pag.startIndex} endIndex={pag.endIndex} totalItems={pag.totalItems} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Nova Vistoria */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Vistoria</DialogTitle></DialogHeader>
          {showForm && (
            <InspectionForm vehicles={vehicles} onSaved={handleInspectionSaved} onCancel={() => setShowForm(false)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes da Vistoria */}
      <Dialog open={!!detalhe} onOpenChange={(open) => { if (!open) { setDetalhe(null); setFotosDetalhe([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da Vistoria</DialogTitle></DialogHeader>
          {detalhe && (() => {
            const v = veiculoLabel(detalhe.vehicle_id);
            const sb = syncBadge(detalhe.status_sync);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500 uppercase">Veículo</p><p className="font-medium text-gray-900">{v?.nome || v?.placa || '—'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase">Placa</p><p className="font-medium text-gray-900">{v?.placa || '—'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase">Data</p><p className="font-medium text-gray-900">{detalhe.created_at ? new Date(detalhe.created_at).toLocaleString('pt-BR') : '—'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase">Status</p><Badge className={`border-0 ${sb.color}`}>{sb.label}</Badge></div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Fotos ({fotosDetalhe.length})</p>
                  {fotosDetalhe.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhuma foto.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {fotosDetalhe.map((f) => (
                        <img key={f.id_local} src={f.blob_url} alt="foto da vistoria" className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir vistoria?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta vistoria {excluir?.status_sync === 'pending' ? 'ainda não foi sincronizada' : 'está local'} e será removida do dispositivo. Esta ação é irreversível.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function FrotaVistorias() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="LOGISTICA_VIEW">
      <FrotaVistoriasContent />
    </RouteGuardFinalV2>
  );
}
