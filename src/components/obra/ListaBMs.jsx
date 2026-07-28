import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import { formatBRL } from '@/components/shared/moneyBR';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function ListaBMs({ obra_id, contrato_versao_id, onSelectRascunho }) {
  const navigate = useNavigate();

  const { data: bms = [], isLoading } = useQuery({
    queryKey: ['bms', obra_id, contrato_versao_id],
    queryFn: async () => {
      const bmList = await base44.entities.BM.filter({
        obra_id,
        contrato_versao_id,
      });
      return bmList.sort((a, b) => b.numero - a.numero); // Mais recentes primeiro
    },
  });

  const statusColor = {
    RASCUNHO: 'bg-yellow-100 text-yellow-800',
    APROVADA: 'bg-green-100 text-green-800',
    RETIFICADA: 'bg-blue-100 text-blue-800',
  };

  const handleVerDetalhes = (bm) => {
    navigate(createPageUrl('BMDetalhes', `bm_id=${bm.id}`));
    if (bm.status === 'RASCUNHO' && onSelectRascunho) {
      onSelectRascunho(bm.percent_concluida);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!bms.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Boletins de Medição</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-slate-600 py-8">
          Nenhum boletim cadastrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Boletins de Medição ({bms.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {bms.map((bm) => (
            <div
              key={bm.id}
              className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold">BM #{bm.numero}</span>
                  <Badge className={`${statusColor[bm.status]} text-xs`}>
                    {bm.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">
                  {bm.data_inicio && new Date(bm.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                  {bm.data_fim && new Date(bm.data_fim).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>Período: <strong>{formatBRL(bm.total_periodo)}</strong></span>
                  <span>Acumulado: <strong>{formatBRL(bm.total_acumulado)}</strong></span>
                  <span>Progresso: <strong>{(bm.percent_concluida || 0).toFixed(2)}%</strong></span>
                </div>
              </div>
              <Button
                onClick={() => handleVerDetalhes(bm)}
                variant="outline"
                size="sm"
                className="ml-4 gap-2 flex-shrink-0"
              >
                <Eye className="w-4 h-4" />
                Ver
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}