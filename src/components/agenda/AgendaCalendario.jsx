import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AgendaCalendario({ eventos = [], onConcluir, onEditar }) {
  // Agrupar por data - validar dados
  const eventosPorData = {};
  (Array.isArray(eventos) ? eventos : []).forEach(e => {
    if (!e || !e.data_inicio || !e.id) return; // Pular eventos inválidos
    const data = e.data_inicio;
    if (!eventosPorData[data]) {
      eventosPorData[data] = [];
    }
    eventosPorData[data].push(e);
  });

  const prioridadeColors = {
    alta: 'bg-red-100 text-red-800',
    media: 'bg-yellow-100 text-yellow-800',
    baixa: 'bg-green-100 text-green-800'
  };

  const tipoIcons = {
    reuniao: '',
    visita: '',
    prazo: '',
    entrega: '',
    interno: ''
  };

  const statusIcon = (status) => {
    if ((status || '').toLowerCase() === 'concluido' || (status || '').toLowerCase() === 'concluído') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if ((status || '').toLowerCase() === 'cancelado') return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <Circle className="w-4 h-4 text-blue-600" />;
  };

  const isConcluded = (s) => {
    const v = (s || '').toLowerCase();
    return v === 'concluido' || v === 'concluído' || v === 'finalizado' || v === 'completed';
  };

  const getDueInfo = (e) => {
    const due = e?.data_fim || e?.data_inicio;
    if (!due) return { overdue: false, dueSoon: false };
    const now = new Date();
    const end = new Date(due);
    const diffMs = end - now;
    const overdue = diffMs < 0 && !isConcluded(e?.status);
    const dueSoon = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000 && !isConcluded(e?.status);
    return { overdue, dueSoon };
  };

  const datas = Object.keys(eventosPorData).sort();

  return (
    <div className="space-y-4">
      {datas.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          Nenhum evento encontrado no período
        </Card>
      ) : (
        datas.map(data => (
          <Card key={data} className="p-4">
            <div className="font-semibold text-gray-900 mb-3">
              {format(parseISO(data), 'EEEE, dd MMMM', { locale: ptBR })}
            </div>
            <div className="space-y-2">
              {eventosPorData[data].map(e => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  onClick={() => onEditar(e)}
                >
                  <div className="flex-shrink-0">
                    {statusIcon(e.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{tipoIcons[e.tipo]} {e.titulo}</p>
                        {e.local && <p className="text-xs text-gray-600">{e.local}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {getDueInfo(e).overdue && (
                          <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5">Vencido</Badge>
                        )}
                        {!getDueInfo(e).overdue && getDueInfo(e).dueSoon && (
                          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">24h</Badge>
                        )}
                        <Badge className={prioridadeColors[e.prioridade]}>
                          {e.prioridade}
                        </Badge>
                      </div>
                    </div>
                    {e.descricao && <p className="text-xs text-gray-600 mt-1">{e.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}