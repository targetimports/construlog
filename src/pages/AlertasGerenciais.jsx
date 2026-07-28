import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Download } from 'lucide-react';
import { toast } from 'sonner';
import GraficoFaltasEHEPorDia from '../components/relatorios-gerenciais/GraficoFaltasEHEPorDia';
import RankingMotivosObra from '../components/relatorios-gerenciais/RankingMotivosObra';
import RankingObrasProblematicas from '../components/relatorios-gerenciais/RankingObrasProblematicas';

export default function AlertasGerenciais() {
  const [periodo, setPeriodo] = useState('30'); // dias
  const [obraFiltro, setObraFiltro] = useState('');

  // Calcular data de início
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));
  const dataInicioStr = dataInicio.toISOString().split('T')[0];

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-alertas'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000),
    select: (data) =>
      data
        .filter((o) => o.status !== 'cancelada')
        .sort((a, b) => a.nome.localeCompare(b.nome))
  });

  // Criar mapa de obras
  const obraMap = React.useMemo(() => {
    const mapa = {};
    obras.forEach((o) => {
      mapa[o.id] = o;
    });
    return mapa;
  }, [obras]);

  // Buscar diários (filtro de data no cliente — o shim não suporta $gte)
  const { data: diarios = [], isLoading: diariosLoading } = useQuery({
    queryKey: ['diarios-alertas', dataInicioStr, obraFiltro],
    queryFn: async () => {
      const todos = await base44.entities.DiarioObra.filter(obraFiltro ? { obra_id: obraFiltro } : {});
      const desde = new Date(dataInicioStr).toISOString();
      return (todos || []).filter(d => !d.registrado_em || d.registrado_em >= desde);
    }
  });

  // Buscar presença/faltas — fonte única: ApontamentoMaoObra (filtro de data no cliente).
  const { data: equipePassed = [], isLoading: equipeLoading } = useQuery({
    queryKey: ['equipe-alertas', dataInicioStr, obraFiltro],
    queryFn: async () => {
      const todas = await base44.entities.ApontamentoMaoObra.filter(obraFiltro ? { obra_id: obraFiltro } : {});
      return (todas || [])
        .filter(p => p.data && p.data >= dataInicioStr)
        .map(p => ({ ...p, falta: p.presenca === 'falta', presente: p.presenca === 'presente' }));
    }
  });

  // Buscar motivos
  const { data: motivos = [], isLoading: motivosLoading } = useQuery({
    queryKey: ['motivos-alertas', dataInicioStr, obraFiltro],
    queryFn: async () => {
      const query = { diario_id: { $exists: true } };
      const todos = await base44.entities.DiarioObraMotivo.list('-updated_date', 5000);
      let filtered = todos;

      // Se temos filtro de obra, apenas diários daquela obra
      if (obraFiltro) {
        const diariosDaObra = diarios
          .filter((d) => d.obra_id === obraFiltro)
          .map((d) => d.id);
        filtered = todos.filter((m) => diariosDaObra.includes(m.diario_id));
      }

      return filtered;
    },
    select: async (data) => {
      // Enriquecer com nome do motivo
      const motivosCatalogo = await base44.entities.MotivoCatalogo.list('-updated_date', 500);
      const motivoMap = {};
      motivosCatalogo.forEach((m) => {
        motivoMap[m.id] = m.nome;
      });

      return data.map((m) => ({
        ...m,
        motivo_nome: motivoMap[m.motivo_id] || `Motivo ${m.motivo_id}`,
        obra_id: diarios.find((d) => d.id === m.diario_id)?.obra_id
      }));
    }
  });

  const handleLimpar = () => {
    setPeriodo('30');
    setObraFiltro('');
  };

  const handleExportar = () => {
    toast.info('Exportação em desenvolvimento');
  };

  const isLoading = diariosLoading || equipeLoading || motivosLoading;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Alertas & Insights Gerenciais</h1>
        <p className="text-gray-400 mt-1">
          Padrões de faltas, horas extras, motivos e obras problemáticas
        </p>
      </div>

      {/* Filtros */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Período */}
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 block">
                Período (últimos dias)
              </label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 6 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Obra */}
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 block">
                Obra (opcional)
              </label>
              <Select value={obraFiltro} onValueChange={setObraFiltro}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as obras</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ações */}
            <div className="flex gap-2 items-end">
              <Button
                onClick={handleLimpar}
                variant="outline"
                className="border-gray-600 text-gray-300 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Limpar
              </Button>
              <Button onClick={handleExportar} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos e Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico faltas/HE por dia */}
        <GraficoFaltasEHEPorDia
          registros={equipePassed}
          isLoading={isLoading}
        />

        {/* Ranking obras problemáticas */}
        <RankingObrasProblematicas
          diarios={diarios}
          obraMap={obraMap}
          isLoading={isLoading}
        />
      </div>

      {/* Ranking motivos */}
      <RankingMotivosObra
        motivos={motivos}
        obraMap={obraMap}
        isLoading={isLoading}
      />
    </div>
  );
}