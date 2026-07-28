import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, Navigation, Plus, Check, Clock, AlertCircle, Car, Gauge, Eye, X, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ChecklistSaidaVeiculo from '@/components/logistica/ChecklistSaidaVeiculo';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

const statusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700', icon: Clock },
  checklist_pendente: { label: 'Checklist Pendente', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700', icon: Navigation },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700', icon: Check },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: X }
};

export default function RotasMotorista() {
  const [dialogNovaRota, setDialogNovaRota] = useState(false);
  const [checklistRota, setChecklistRota] = useState(null);
  const [detalhesRota, setDetalhesRota] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    veiculo_id: '',
    endereco_origem: '',
    endereco_destino: '',
    data_planejada: new Date().toISOString().split('T')[0],
    hora_saida_prevista: '',
    motivo: '',
    frequencia: 'unica',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 50)
  });

  const { data: rotas = [], isLoading } = useQuery({
    queryKey: ['rotas-motorista', user?.email],
    queryFn: () => base44.entities.RotaMotorista.filter(
      { motorista_email: user.email },
      '-created_date',
      50
    ),
    enabled: !!user?.email
  });

  const { data: veiculosAtivos = [] } = useQuery({
    queryKey: ['veiculos-ativos'],
    queryFn: () => base44.entities.Veiculo.filter({ status: 'ativo' })
  });

  // Busca detalhes do veículo para o checklist
  const veiculoDoChecklist = checklistRota
    ? veiculosAtivos.find(v => v.id === checklistRota.veiculo_id)
    : null;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RotaMotorista.create({
      ...data,
      motorista_email: user.email,
      status: 'planejada'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
      toast.success('Rota criada com sucesso!');
      resetForm();
    },
    onError: (err) => toast.error('Erro ao criar rota: ' + err.message)
  });

  const iniciarChecklistMutation = useMutation({
    mutationFn: (rotaId) => base44.entities.RotaMotorista.update(rotaId, {
      status: 'checklist_pendente'
    }),
    onSuccess: (_, rotaId) => {
      queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
      const rota = rotas.find(r => r.id === rotaId);
      setChecklistRota(rota ? { ...rota, status: 'checklist_pendente' } : null);
    }
  });

  const concluirMutation = useMutation({
    mutationFn: async ({ rotaId, kmChegada, fotoPainelUrl }) => {
      return base44.entities.RotaMotorista.update(rotaId, {
        status: 'concluida',
        km_chegada: parseFloat(kmChegada),
        foto_painel_km_chegada_url: fotoPainelUrl,
        data_hora_chegada: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
      toast.success('Viagem concluída!');
      setDetalhesRota(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.veiculo_id || !formData.endereco_destino || !formData.data_planejada) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const veiculo = veiculosAtivos.find(v => v.id === formData.veiculo_id);
    createMutation.mutate({
      ...formData,
      veiculo_placa: veiculo ? `${veiculo.placa} - ${veiculo.modelo}` : ''
    });
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      veiculo_id: '',
      endereco_origem: '',
      endereco_destino: '',
      data_planejada: new Date().toISOString().split('T')[0],
      hora_saida_prevista: '',
      motivo: '',
      frequencia: 'unica',
      observacoes: ''
    });
    setDialogNovaRota(false);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Rotas</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie suas rotas e viagens</p>
        </div>
        <Button onClick={() => setDialogNovaRota(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Rota
        </Button>
      </div>

      {/* Lista de Rotas */}
      {isLoading ? (
        <CardGridSkeleton count={4} cols="" />
      ) : rotas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma rota criada</p>
            <p className="text-gray-400 text-sm mt-1">Crie uma nova rota para começar</p>
            <Button className="mt-4" onClick={() => setDialogNovaRota(true)}>
              <Plus className="w-4 h-4 mr-2" /> Criar Rota
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rotas.map(rota => {
            const cfg = statusConfig[rota.status] || statusConfig.planejada;
            const StatusIcon = cfg.icon;
            const veiculo = veiculosAtivos.find(v => v.id === rota.veiculo_id);

            return (
              <Card key={rota.id} className={`border ${rota.status === 'em_andamento' ? 'border-amber-400 shadow-md' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{rota.nome || rota.endereco_destino}</p>
                        <Badge className={cfg.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{rota.endereco_origem || 'Origem não definida'} → {rota.endereco_destino}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>{rota.veiculo_placa || veiculo?.placa || 'Veículo'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>
                            {new Date(rota.data_planejada).toLocaleDateString('pt-BR')}
                            {rota.hora_saida_prevista && ` às ${rota.hora_saida_prevista}`}
                          </span>
                        </div>
                      </div>

                      {/* Indicadores de foto */}
                      {(rota.foto_painel_km_url || rota.foto_carroceria_url) && (
                        <div className="flex gap-2 mt-2">
                          {rota.foto_painel_km_url && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Gauge className="w-3 h-3" /> Painel ✓
                            </span>
                          )}
                          {rota.foto_carroceria_url && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Car className="w-3 h-3" /> Carroceria ✓
                            </span>
                          )}
                          {rota.km_saida && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              KM saída: {rota.km_saida.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {rota.status === 'planejada' && (
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => iniciarChecklistMutation.mutate(rota.id)}
                          disabled={iniciarChecklistMutation.isPending}
                        >
                          <Camera className="w-4 h-4 mr-1" />
                          Sair
                        </Button>
                      )}
                      {rota.status === 'checklist_pendente' && (
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => setChecklistRota(rota)}
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Checklist
                        </Button>
                      )}
                      {rota.status === 'em_andamento' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setDetalhesRota(rota)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Chegada
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetalhesRota(rota)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Checklist Obrigatório de Saída */}
      {checklistRota && (
        <ChecklistSaidaVeiculo
          rota={checklistRota}
          veiculo={veiculoDoChecklist || { placa: checklistRota.veiculo_placa || '', modelo: '' }}
          onConcluido={() => {
            setChecklistRota(null);
            queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
          }}
          onClose={() => setChecklistRota(null)}
        />
      )}

      {/* Dialog Detalhes / Chegada */}
      {detalhesRota && (
        <DialogDetalhes
          rota={detalhesRota}
          veiculo={veiculosAtivos.find(v => v.id === detalhesRota.veiculo_id)}
          onConcluir={concluirMutation.mutate}
          onClose={() => setDetalhesRota(null)}
          isPending={concluirMutation.isPending}
        />
      )}

      {/* Dialog Nova Rota */}
      <Dialog open={dialogNovaRota} onOpenChange={setDialogNovaRota}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Rota</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome / Descrição da Rota</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Entrega na obra Central"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Veículo *</Label>
              <Select value={formData.veiculo_id} onValueChange={(v) => setFormData({ ...formData, veiculo_id: v })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o veículo disponível" />
                </SelectTrigger>
                <SelectContent>
                  {veiculosAtivos.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.modelo} ({v.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.data_planejada}
                  onChange={(e) => setFormData({ ...formData, data_planejada: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Hora de Saída</Label>
                <Input
                  type="time"
                  value={formData.hora_saida_prevista}
                  onChange={(e) => setFormData({ ...formData, hora_saida_prevista: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>Endereço de Origem</Label>
              <Input
                value={formData.endereco_origem}
                onChange={(e) => setFormData({ ...formData, endereco_origem: e.target.value })}
                placeholder="Local de saída"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Endereço de Destino *</Label>
              <Input
                value={formData.endereco_destino}
                onChange={(e) => setFormData({ ...formData, endereco_destino: e.target.value })}
                placeholder="Para onde vai?"
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label>Motivo da Viagem</Label>
              <Input
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ex: Entrega de material, visita técnica..."
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequência</Label>
                <Select value={formData.frequencia} onValueChange={(v) => setFormData({ ...formData, frequencia: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais"
                className="mt-1.5"
              />
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <strong>Atenção:</strong> Ao iniciar a viagem, será obrigatório tirar foto do painel (quilometragem) e da carroceria do veículo.
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</> : 'Criar Rota'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente de detalhes / registro de chegada
function DialogDetalhes({ rota, veiculo, onConcluir, onClose, isPending }) {
  const [kmChegada, setKmChegada] = useState('');
  const [fotoPainelChegadaUrl, setFotoPainelChegadaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef();

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoPainelChegadaUrl(file_url);
      toast.success('Foto enviada!');
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Rota</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-semibold text-blue-900">{rota.nome || rota.endereco_destino}</p>
            <p className="text-sm text-blue-700 mt-1">{rota.endereco_origem} → {rota.endereco_destino}</p>
            {veiculo && <p className="text-sm text-blue-600 mt-1"><Car className="inline w-3 h-3 mr-1" />{veiculo.placa} — {veiculo.modelo}</p>}
          </div>

          {/* Fotos da saída */}
          {(rota.foto_painel_km_url || rota.foto_carroceria_url) && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Registros da Saída:</p>
              <div className="grid grid-cols-2 gap-3">
                {rota.foto_painel_km_url && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Painel (saída)</p>
                    <img src={rota.foto_painel_km_url} alt="Painel saída" className="w-full h-28 object-cover rounded-lg border" />
                  </div>
                )}
                {rota.foto_carroceria_url && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Carroceria (saída)</p>
                    <img src={rota.foto_carroceria_url} alt="Carroceria saída" className="w-full h-28 object-cover rounded-lg border" />
                  </div>
                )}
              </div>
              {rota.km_saida && (
                <p className="text-sm text-gray-600 mt-2"><Gauge className="inline w-3.5 h-3.5 mr-1" />KM Saída: <strong>{rota.km_saida.toLocaleString()} km</strong></p>
              )}
            </div>
          )}

          {/* Registro de chegada (apenas se em andamento) */}
          {rota.status === 'em_andamento' && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Registrar Chegada:</p>
              <div>
                <Label>Quilometragem na Chegada</Label>
                <Input
                  type="number"
                  placeholder="KM atual"
                  value={kmChegada}
                  onChange={(e) => setKmChegada(e.target.value)}
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label>Foto do Painel (chegada)</Label>
                {fotoPainelChegadaUrl ? (
                  <img src={fotoPainelChegadaUrl} alt="Painel chegada" className="mt-1.5 w-full h-32 object-cover rounded-lg border-2 border-green-400" />
                ) : (
                  <div
                    className="mt-1.5 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50"
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    ) : (
                      <div className="text-gray-500">
                        <Camera className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs">Foto do painel</p>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => handleUpload(e.target.files[0])} />
                  </div>
                )}
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!kmChegada || isPending}
                onClick={() => onConcluir({ rotaId: rota.id, kmChegada, fotoPainelUrl: fotoPainelChegadaUrl })}
              >
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</> : <><Check className="w-4 h-4 mr-2" /> Registrar Chegada</>}
              </Button>
            </div>
          )}

          <Button variant="outline" onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}