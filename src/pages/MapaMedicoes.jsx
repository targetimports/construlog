import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import PageHeader from '../components/ui/PageHeader';
import { cn } from '@/lib/utils';

export default function MapaMedicoes() {
  const [obraId, setObraId] = useState('');
  const [mostrarValores, setMostrarValores] = useState(true);
  const [periodo, setPeriodo] = useState('todos');
  const [visaoAtiva, setVisaoAtiva] = useState('preco');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: orcamentos = [], isLoading: loadingOrc } = useQuery({
    queryKey: ['orcamentos', obraId],
    enabled: !!obraId,
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId })
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes', obraId],
    enabled: !!obraId,
    queryFn: () => base44.entities.Medicao.filter({ obra_id: obraId, status: 'aprovada' })
  });

  const mapa = useMemo(() => {
    if (!orcamentos.length || !obraId) return { etapas: [], totalOrcado: 0, totalMedido: 0, totalSaldo: 0 };

    const orcamento = orcamentos[0];
    if (!orcamento.itens) return { etapas: [], totalOrcado: 0, totalMedido: 0, totalSaldo: 0 };

    const etapasMap = {};
    
    // Agrupar itens por etapa
    orcamento.itens.forEach(item => {
      const etapa = item.etapa || 'Sem Etapa';
      if (!etapasMap[etapa]) {
        etapasMap[etapa] = {
          nome: etapa,
          itens: [],
          orcadoPreco: 0,
          orcadoCusto: 0,
          medidoPreco: 0,
          medidoCusto: 0
        };
      }

      const orcadoPreco = item.valor_total || 0;
      const orcadoCusto = item.custo_total || 0;
      etapasMap[etapa].orcadoPreco += orcadoPreco;
      etapasMap[etapa].orcadoCusto += orcadoCusto;

      // Buscar medições
      const medicoesItem = medicoes.filter(m => m.itens?.some(mi => mi.item_orcamento_id === item.id)) || [];
      const medidoPreco = medicoesItem.reduce((acc, m) => {
        const itemMed = m.itens?.find(mi => mi.item_orcamento_id === item.id);
        return acc + (itemMed?.valor_medido || 0);
      }, 0);
      const medidoCusto = medidoPreco * (orcadoCusto / orcadoPreco || 1);

      etapasMap[etapa].medidoPreco += medidoPreco;
      etapasMap[etapa].medidoCusto += medidoCusto;
      etapasMap[etapa].itens.push({
        descricao: item.descricao,
        orcadoPreco,
        orcadoCusto,
        medidoPreco,
        medidoCusto
      });
    });

    const etapas = Object.values(etapasMap);
    const totalOrcado = etapas.reduce((acc, e) => acc + (visaoAtiva === 'preco' ? e.orcadoPreco : e.orcadoCusto), 0);
    const totalMedido = etapas.reduce((acc, e) => acc + (visaoAtiva === 'preco' ? e.medidoPreco : e.medidoCusto), 0);

    return {
      etapas: etapas.sort((a, b) => {
        const progA = (visaoAtiva === 'preco' ? a.medidoPreco : a.medidoCusto) / (visaoAtiva === 'preco' ? a.orcadoPreco : a.orcadoCusto);
        const progB = (visaoAtiva === 'preco' ? b.medidoPreco : b.medidoCusto) / (visaoAtiva === 'preco' ? b.orcadoPreco : b.orcadoCusto);
        return progB - progA;
      }),
      totalOrcado,
      totalMedido,
      totalSaldo: totalOrcado - totalMedido
    };
  }, [orcamentos, medicoes, visaoAtiva, obraId]);

  const getAlertaSeveridade = (percentual) => {
    if (percentual > 100) return { cor: 'bg-red-100 border-red-300', texto: 'text-red-900', emoji: '' };
    if (percentual > 95) return { cor: 'bg-orange-100 border-orange-300', texto: 'text-orange-900', emoji: '' };
    if (percentual > 75) return { cor: 'bg-yellow-100 border-yellow-300', texto: 'text-yellow-900', emoji: '' };
    return { cor: 'bg-green-100 border-green-300', texto: 'text-green-900', emoji: '' };
  };

  if (!obraId) {
    return (
      <div className="space-y-8">
        <PageHeader title="Mapa de Medições" subtitle="Visualize orçado vs. medido por etapa" />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">Selecione uma obra para visualizar o mapa</p>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger className="w-full max-w-xs mx-auto">
                <SelectValue placeholder="Escolha uma obra..." />
              </SelectTrigger>
              <SelectContent>
                {obras.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  const obra = obras.find(o => o.id === obraId);

  return (
    <div className="space-y-8">
      <PageHeader title="Mapa de Medições" subtitle={obra?.nome} />

      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione obra..." />
          </SelectTrigger>
          <SelectContent>
            {obras.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 border rounded-lg p-1 bg-gray-50">
          <button
            onClick={() => setVisaoAtiva('preco')}
            className={cn(
              'px-4 py-1.5 rounded font-medium text-sm transition-all',
              visaoAtiva === 'preco' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Preço
          </button>
          <button
            onClick={() => setVisaoAtiva('custo')}
            className={cn(
              'px-4 py-1.5 rounded font-medium text-sm transition-all',
              visaoAtiva === 'custo' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Custo
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setMostrarValores(!mostrarValores)}
        >
          {mostrarValores ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 mb-1">Total Orçado</p>
            <p className="text-2xl font-bold text-gray-900">
              {mostrarValores ? `R$ ${mapa.totalOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 mb-1">Total Medido</p>
            <p className="text-2xl font-bold text-blue-600">
              {mostrarValores ? `R$ ${mapa.totalMedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 mb-1">Saldo a Medir</p>
            <p className="text-2xl font-bold text-orange-600">
              {mostrarValores ? `R$ ${mapa.totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 mb-1">Progresso</p>
            <p className="text-2xl font-bold text-green-600">
              {((mapa.totalMedido / mapa.totalOrcado) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Etapas */}
      <div className="space-y-4">
        {loadingOrc ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : mapa.etapas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Nenhuma etapa encontrada no orçamento
            </CardContent>
          </Card>
        ) : (
          mapa.etapas.map((etapa) => {
            const orcado = visaoAtiva === 'preco' ? etapa.orcadoPreco : etapa.orcadoCusto;
            const medido = visaoAtiva === 'preco' ? etapa.medidoPreco : etapa.medidoCusto;
            const percentual = (medido / orcado) * 100;
            const saldo = orcado - medido;
            const alerta = getAlertaSeveridade(percentual);

            return (
              <Card key={etapa.nome} className={cn(alerta.cor, 'border-2')}>
                <CardContent className="py-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">{etapa.nome}</h3>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className={alerta.texto}>{alerta.emoji} {percentual.toFixed(1)}%</Badge>
                        <Badge variant="secondary">{etapa.itens.length} itens</Badge>
                      </div>
                    </div>
                  </div>

                  <Progress value={Math.min(percentual, 100)} className="mb-4" />

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">Orçado</p>
                      <p className="font-semibold text-gray-900">
                        {mostrarValores ? `R$ ${orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Medido</p>
                      <p className="font-semibold text-blue-600">
                        {mostrarValores ? `R$ ${medido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Saldo</p>
                      <p className="font-semibold text-orange-600">
                        {mostrarValores ? `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
                      </p>
                    </div>
                  </div>

                  {percentual > 100 && (
                    <div className="mt-3 p-2 bg-red-200 border border-red-400 rounded text-xs text-red-900">
                      Etapa ultrapassou o orçado em {(percentual - 100).toFixed(1)}%
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}