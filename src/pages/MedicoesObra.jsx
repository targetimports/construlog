import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, CheckCircle, FileText } from 'lucide-react';
import FormMedicaoObra from '../components/medicoes/FormMedicaoObra';
import { createPageUrl } from '@/utils';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function MedicoesObraPage() {
  const [showForm, setShowForm] = useState(false);
  const [filtros, setFiltros] = useState({ obra_id: null, status: null });
  const [obraId, setObraId] = useState('');
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: medicoes = [], isLoading } = useQuery({
    queryKey: ['medicoes-obra', filtros],
    queryFn: async () => {
      const query = {};
      if (filtros.obra_id) query.obra_id = filtros.obra_id;
      if (filtros.status) query.status = filtros.status;
      return base44.entities.MedicaoObra.filter(query);
    }
  });

  const aprovarMutation = useMutation({
    mutationFn: (medicao_id) => base44.functions.invoke('aprovarMedicaoObra', { medicao_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes-obra'] });
    }
  });

  const faturarMutation = useMutation({
    mutationFn: (medicao_id) => base44.functions.invoke('faturarMedicaoObra', { medicao_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes-obra'] });
    }
  });

  const handleAplicarFiltros = () => {
    setFiltros({
      obra_id: obraId || null,
      status: status || null
    });
  };

  const handleLimpar = () => {
    setObraId('');
    setStatus('');
    setFiltros({ obra_id: null, status: null });
  };

  const statusBadge = (s) => {
    const colors = {
      rascunho: 'bg-gray-100 text-gray-700',
      submetida: 'bg-blue-100 text-blue-700',
      aprovada: 'bg-green-100 text-green-700',
      rejeitada: 'bg-red-100 text-red-700',
      faturada: 'bg-purple-100 text-purple-700'
    };
    return colors[s] || 'bg-gray-100 text-gray-700';
  };

  const handleFaturarClick = async (medicao) => {
    if (faturarMutation.isPending) return;
    await faturarMutation.mutate(medicao.id);
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Medições de Obra</h1>
        <p className="text-gray-600">Gestão de medições e faturamento por obra</p>
      </div>

      {/* Formulário */}
      {showForm && (
        <FormMedicaoObra
          onSalvo={(med) => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['medicoes-obra'] });
          }}
        />
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filtros</span>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Nova Medição
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Obra</label>
              <select
                value={obraId}
                onChange={(e) => setObraId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todas as obras</option>
                {obras.map(obra => (
                  <option key={obra.id} value={obra.id}>{obra.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todos</option>
                <option value="rascunho">Rascunho</option>
                <option value="submetida">Submetida</option>
                <option value="aprovada">Aprovada</option>
                <option value="faturada">Faturada</option>
                <option value="rejeitada">Rejeitada</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleAplicarFiltros} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Aplicar
              </Button>
              <Button onClick={handleLimpar} variant="outline" className="flex-1">
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton bare rows={6} cols={5} />
          </CardContent>
        </Card>
      ) : medicoes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            Nenhuma medição encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Número</th>
                <th className="px-4 py-3 text-left font-semibold">Período</th>
                <th className="px-4 py-3 text-right font-semibold">Valor Medido</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {medicoes.map(med => (
                <tr key={med.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{med.numero}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {med.periodo_inicio} a {med.periodo_fim}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    R$ {med.valor_total_medido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge(med.status)}`}>
                      {med.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {med.status === 'rascunho' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aprovarMutation.mutate(med.id)}
                        disabled={aprovarMutation.isPending}
                      >
                        Aprovar
                      </Button>
                    )}
                    {med.status === 'aprovada' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFaturarClick(med)}
                        disabled={faturarMutation.isPending}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Faturar
                      </Button>
                    )}
                    {med.status === 'faturada' && (
                      <span className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Faturada
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}