import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import ChangeRequestFormModal from '../components/ops/ChangeRequestFormModal';
import ChangeRequestApprovalModal from '../components/ops/ChangeRequestApprovalModal';
import { ListSkeleton } from '@/components/shared/Skeletons';

export default function OpsMudancas() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedCR, setSelectedCR] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ['changeRequests', filterStatus],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarOpsChangeRequests', {
        status: filterStatus === 'all' ? undefined : filterStatus
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  const handleApprove = (cr) => {
    setSelectedCR(cr);
    setShowApprovalModal(true);
  };

  const handleCancel = async (crId) => {
    if (!window.confirm('Cancelar este CR?')) return;

    const motivo = prompt('Motivo do cancelamento (mínimo 3 caracteres):');
    if (!motivo || motivo.trim().length < 3) {
      toast.error('Motivo obrigatório com pelo menos 3 caracteres');
      return;
    }

    try {
      const res = await base44.functions.invoke('cancelarOpsChangeRequest', {
        change_id: crId,
        motivo: motivo.trim()
      });
      if (res.data?.ok) {
        toast.success('✓ CR cancelado');
        refetch();
      } else if (res.status === 404) {
        toast.error('CR não encontrado');
      } else if (res.status === 400) {
        toast.error(res.data?.error || 'Dados inválidos');
      } else if (res.status === 409) {
        toast.error(res.data?.error || 'Não pode cancelar neste status');
      } else {
        toast.error(res.data?.error || 'Erro ao cancelar');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
  };

  const statusBadgeColor = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    executing: 'bg-purple-100 text-purple-800',
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
    expired: 'bg-orange-100 text-orange-800'
  };

  const crs = result?.data || [];
  const counts = result?.counts || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mudanças OPS</h1>
          <p className="text-gray-600 mt-1">Gerenciamento de Change Requests</p>
        </div>
        <Button onClick={() => setShowFormModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Mudança
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending_approval', 'approved', 'success', 'failed'].map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? 'default' : 'outline'}
            onClick={() => setFilterStatus(s)}
            size="sm"
          >
            {s === 'all' ? 'Todos' : s.replace('_', ' ')}
            {s !== 'all' && counts[s] && ` (${counts[s]})`}
          </Button>
        ))}
      </div>

      {/* Lista de CRs */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : crs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Nenhuma mudança encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {crs.map((cr) => (
            <Card key={cr.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{cr.tipo}</h3>
                      <Badge className={statusBadgeColor[cr.status]}>
                        {cr.status}
                      </Badge>
                      <Badge variant="outline">{cr.ambiente}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{cr.descricao}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Solicitado por: {cr.requested_by} • {new Date(cr.requested_at_iso).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {cr.status === 'pending_approval' && (
                      <Button
                        onClick={() => handleApprove(cr)}
                        size="sm"
                        variant="outline"
                        className="gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovar
                      </Button>
                    )}
                    {cr.status === 'approved' && (
                      <Button
                        onClick={() => handleApprove(cr)}
                        size="sm"
                        variant="default"
                        className="gap-1"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Executar
                      </Button>
                    )}
                    {['draft', 'pending_approval', 'approved'].includes(cr.status) && (
                      <Button
                        onClick={() => handleCancel(cr.id)}
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status de aprovações */}
                {cr.approved_by && cr.approved_by.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-gray-600">
                      Aprovações: {cr.approved_by.length}/{cr.approvals_required}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      {cr.approved_by.map((a) => (
                        <span key={a.email} className="inline-block mr-3">
                          ✓ {a.email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modais */}
      <ChangeRequestFormModal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSuccess={() => refetch()}
      />

      <ChangeRequestApprovalModal
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        changeRequest={selectedCR}
        onSuccess={() => {
          refetch();
          setSelectedCR(null);
        }}
      />
    </div>
  );
}