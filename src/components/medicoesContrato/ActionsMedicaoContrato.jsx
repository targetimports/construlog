import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { CheckCircle, FileText, Eye } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function ActionsMedicaoContrato({ medicao, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleAprovar = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('aprovarMedicaoContrato', {
        medicao_id: medicao.id
      });
      
      if (result.data.ok) {
        toast.success('Medição aprovada');
        queryClient.invalidateQueries({ queryKey: ['medicoes-contrato'] });
        onRefresh?.();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFaturar = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('faturarMedicaoContrato', {
        medicao_id: medicao.id
      });
      
      if (result.data.ok) {
        toast.success('Medição faturada - Conta a Pagar criada');
        queryClient.invalidateQueries({ queryKey: ['medicoes-contrato'] });
        onRefresh?.();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    const colors = {
      'rascunho': 'bg-gray-100 text-gray-800',
      'aprovada': 'bg-blue-100 text-blue-800',
      'faturada': 'bg-green-100 text-green-800',
      'rejeitada': 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[medicao.status] || 'bg-gray-100'}>{medicao.status}</Badge>;
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge()}
      
      {medicao.status === 'rascunho' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={loading}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aprovar Medição?</AlertDialogTitle>
              <AlertDialogDescription>
                Valor: R$ {medicao.valor_liquido?.toFixed(2)} - Essa ação não pode ser desfeita
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleAprovar}>Aprovar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {medicao.status === 'aprovada' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={loading}>
              <FileText className="h-4 w-4 mr-1" />
              Faturar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Faturar Medição?</AlertDialogTitle>
              <AlertDialogDescription>
                Será criada uma Conta a Pagar de R$ {medicao.valor_liquido?.toFixed(2)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleFaturar}>Faturar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {medicao.conta_pagar_id && (
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => window.location.href = `/ContasPagar?referencia_id=${medicao.conta_pagar_id}`}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver Conta
        </Button>
      )}
    </div>
  );
}