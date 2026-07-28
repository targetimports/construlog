import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function OpsApprovalsTable({ approvals = [], onRefresh }) {
  const [deciding, setDeciding] = useState(null);

  const getStatusBadge = (approval) => {
    const baseClass = 'text-xs font-medium';
    
    if (approval.status === 'pendente') {
      const isExpired = new Date(approval.expires_at_iso) < new Date();
      if (isExpired) {
        return <Badge className={`${baseClass} bg-gray-200 text-gray-800`}>EXPIRADA</Badge>;
      }
      const remaining = Math.ceil((new Date(approval.expires_at_iso) - new Date()) / 60000);
      return <Badge className={`${baseClass} bg-orange-100 text-orange-800`}>PENDENTE ({remaining}m)</Badge>;
    }
    
    if (approval.status === 'aprovada') {
      return <Badge className={`${baseClass} bg-green-100 text-green-800`}>APROVADA</Badge>;
    }
    
    if (approval.status === 'rejeitada') {
      return <Badge className={`${baseClass} bg-red-100 text-red-800`}>REJEITADA</Badge>;
    }
    
    if (approval.status === 'executada') {
      return <Badge className={`${baseClass} bg-blue-100 text-blue-800`}>EXECUTADA</Badge>;
    }

    return <Badge className={`${baseClass} bg-gray-100 text-gray-800`}>{approval.status}</Badge>;
  };

  const handleApprove = async (approval) => {
    setDeciding(approval.id);
    try {
      const res = await base44.functions.invoke('aprovarOpsAprovacao', {
        aprovacao_id: approval.id,
        decisao: 'aprovar'
      });
      if (res.data?.ok) {
        toast.success(`✓ Aprovado (${res.data.approvers_count}/${res.data.approvals_required})`);
        onRefresh?.();
      } else {
        toast.error(res.data?.error || 'Erro na aprovação');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setDeciding(null);
    }
  };

  const handleReject = async (approval) => {
    setDeciding(approval.id);
    try {
      const res = await base44.functions.invoke('aprovarOpsAprovacao', {
        aprovacao_id: approval.id,
        decisao: 'rejeitar',
        motivo: 'Rejected via UI'
      });
      if (res.data?.ok) {
        toast.success('✓ Rejeitado');
        onRefresh?.();
      } else {
        toast.error(res.data?.error || 'Erro na rejeição');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setDeciding(null);
    }
  };

  if (!approvals || approvals.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Nenhuma aprovação pendente
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval) => (
        <Card key={approval.id}>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-5 gap-4 items-center">
              {/* Tipo */}
              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-semibold">TIPO</p>
                <p className="font-mono text-sm">{approval.tipo}</p>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-semibold">STATUS</p>
                {getStatusBadge(approval)}
              </div>

              {/* Aprovadores */}
              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-semibold">APROVAÇÕES</p>
                <p className="text-sm">
                  <span className="font-bold text-green-600">{approval.approvers?.length || 0}</span>
                  <span className="text-gray-500">/{approval.approvals_required}</span>
                </p>
              </div>

              {/* Solicitante */}
              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-semibold">SOLICITANTE</p>
                <p className="text-sm text-gray-700">{approval.requested_by_email}</p>
              </div>

              {/* Ações */}
              <div className="flex gap-2 justify-end">
                {approval.status === 'pendente' && !approval.expired && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(approval)}
                      disabled={deciding === approval.id}
                      className="gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(approval)}
                      disabled={deciding === approval.id}
                      className="gap-1 text-red-600"
                    >
                      <XCircle className="w-3 h-3" />
                      Rejeitar
                    </Button>
                  </>
                )}
                {approval.expired && (
                  <span className="text-xs text-gray-500">Expirada</span>
                )}
              </div>
            </div>

            {/* Detalhes expandidos */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-1">
                <span className="font-semibold">Motivo:</span> {approval.motivo || '—'}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Alvo:</span> {JSON.stringify(approval.alvo).substring(0, 80)}...
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}