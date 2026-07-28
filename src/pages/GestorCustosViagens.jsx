import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, FileText, Plus, Eye, Edit, Trash2, Filter, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GestorCustosViagens() {
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [showFormModal, setShowFormModal] = useState(false);
  const [custoEmEdicao, setCustoEmEdicao] = useState(null);
  const [viagemSelecionada, setViagemSelecionada] = useState(null);

  const { data: viagens } = useQuery({
    queryKey: ['viagens-finalizadas'],
    queryFn: () => base44.entities.Viagem.filter({ status: 'finalizada' })
  });

  const { data: custos } = useQuery({
    queryKey: ['custos-viagens'],
    queryFn: () => base44.entities.CustoViagem.list('-created_date', 200)
  });

  const { data: motoristas } = useQuery({
    queryKey: ['motoristas'],
    queryFn: () => base44.entities.Motorista.list()
  });

  const { data: veiculos } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const viagensSemCusto = viagens?.filter(v => 
    !custos?.some(c => c.viagem_id === v.id)
  ) || [];

  const custosFiltrados = custos?.filter(c => {
    const matchStatus = filtroStatus === 'todas' || 
      (filtroStatus === 'pendente' && c.status === 'pendente') ||
      (filtroStatus === 'aprovado' && c.status === 'aprovado');
    
    const matchCategoria = filtroCategoria === 'todas' || c.categoria === filtroCategoria;
    
    return matchStatus && matchCategoria;
  }) || [];

  const totalCustos = custosFiltrados.reduce((sum, c) => sum + (c.valor_total || 0), 0);
  const totalAbastecimento = custosFiltrados
    .filter(c => c.categoria === 'abastecimento')
    .reduce((sum, c) => sum + (c.valor_total || 0), 0);
  const totalDespesas = custosFiltrados
    .filter(c => c.categoria !== 'abastecimento')
    .reduce((sum, c) => sum + (c.valor_total || 0), 0);

  const handleNovoCusto = (viagem = null) => {
    setCustoEmEdicao(null);
    setViagemSelecionada(viagem);
    setShowFormModal(true);
  };

  const handleEditarCusto = (custo) => {
    setCustoEmEdicao(custo);
    setShowFormModal(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustoViagem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-viagens'] });
      toast.success('Custo removido');
    }
  });

  const getMotorista = (userId) => motoristas?.find(m => m.user_id === userId);
  const getVeiculo = (id) => veiculos?.find(v => v.id === id);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestor de Custos de Viagens</h1>
          <p className="text-gray-600">Gerencie abastecimentos e despesas das viagens</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleNovoCusto()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Custo Manual
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Custos</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Abastecimentos</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {totalAbastecimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Outras Despesas</p>
              <p className="text-2xl font-bold text-orange-600">
                R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Registros</p>
              <p className="text-2xl font-bold text-purple-600">{custosFiltrados.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="custos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="custos">Custos Registrados</TabsTrigger>
          <TabsTrigger value="pendentes">
            Viagens Sem Custo ({viagensSemCusto.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custos" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Status</Label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Label>Categoria</Label>
                  <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="abastecimento">Abastecimento</SelectItem>
                      <SelectItem value="pedagio">Pedágio</SelectItem>
                      <SelectItem value="alimentacao">Alimentação</SelectItem>
                      <SelectItem value="estacionamento">Estacionamento</SelectItem>
                      <SelectItem value="manutencao">Manutenção</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Custos */}
          <div className="grid gap-4">
            {custosFiltrados.map(custo => {
              const viagem = viagens?.find(v => v.id === custo.viagem_id);
              const motorista = getMotorista(viagem?.motorista_user_id);
              const veiculo = getVeiculo(viagem?.veiculo_id);

              return (
                <Card key={custo.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            custo.categoria === 'abastecimento' ? 'bg-green-100 text-green-800' :
                            custo.categoria === 'pedagio' ? 'bg-blue-100 text-blue-800' :
                            custo.categoria === 'alimentacao' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {custo.categoria}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            custo.status === 'aprovado' ? 'bg-green-50 text-green-700' :
                            'bg-yellow-50 text-yellow-700'
                          }`}>
                            {custo.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Viagem</p>
                            <p className="font-bold">{viagem?.numero || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Motorista</p>
                            <p className="font-medium">{motorista?.nome || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Veículo</p>
                            <p className="font-medium">{veiculo?.placa || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Data</p>
                            <p className="font-medium">
                              {custo.data ? new Date(custo.data).toLocaleDateString('pt-BR') : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Valor Total</p>
                            <p className="text-xl font-bold text-blue-600">
                              R$ {(custo.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          {custo.comprovante_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(custo.comprovante_url, '_blank')}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Ver Comprovante
                            </Button>
                          )}
                        </div>

                        {custo.descricao && (
                          <p className="text-sm text-gray-600">{custo.descricao}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditarCusto(custo)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Remover este custo?')) {
                              deleteMutation.mutate(custo.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {custosFiltrados.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum custo encontrado com os filtros aplicados</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pendentes">
          <div className="grid gap-4">
            {viagensSemCusto.map(viagem => {
              const motorista = getMotorista(viagem.motorista_user_id);
              const veiculo = getVeiculo(viagem.veiculo_id);

              return (
                <Card key={viagem.id} className="border-yellow-300">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <p className="font-bold">{viagem.numero}</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Motorista</p>
                            <p className="font-medium">{motorista?.nome || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Veículo</p>
                            <p className="font-medium">{veiculo?.placa || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">KM Rodados</p>
                            <p className="font-medium">{viagem.km_rodados || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      <Button onClick={() => handleNovoCusto(viagem)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Registrar Custo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {viagensSemCusto.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <p>Todas as viagens possuem custos registrados</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Formulário */}
      <FormCustoViagem
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setCustoEmEdicao(null);
          setViagemSelecionada(null);
        }}
        custo={custoEmEdicao}
        viagemPreSelecionada={viagemSelecionada}
      />
    </div>
  );
}

function FormCustoViagem({ open, onClose, custo, viagemPreSelecionada }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    viagem_id: '',
    categoria: 'abastecimento',
    data: new Date().toISOString().split('T')[0],
    valor_total: 0,
    quantidade: null,
    unidade: null,
    descricao: '',
    comprovante_url: null,
    status: 'pendente'
  });

  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (custo) {
      setFormData(custo);
    } else if (viagemPreSelecionada) {
      setFormData(prev => ({
        ...prev,
        viagem_id: viagemPreSelecionada.id
      }));
    }
  }, [custo, viagemPreSelecionada]);

  const { data: viagens } = useQuery({
    queryKey: ['viagens-finalizadas'],
    queryFn: () => base44.entities.Viagem.filter({ status: 'finalizada' })
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (custo) {
        return await base44.entities.CustoViagem.update(custo.id, data);
      } else {
        return await base44.entities.CustoViagem.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-viagens'] });
      toast.success(custo ? 'Custo atualizado' : 'Custo registrado');
      onClose();
    }
  });

  const handleUploadComprovante = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, comprovante_url: file_url }));
      toast.success('Comprovante anexado');
    } catch (error) {
      toast.error('Erro ao anexar comprovante');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!formData.viagem_id) {
      toast.error('Selecione uma viagem');
      return;
    }
    if (!formData.valor_total || formData.valor_total <= 0) {
      toast.error('Informe o valor total');
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {custo ? 'Editar Custo' : 'Registrar Novo Custo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Viagem *</Label>
            <Select
              value={formData.viagem_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, viagem_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a viagem" />
              </SelectTrigger>
              <SelectContent>
                {viagens?.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.numero} - {v.km_rodados || 0} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abastecimento">Abastecimento</SelectItem>
                  <SelectItem value="pedagio">Pedágio</SelectItem>
                  <SelectItem value="alimentacao">Alimentação</SelectItem>
                  <SelectItem value="estacionamento">Estacionamento</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Valor Total (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_total}
                onChange={(e) => setFormData(prev => ({ ...prev, valor_total: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.quantidade || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, quantidade: parseFloat(e.target.value) || null }))}
                placeholder="Ex: 50 (litros)"
              />
            </div>

            <div>
              <Label>Unidade</Label>
              <Select
                value={formData.unidade || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unidade: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="litros">Litros</SelectItem>
                  <SelectItem value="km">KM</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                  <SelectItem value="hora">Hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Detalhes do custo..."
            />
          </div>

          <div>
            <Label>Comprovante (Nota/Recibo)</Label>
            <div className="mt-2 space-y-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadComprovante(file);
                }}
                disabled={uploading}
                className="w-full"
              />
              {uploading && <p className="text-sm text-blue-600">Enviando...</p>}
              {formData.comprovante_url && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FileText className="w-4 h-4" />
                  <a href={formData.comprovante_url} target="_blank" rel="noopener noreferrer" className="underline">
                    Ver comprovante anexado
                  </a>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Custo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}