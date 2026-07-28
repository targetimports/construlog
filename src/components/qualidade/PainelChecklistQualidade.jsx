import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle2, Clock, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  concluído: { label: 'Concluído', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  falho: { label: 'Falho', color: 'bg-red-100 text-red-800', icon: AlertCircle }
};

export default function PainelChecklistQualidade({ checklists = [], loading = false, onRefresh }) {
  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');

  const checklistsFiltrados = checklists.filter(c => {
    const matchTexto = !filtro || c.nome?.toLowerCase().includes(filtro.toLowerCase()) || c.obra_id?.includes(filtro);
    const matchStatus = statusFiltro === 'todos' || c.status === statusFiltro;
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
            placeholder="Buscar checklist..."
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
          <option value="concluído">Concluído</option>
          <option value="pendente">Pendente</option>
          <option value="falho">Falho</option>
        </select>
        <Button onClick={onRefresh} variant="outline" className="px-3">
          Atualizar
        </Button>
      </div>

      {/* Lista */}
      {checklistsFiltrados.length > 0 ? (
        <div className="grid gap-3">
          {checklistsFiltrados.map((checklist) => {
            const config = STATUS_CONFIG[checklist.status] || STATUS_CONFIG.pendente;
            const Icon = config.icon;
            const itens = checklist.itens || [];
            const itensCompletos = itens.filter(i => i.atendido).length;
            const percentual = itens.length > 0 ? ((itensCompletos / itens.length) * 100).toFixed(0) : 0;

            return (
              <Card key={checklist.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4" />
                        <h3 className="font-semibold truncate">{checklist.nome}</h3>
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">
                        Obra: {checklist.obra_id} • Criado em {new Date(checklist.created_date).toLocaleDateString('pt-BR')}
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Itens: {itensCompletos}/{itens.length}</span>
                          <span className="font-semibold">{percentual}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" className="text-xs">
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <p>Nenhum checklist encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}