import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, ChevronRight, AlertCircle, Clock } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AgendaExecutiva() {
  const [periodo, setPeriodo] = useState('7');

  const { data: agenda, isLoading } = useQuery({
    queryKey: ['agenda-executiva', periodo],
    queryFn: () => base44.functions.invoke('getAgendaExecutiva'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda Executiva</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const bloco = agenda?.data?.blocos?.[`${periodo}_dias`] || {};
  const total = bloco.total || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Agenda Executiva
            </CardTitle>
            <CardDescription>Próximos compromissos e vencimentos</CardDescription>
          </div>
          <Badge variant="outline">{total} itens</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="7" onValueChange={setPeriodo}>
          <TabsList className="mb-4">
            <TabsTrigger value="7">7 dias</TabsTrigger>
            <TabsTrigger value="15">15 dias</TabsTrigger>
            <TabsTrigger value="30">30 dias</TabsTrigger>
          </TabsList>

          <TabsContent value={periodo} className="space-y-4">
            {/* Eventos */}
            {bloco.eventos && bloco.eventos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">Eventos</h4>
                <div className="space-y-1">
                  {bloco.eventos.slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="flex-1 font-medium">{e.titulo}</span>
                      <span className="text-xs text-gray-600">
                        {format(parseISO(e.data_inicio), 'dd MMM', { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
                {bloco.eventos.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => window.location.href = createPageUrl('Agenda')}
                  >
                    Ver todos <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Contas a Pagar */}
            {bloco.contas_pagar && bloco.contas_pagar.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-semibold text-gray-900">Contas a Pagar</h4>
                <div className="space-y-1">
                  {bloco.contas_pagar.slice(0, 2).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-sm p-2 bg-orange-50 rounded">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <span className="flex-1 font-medium">{c.descricao}</span>
                      <span className="text-xs text-gray-600">R$ {c.valor}</span>
                    </div>
                  ))}
                </div>
                {bloco.contas_pagar.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => window.location.href = createPageUrl('ContasPagar') + `?de=${new Date().toISOString().split('T')[0]}&ate=&status=pendente`}
                  >
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Contas a Receber */}
            {bloco.contas_receber && bloco.contas_receber.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-semibold text-gray-900">Contas a Receber</h4>
                <div className="space-y-1">
                  {bloco.contas_receber.slice(0, 2).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span className="flex-1 font-medium">{c.descricao}</span>
                      <span className="text-xs text-gray-600">R$ {c.valor}</span>
                    </div>
                  ))}
                </div>
                {bloco.contas_receber.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => window.location.href = createPageUrl('ContasReceber') + `?de=${new Date().toISOString().split('T')[0]}&ate=&status=pendente`}
                  >
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Aprovações Pendentes */}
            {bloco.aprovacoes && bloco.aprovacoes.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-semibold text-gray-900">Aprovações Pendentes</h4>
                <div className="space-y-1">
                  {bloco.aprovacoes.slice(0, 2).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-sm p-2 bg-purple-50 rounded">
                      <AlertCircle className="w-4 h-4 text-purple-600" />
                      <span className="flex-1 font-medium">{a.modulo}</span>
                      <span className="text-xs text-gray-600">R$ {a.valor}</span>
                    </div>
                  ))}
                </div>
                {bloco.aprovacoes.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => window.location.href = createPageUrl('Aprovacoes') + '?status=pendente'}
                  >
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {total === 0 && (
              <div className="text-center py-6 text-gray-500">
                <p>Nenhum item programado para este período</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}