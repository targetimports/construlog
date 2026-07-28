import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, DollarSign, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import CardManutencao from '../components/frota/CardManutencao';
import FormManutencao from '../components/frota/FormManutencao';
import GraficosCustos from '../components/frota/GraficosCustos';
import FormCustoVeiculo from '../components/frota/FormCustoVeiculo';

export default function VeiculoDetalhes() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [formManutencaoAberto, setFormManutencaoAberto] = useState(false);
  const [formCustoAberto, setFormCustoAberto] = useState(false);
  const [manutencaoSelecionada, setManutencaoSelecionada] = useState(null);

  const { data: veiculo } = useQuery({
    queryKey: ['veiculo', id],
    queryFn: () => base44.entities.Veiculo.filter({ id }, '-created_date', 1).then(d => d[0]),
    enabled: !!id
  });

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes', id],
    queryFn: () => base44.entities.ManutencaoVeiculo.filter({ veiculo_id: id }, '-created_date', 100),
    enabled: !!id
  });

  const { data: custos = [] } = useQuery({
    queryKey: ['custos-veiculo', id],
    queryFn: () => base44.entities.CustoVeiculo.filter({ veiculo_id: id }, '-data_custo', 100),
    enabled: !!id
  });

  if (!veiculo) return <div className="text-center py-8 text-gray-400">Veículo não encontrado</div>;

  const manutencoesAgendadas = manutencoes.filter(m => m.status === 'agendada');
  const manutencoesVencidas = manutencoesAgendadas.filter(m => new Date(m.data_agendamento) < new Date());
  const proximaManutencao = manutencoesAgendadas.sort((a, b) => new Date(a.data_agendamento) - new Date(b.data_agendamento))[0];

  const totalGasto = custos.reduce((acc, c) => acc + (c.valor || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={veiculo.marca + ' ' + veiculo.modelo} subtitle={`Placa: ${veiculo.placa}`} />

      {/* Alertas */}
      {(manutencoesVencidas.length > 0 || manutencoesAgendadas.length > 0) && (
        <Card className={`border-l-4 ${manutencoesVencidas.length > 0 ? 'border-l-red-500 bg-red-500/5' : 'border-l-amber-500 bg-amber-500/5'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className={manutencoesVencidas.length > 0 ? 'text-red-400' : 'text-amber-400'} />
              <div className="flex-1">
                {manutencoesVencidas.length > 0 && (
                  <div className="text-red-400 font-medium mb-2">
                    {manutencoesVencidas.length} manutenção(ões) vencida(s)
                  </div>
                )}
                {proximaManutencao && (
                  <div className="text-amber-400 text-sm">
                    Próxima manutenção: {new Date(proximaManutencao.data_agendamento).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-400 mb-2">KM Atual</div>
            <div className="text-2xl font-bold text-white">{veiculo.km_atual?.toLocaleString('pt-BR') || '-'}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-400 mb-2">Status</div>
            <Badge className={veiculo.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}>
              {veiculo.status}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-400 mb-2">Total Gasto</div>
            <div className="text-2xl font-bold text-amber-400">
              {totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-400 mb-2">Manutenções</div>
            <div className="text-2xl font-bold text-white">{manutencoes.length}</div>
            <div className="text-xs text-gray-500 mt-1">{manutencoesAgendadas.length} agendada(s)</div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs defaultValue="manutencoes" className="w-full">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="rastreamento">Rastreamento</TabsTrigger>
        </TabsList>

        {/* Manutenções */}
        <TabsContent value="manutencoes" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={() => {
                setManutencaoSelecionada(null);
                setFormManutencaoAberto(true);
              }}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agendar Manutenção
            </Button>
          </div>

          {manutencoesAgendadas.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-3">Agendadas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {manutencoesAgendadas.map(m => (
                  <CardManutencao key={m.id} manutencao={m} />
                ))}
              </div>
            </div>
          )}

          {manutencoes.filter(m => m.status === 'concluida').length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-3">Histórico</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {manutencoes.filter(m => m.status === 'concluida').slice(0, 6).map(m => (
                  <CardManutencao key={m.id} manutencao={m} />
                ))}
              </div>
            </div>
          )}

          {manutencoes.length === 0 && (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-8 text-center text-gray-500">
                Nenhuma manutenção registrada
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Custos */}
        <TabsContent value="custos" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={() => setFormCustoAberto(true)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Custo
            </Button>
          </div>

          <GraficosCustos custos={custos} />

          {custos.length > 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Últimos Custos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {custos.slice(0, 10).map((custo, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium capitalize">{custo.tipo.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-gray-500">{new Date(custo.data_custo).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <Badge className="bg-blue-500/10 text-blue-400">
                        {custo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rastreamento */}
        <TabsContent value="rastreamento" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-8 text-center text-gray-500">
              Integração de rastreamento GPS em desenvolvimento
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormManutencao 
        open={formManutencaoAberto}
        onOpenChange={setFormManutencaoAberto}
        veiculo={veiculo}
        manutencao={manutencaoSelecionada}
      />

      <FormCustoVeiculo 
        open={formCustoAberto}
        onOpenChange={setFormCustoAberto}
        veiculo={veiculo}
      />
    </div>
  );
}