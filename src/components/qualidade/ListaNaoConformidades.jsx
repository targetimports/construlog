import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  aberto: { label: 'Aberto', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  em_andamento: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  resolvido: { label: 'Resolvido', color: 'bg-green-100 text-green-800', icon: CheckCircle2 }
};

export default function ListaNaoConformidades({ naoConformidades = [], loading = false, onRefresh }) {
  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');

  const ncFiltrados = naoConformidades.filter(nc => {
    const matchTexto = !filtro || nc.descricao?.toLowerCase().includes(filtro.toLowerCase()) || nc.obra_id?.includes(filtro);
    const matchStatus = statusFiltro === 'todos' || nc.status === statusFiltro;
    return matchTexto && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar não-conformidade..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="todos">Todos Status</option>
          <option value="aberto">Aberto</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="resolvido">Resolvido</option>
        </select>
        <Button onClick={onRefresh} variant="outline" className="px-3">
          Atualizar
        </Button>
      </div>

      {/* Lista */}
      {ncFiltrados.length > 0 ? (
        <div className="grid gap-3">
          {ncFiltrados.map((nc) => {
            const config = STATUS_CONFIG[nc.status] || STATUS_CONFIG.aberto;
            const Icon = config.icon;

            return (
              <Card key={nc.id} className="border-l-4" style={{ borderLeftColor: nc.status === 'aberto' ? '#dc2626' : nc.status === 'em_andamento' ? '#f59e0b' : '#10b981' }}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <h3 className="font-semibold">{nc.descricao}</h3>
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                        <div>
                          <p className="font-medium">Obra</p>
                          <p>{nc.obra_id || '-'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Severidade</p>
                          <p className={`font-semibold ${nc.severidade === 'crítica' ? 'text-red-600' : nc.severidade === 'maior' ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {nc.severidade || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Reportado</p>
                          <p>{new Date(nc.created_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        {nc.data_resolucao && (
                          <div>
                            <p className="font-medium">Resolvido</p>
                            <p>{new Date(nc.data_resolucao).toLocaleDateString('pt-BR')}</p>
                          </div>
                        )}
                      </div>
                      {nc.causa_raiz && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium text-gray-700">Causa Raiz:</p>
                          <p className="text-gray-600">{nc.causa_raiz}</p>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="text-xs flex-shrink-0">
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <p>Nenhuma não-conformidade encontrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}