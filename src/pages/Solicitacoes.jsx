import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, CheckCircle, X, Eye, Check } from 'lucide-react';

export default function Solicitacoes() {
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('solicitada');
  const [showSucesso, setShowSucesso] = useState(false);
  const queryClient = useQueryClient();

  const { data: solicitacoes } = useQuery({
    queryKey: ['solicitacoes', filterStatus],
    queryFn: () => base44.entities.SolicitacaoTransporte.filter({ status: filterStatus })
  });

  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const aprovarMutation = useMutation({
    mutationFn: (id) => base44.entities.SolicitacaoTransporte.update(id, { 
      status: 'aprovada',
      aprovado_por_user_id: user?.email,
      data_aprovacao: new Date().toISOString()
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => base44.entities.SolicitacaoTransporte.update(id, { status: 'cancelada' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
  });

  const statusColors = {
    solicitada: 'bg-blue-100 text-blue-800',
    aprovada: 'bg-green-100 text-green-800',
    em_execucao: 'bg-yellow-100 text-yellow-800',
    concluida: 'bg-gray-100 text-gray-800',
    cancelada: 'bg-red-100 text-red-800'
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Solicitações de Transporte</h1>
        <p className="text-gray-600">Crie, aprove e gerencie solicitações de transporte</p>
      </div>

      <div className="flex gap-4 flex-wrap items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="solicitada">Solicitadas</option>
          <option value="aprovada">Aprovadas</option>
          <option value="em_execucao">Em Execução</option>
          <option value="concluida">Concluídas</option>
          <option value="">Todas</option>
        </select>

        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      {showForm && (
        <FormSolicitacao
          obras={obras}
          user={user}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            setShowSucesso(true);
          }}
        />
      )}

      {/* Modal de sucesso */}
      <Dialog open={showSucesso} onOpenChange={setShowSucesso}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Solicitação Enviada</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-gray-900">Sua solicitação foi enviada</p>
              <p className="text-sm text-gray-600">Aguarde a aprovação de um supervisor</p>
            </div>
            <Button 
              onClick={() => setShowSucesso(false)} 
              className="w-full bg-green-600 hover:bg-green-700"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {solicitacoes && solicitacoes.length > 0 ? (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Origem → Destino</th>
                  <th className="text-left py-2 px-2">Obra</th>
                  <th className="text-left py-2 px-2">Prioridade</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-center py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.map(sol => {
                  const obra = obras?.find(o => o.id === sol.obra_id);
                  return (
                    <tr key={sol.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-xs">
                        {sol.tipo.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-2 text-xs max-w-xs truncate">
                        {sol.origem} → {sol.destino}
                      </td>
                      <td className="py-2 px-2 text-xs">{obra?.nome || '-'}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                          sol.prioridade === 'urgente' ? 'bg-red-100 text-red-800' :
                          sol.prioridade === 'alta' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {sol.prioridade}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-1 rounded font-bold ${statusColors[sol.status]}`}>
                          {sol.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center flex gap-2 justify-center">
                        <button
                          onClick={() => window.location.href = `/SolicitacaoDetalhes?id=${sol.id}`}
                          className="text-blue-600 hover:text-blue-700"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {sol.status === 'solicitada' && (
                          <>
                            <button
                              onClick={() => aprovarMutation.mutate(sol.id)}
                              className="text-green-600 hover:text-green-700"
                              title="Aprovar"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => window.location.href = `/SolicitacaoDetalhesTransporte?id=${sol.id}`}
                              className="text-red-600 hover:text-red-700"
                              title="Negar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {sol.status === 'cancelada' && sol.motivo_cancelamento && (
                          <button
                            onClick={() => window.location.href = `/SolicitacaoDetalhesTransporte?id=${sol.id}`}
                            className="text-red-600 hover:text-red-700"
                            title="Ver motivo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            Nenhuma solicitação neste status
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FormSolicitacao({ obras, user, onClose, onSuccess }) {
  const [dados, setDados] = React.useState({
    tipo: 'transporte_material',
    obra_id: '',
    origem: '',
    destino: '',
    prioridade: 'media',
    observacoes: ''
  });

  const queryClient = useQueryClient();
  const criar = useMutation({
    mutationFn: () => base44.entities.SolicitacaoTransporte.create({
      ...dados,
      solicitante_user_id: user?.email,
      data_solicitacao: new Date().toISOString(),
      status: 'solicitada',
      numero: `SX-${Date.now()}`
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
      onSuccess?.();
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Solicitação de Transporte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo *</label>
            <select
              value={dados.tipo}
              onChange={(e) => setDados({ ...dados, tipo: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="transporte_material">Transporte de Material</option>
              <option value="entrega_obra">Entrega em Obra</option>
              <option value="retirada_fornecedor">Retirada em Fornecedor</option>
              <option value="atendimento_colaborador">Atendimento a Colaborador</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Obra *</label>
            <select
              value={dados.obra_id}
              onChange={(e) => setDados({ ...dados, obra_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">-- Selecione --</option>
              {obras?.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Origem *</label>
            <input
              type="text"
              value={dados.origem}
              onChange={(e) => setDados({ ...dados, origem: e.target.value })}
              placeholder="Endereço ou local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Destino *</label>
            <input
              type="text"
              value={dados.destino}
              onChange={(e) => setDados({ ...dados, destino: e.target.value })}
              placeholder="Endereço ou local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Prioridade</label>
          <select
            value={dados.prioridade}
            onChange={(e) => setDados({ ...dados, prioridade: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea
            value={dados.observacoes}
            onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || !dados.obra_id}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Criar Solicitação
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}