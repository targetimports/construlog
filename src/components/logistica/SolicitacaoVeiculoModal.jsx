import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Send } from 'lucide-react';

export default function SolicitacaoVeiculoModal({ id, onClose, temPermissaoAprovacao, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [modoAprovacao, setModoAprovacao] = useState(false);
  const [modoRejeicao, setModoRejeicao] = useState(false);
  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [motivo, setMotivo] = useState('');

  const { data: solicitacao, isLoading } = useQuery({
    queryKey: ['solicitacao', id],
    queryFn: async () => {
      const todas = await base44.entities.SolicitacaoVeiculo.list();
      return todas.find(s => s.id === id);
    }
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: motoristas = [] } = useQuery({
    queryKey: ['motoristas-lista'],
    queryFn: async () => {
      const todos = await base44.entities.User.list();
      return todos.filter(u => 
        u.cargo?.toLowerCase() === 'motorista' || 
        u.perfil_acesso?.toLowerCase() === 'motorista'
      );
    }
  });

  async function invokeWithRetry(fnName, payload, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await base44.functions.invoke(fnName, payload);
      } catch (error) {
        const is502 = error?.response?.status === 502 || String(error?.message).includes('502') || String(error?.message).includes('Bad Gateway');
        if (is502 && attempt < retries) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw error;
      }
    }
  }

  const enviarMutation = useMutation({
    mutationFn: () => invokeWithRetry('enviarSolicitacaoVeiculo', { solicitacao_id: id }),
    onSuccess,
    onError: (error) => alert('Erro ao enviar: ' + (error?.response?.data?.error || error.message))
  });

  const aprovarMutation = useMutation({
    mutationFn: () => invokeWithRetry('aprovarSolicitacaoVeiculo', {
      solicitacao_id: id,
      veiculo_id: veiculoId,
      motorista_user_id: motoristaId
    }),
    onSuccess,
    onError: (error) => alert('Erro ao aprovar: ' + (error?.response?.data?.error || error.message))
  });

  const rejeitarMutation = useMutation({
    mutationFn: () => invokeWithRetry('rejeitarSolicitacaoVeiculo', {
      solicitacao_id: id,
      motivo
    }),
    onSuccess,
    onError: (error) => alert('Erro ao rejeitar: ' + (error?.response?.data?.error || error.message))
  });

  if (isLoading) {
    return <Dialog open={true} onOpenChange={onClose}><DialogContent>Carregando...</DialogContent></Dialog>;
  }

  if (!solicitacao) {
    return null;
  }

  const statusConfig = {
    rascunho: { color: 'bg-gray-100 text-gray-800', label: 'Rascunho' },
    enviada: { color: 'bg-blue-100 text-blue-800', label: 'Enviada' },
    aprovada: { color: 'bg-green-100 text-green-800', label: 'Aprovada' },
    rejeitada: { color: 'bg-red-100 text-red-800', label: 'Rejeitada' }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {solicitacao.numero}
            <Badge className={statusConfig[solicitacao.status]?.color || 'bg-gray-100'}>
              {statusConfig[solicitacao.status]?.label || solicitacao.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Gerais */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase">Finalidade</p>
                  <p className="font-semibold">{solicitacao.finalidade}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Tipo Vínculo</p>
                  <p className="font-semibold capitalize">{solicitacao.tipo_vinculo?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Urgência</p>
                  <p className="font-semibold capitalize">{solicitacao.urgencia}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Tipo Veículo</p>
                  <p className="font-semibold capitalize">{solicitacao.tipo_veiculo_necessario?.replace('_', ' ')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Localidades */}
          {(solicitacao.origem || solicitacao.destino) && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div>
                  <p className="text-xs text-gray-600 uppercase">Origem</p>
                  <p className="font-semibold">{solicitacao.origem || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Destino</p>
                  <p className="font-semibold">{solicitacao.destino || '-'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Datas */}
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 uppercase">Saída Prevista</p>
                <p className="font-semibold">{new Date(solicitacao.data_saida_prevista).toLocaleString('pt-BR')}</p>
              </div>
              {solicitacao.data_retorno_prevista && (
                <div>
                  <p className="text-xs text-gray-600 uppercase">Retorno Previsto</p>
                  <p className="font-semibold">{new Date(solicitacao.data_retorno_prevista).toLocaleString('pt-BR')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Solicitante e Aprovador */}
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 uppercase">Solicitante</p>
                <p className="font-semibold">{solicitacao.solicitante_user_id}</p>
              </div>
              {solicitacao.aprovado_por_user_id && (
                <div>
                  <p className="text-xs text-gray-600 uppercase">Aprovado por</p>
                  <p className="font-semibold">{solicitacao.aprovado_por_user_id}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Motivo Rejeição */}
          {solicitacao.motivo_rejeicao && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <p className="text-xs text-red-600 uppercase font-semibold mb-2">Motivo Rejeição</p>
                <p className="text-red-800">{solicitacao.motivo_rejeicao}</p>
              </CardContent>
            </Card>
          )}

          {/* Ações - Rascunho */}
          {solicitacao.status === 'rascunho' && (
            <div className="flex gap-2">
              <Button
                onClick={() => enviarMutation.mutate()}
                disabled={enviarMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {enviarMutation.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          )}

          {/* Ações - Enviada (Aprovação) */}
          {solicitacao.status === 'enviada' && temPermissaoAprovacao && (
            <>
              {!modoAprovacao ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setModoAprovacao(true)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aprovar
                  </Button>
                  <Button
                    onClick={() => setModoRejeicao(true)}
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar
                  </Button>
                </div>
              ) : (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">Selecionar Veículo *</label>
                      <select
                        value={veiculoId}
                        onChange={(e) => setVeiculoId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">-- Escolha um veículo --</option>
                        {veiculos.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.placa} - {v.modelo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">Motorista *</label>
                      <select
                        value={motoristaId}
                        onChange={(e) => setMotoristaId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">-- Escolha um motorista --</option>
                        {motoristas.map(m => (
                          <option key={m.email} value={m.email}>
                            {m.full_name || m.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setModoAprovacao(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => aprovarMutation.mutate()}
                        disabled={!veiculoId || !motoristaId || aprovarMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {aprovarMutation.isPending ? 'Aprovando...' : 'Confirmar Aprovação'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Modo Rejeição */}
              {modoRejeicao && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">Motivo da Rejeição *</label>
                      <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg resize-none"
                        placeholder="Descreva o motivo da rejeição..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setModoRejeicao(false); setMotivo(''); }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => rejeitarMutation.mutate()}
                        disabled={!motivo.trim() || rejeitarMutation.isPending}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        {rejeitarMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}