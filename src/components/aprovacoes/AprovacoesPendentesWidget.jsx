import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Clock, ArrowUpRight, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export default function AprovacoesPendentesWidget() {
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['user-widget'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000
  });

  const { data: aprovacoes = [], isLoading } = useQuery({
    queryKey: ['aprovacoes-pendentes-widget'],
    queryFn: () => base44.entities.Aprovacao.filter({ status: 'pendente' }, '-created_date', 20),
    staleTime: 60000,
    refetchInterval: 120000
  });

  // Filtrar só as que o usuário pode aprovar
  const minhasPendentes = aprovacoes.filter(a => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (a.aprovadores_pendentes && a.aprovadores_pendentes.includes(user.email)) return true;
    return false;
  });

  const totalPendentes = minhasPendentes.length;
  const urgentes = minhasPendentes.filter(a => {
    if (!a.prazo_expira_em) return false;
    const horasRestantes = (new Date(a.prazo_expira_em) - new Date()) / (1000 * 60 * 60);
    return horasRestantes < 12;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (totalPendentes === 0) return null;

  return (
    <Card className={cn("border", urgentes.length > 0 ? "border-amber-200 bg-amber-50/30" : "border-gray-200")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Aprovações Pendentes
            <Badge className="bg-blue-100 text-blue-700">{totalPendentes}</Badge>
            {urgentes.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-xs">{urgentes.length} urgente(s)</Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigate(createPageUrl('Aprovacoes'))} className="text-xs gap-1">
            Ver todas <ArrowUpRight className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {minhasPendentes.slice(0, 5).map(aprov => {
            const horasRestantes = aprov.prazo_expira_em
              ? Math.max(0, Math.round((new Date(aprov.prazo_expira_em) - new Date()) / (1000 * 60 * 60)))
              : null;
            const isUrgente = horasRestantes !== null && horasRestantes < 12;

            return (
              <div
                key={aprov.id}
                onClick={() => navigate(createPageUrl('Aprovacoes'))}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  isUrgente ? "bg-amber-50 hover:bg-amber-100" : "bg-gray-50 hover:bg-gray-100"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                  aprov.nivel === 'N1' ? "bg-blue-100 text-blue-700" :
                  aprov.nivel === 'N2' ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {aprov.nivel || 'N1'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{aprov.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span>R$ {(aprov.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span>•</span>
                    <span>{aprov.modulo === 'financeiro' ? '' : ''} {aprov.referencia_tipo}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {isUrgente ? (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{horasRestantes}h</span>
                    </div>
                  ) : horasRestantes !== null ? (
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{horasRestantes}h</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {totalPendentes > 5 && (
            <p className="text-xs text-center text-gray-500 pt-1">
              + {totalPendentes - 5} aprovação(ões) pendente(s)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}