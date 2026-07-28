import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { AlertTriangle, CheckCircle2, Truck, Wrench, Clock, BarChart3, TrendingDown, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import SafeStatCard from '@/components/dashboard/SafeStatCard';

export default function DashboardObrasOperacional() {
  return (
    <div>
      <RouteGuardFinalV2 requiredPermissionKey="DASHBOARD_VIEW">
        <DashboardOperacionalContent />
      </RouteGuardFinalV2>
    </div>
  );
}

function DashboardOperacionalContent() {
  const navigate = useNavigate();

  // Dados necessários
  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes-dashboard'],
    queryFn: () => base44.entities.Medicao.list('-updated_date', 100)
  });

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes-dashboard'],
    queryFn: () => base44.entities.Manutencao.list('-updated_date', 100)
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-dashboard'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: estoques = [] } = useQuery({
    queryKey: ['estoques-dashboard'],
    queryFn: () => base44.entities.EstoqueObra.list()
  });

  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-dashboard'],
    queryFn: () => base44.entities.DiarioObra.list('-updated_date', 50)
  });

  // Cálculos operacionais
  const medicoesPendentes = medicoes.filter(m => m.status === 'rascunho').length;
  const medicoesAprovadas = medicoes.filter(m => m.status === 'aprovada').length;
  const estoqueBaixo = estoques.filter(e => e.saldo < (e.quantidade_minima || 0)).length;
  const manutencaAtrasada = manutencoes.filter(m => m.status === 'agendada' && new Date(m.data_entrada) < new Date()).length;
  const veiculosManutencao = veiculos.filter(v => v.status === 'manutencao').length;

  const diagnosticosRecentes = [
    { icone: '', titulo: 'Medições Pendentes', valor: medicoesPendentes, cor: 'text-orange-600', bgCor: 'bg-orange-50', rota: '/Medicoes' },
    { icone: '', titulo: 'Medições Aprovadas', valor: medicoesAprovadas, cor: 'text-green-600', bgCor: 'bg-green-50', rota: '/Medicoes' },
    { icone: '', titulo: 'Itens com Estoque Baixo', valor: estoqueBaixo, cor: 'text-red-600', bgCor: 'bg-red-50', rota: '/Estoque' },
    { icone: '', titulo: 'Manutenções Atrasadas', valor: manutencaAtrasada, cor: 'text-red-600', bgCor: 'bg-red-50', rota: '/Manutencoes' },
    { icone: '', titulo: 'Veículos em Manutenção', valor: veiculosManutencao, cor: 'text-amber-600', bgCor: 'bg-amber-50', rota: '/Frota' },
  ];

  const alertasCriticos = diagnosticosRecentes.filter(d => d.valor > 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Operacional</h1>
          <p className="text-gray-600 mt-1">Acompanhamento de operações e atividades em campo</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/Medicoes')} variant="outline">
            Ver Medições
          </Button>
          <Button onClick={() => navigate('/DiarioObra')} className="bg-blue-600 hover:bg-blue-700">
            Novo Diário
          </Button>
        </div>
      </div>

      {/* Cards Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {diagnosticosRecentes.map((item) => (
          <div
            key={item.titulo}
            onClick={() => navigate(item.rota)}
            className={`${item.bgCor} rounded-lg p-4 cursor-pointer hover:shadow-md transition-all border border-gray-200`}
          >
            <div className="text-2xl mb-2">{item.icone}</div>
            <p className="text-xs text-gray-600 mb-1">{item.titulo}</p>
            <p className={`text-2xl font-bold ${item.cor}`}>{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Alertas Críticos */}
      {alertasCriticos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Pendências Operacionais</h3>
          </div>
          <div className="space-y-2">
            {alertasCriticos.map((alerta) => (
              <div
                key={alerta.titulo}
                onClick={() => navigate(alerta.rota)}
                className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-red-50 transition-colors border border-red-100"
              >
                <span className="text-sm text-gray-700">{alerta.titulo}</span>
                <span className="font-bold text-red-600">{alerta.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diários Recentes */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Diários de Obra Recentes
          </h3>
          <Button
            onClick={() => navigate('/DiarioObra')}
            variant="ghost"
            className="text-sm"
          >
            Ver todos →
          </Button>
        </div>
        <div className="space-y-3">
          {diarios.slice(0, 5).map((diario) => (
            <div
              key={diario.id}
              onClick={() => navigate(`/DiarioObra?id=${diario.id}`)}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-100"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {new Date(diario.data || diario.created_date).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-xs text-gray-500">{diario.atividades_realizadas?.substring(0, 50) || 'Diário registrado'}...</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {diario.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
              </Badge>
            </div>
          ))}
          {diarios.length === 0 && (
            <p className="text-center text-gray-400 py-6">Nenhum diário registrado</p>
          )}
        </div>
      </div>

      {/* Grid de Atalhos Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          onClick={() => navigate('/Medicoes')}
          className="cursor-pointer hover:shadow-lg transition-all"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Medições</p>
                <p className="font-bold text-lg">{medicoes.length}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {medicoesPendentes} pendentes • {medicoesAprovadas} aprovadas
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('/Frota')}
          className="cursor-pointer hover:shadow-lg transition-all"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Truck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Frota</p>
                <p className="font-bold text-lg">{veiculos.length}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {veiculosManutencao} em manutenção
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}