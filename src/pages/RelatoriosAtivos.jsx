import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet } from 'lucide-react';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import PageHeader from '../components/ui/PageHeader';
import RelatorioDashboard from '../components/relatorios-ativos/RelatorioDashboard';
import RelatorioMovimentacoes from '../components/relatorios-ativos/RelatorioMovimentacoes';
import RelatorioValor from '../components/relatorios-ativos/RelatorioValor';
import RelatorioUtilizacao from '../components/relatorios-ativos/RelatorioUtilizacao';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { exportarCSV } from '@/lib/csvBR';
import { useEmpresaBranding } from '@/components/shared/useBranding';

const abas = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'valor', label: 'Valor do Patrimônio' },
  { id: 'utilizacao', label: 'Taxa de Utilização' }
];

export default function RelatoriosAtivos() {
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 1000)
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-ativos'],
    queryFn: () => base44.entities.MovimentacaoAtivo.list('-created_date', 500)
  });

  // Empresa/branding p/ o cabeçalho do Excel (tela sem filtro de obra → matriz).
  const { empresa, branding } = useEmpresaBranding();

  const ativosFiltrados = ativos.filter(ativo => {
    const statusMatch = filtroStatus === 'todos' || ativo.status === filtroStatus;
    const tipoMatch = filtroTipo === 'todos' || ativo.tipo === filtroTipo;
    return statusMatch && tipoMatch;
  });

  // Rótulos iguais aos exibidos nos filtros da tela.
  const statusLabels = { disponivel: 'Disponível', em_uso: 'Em Uso', manutencao: 'Manutenção', inativo: 'Inativo' };
  const tipoLabels = { ferramenta: 'Ferramenta', equipamento: 'Equipamento', maquina: 'Máquina', veiculo_pequeno: 'Veículo Pequeno' };
  const dataBR = (d) => {
    if (!d) return '';
    const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d);
    return isNaN(dt) ? '' : dt.toLocaleDateString('pt-BR');
  };

  // Exporta EXCEL branded com exatamente o que está filtrado na tela.
  const exportarExcel = () => {
    if (!ativosFiltrados.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const filtrosDesc = [
        filtroStatus !== 'todos' ? `Status: ${statusLabels[filtroStatus] || filtroStatus}` : '',
        filtroTipo !== 'todos' ? `Tipo: ${tipoLabels[filtroTipo] || filtroTipo}` : ''
      ].filter(Boolean).join(' · ');

      exportarXLSXBranded(`relatorio_ativos_${new Date().toISOString().split('T')[0]}`, [{
        nome: 'Ativos',
        titulo: 'Relatório de Ativos',
        subtitulo: `${ativosFiltrados.length} ativo(s)` + (filtrosDesc ? ` · ${filtrosDesc}` : ''),
        headers: [
          'Código', 'Nome', 'Tipo', 'Marca', 'Status', 'Localização',
          'Valor Aquisição', 'Data Aquisição', 'Responsável', 'Valor Atual'
        ],
        rows: ativosFiltrados.map(a => [
          a.codigo || '',
          a.nome || '',
          tipoLabels[a.tipo] || a.tipo || '',
          a.marca || '',
          statusLabels[a.status] || a.status || '',
          a.localizacao_atual || '',
          Number(a.valor_aquisicao) || 0,
          dataBR(a.data_aquisicao),
          a.responsavel_atual || '',
          Number(a.valor_atual) || 0
        ]),
        moeda: [6, 9],
      }], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  // Exporta CSV padrão (csvBR) com exatamente o que está filtrado na tela.
  const exportarCsv = () => {
    if (!ativosFiltrados.length) { toast.error('Nenhum dado para exportar'); return; }
    const csvBRL = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
    exportarCSV(
      `relatorio_ativos_${new Date().toISOString().split('T')[0]}.csv`,
      ['Código', 'Nome', 'Tipo', 'Marca', 'Status', 'Localização', 'Valor Aquisição (R$)', 'Data Aquisição', 'Responsável', 'Valor Atual (R$)'],
      ativosFiltrados.map(a => [
        a.codigo || '', a.nome || '', tipoLabels[a.tipo] || a.tipo || '', a.marca || '',
        statusLabels[a.status] || a.status || '', a.localizacao_atual || '',
        csvBRL(a.valor_aquisicao), dataBR(a.data_aquisicao), a.responsavel_atual || '', csvBRL(a.valor_atual),
      ])
    );
    toast.success('CSV exportado!');
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
         <PageHeader title="Relatórios de Ativos" subtitle="Análise completa do patrimônio" />
         <div className="flex flex-col sm:flex-row gap-2">
           <Button onClick={exportarCsv} variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700 gap-2">
             <FileSpreadsheet className="w-4 h-4" /> CSV
           </Button>
           <Button onClick={exportarExcel} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 gap-2">
             <Download className="w-4 h-4" /> Excel
           </Button>
         </div>
       </div>

      {/* Filtros */}
      <FiltrosColapsaveis
        ativos={(filtroStatus !== 'todos' ? 1 : 0) + (filtroTipo !== 'todos' ? 1 : 0)}
        onLimpar={() => { setFiltroStatus('todos'); setFiltroTipo('todos'); }}
        rodape={<span className="text-xs text-gray-500">{ativosFiltrados.length} ativo(s)</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'disponivel', label: 'Disponível' },
                { value: 'em_uso', label: 'Em Uso' },
                { value: 'manutencao', label: 'Manutenção' },
                { value: 'inativo', label: 'Inativo' },
              ]}
              value={filtroStatus}
              onSelect={(v) => setFiltroStatus(v || 'todos')}
              placeholder="Todos" searchPlaceholder="Buscar status..."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Tipo</Label>
            <ComboboxBusca
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'ferramenta', label: 'Ferramenta' },
                { value: 'equipamento', label: 'Equipamento' },
                { value: 'maquina', label: 'Máquina' },
                { value: 'veiculo_pequeno', label: 'Veículo Pequeno' },
              ]}
              value={filtroTipo}
              onSelect={(v) => setFiltroTipo(v || 'todos')}
              placeholder="Todos" searchPlaceholder="Buscar tipo..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      {/* Abas */}
      <div className="flex gap-2 overflow-x-auto bg-white rounded-lg p-1 shadow-sm border border-gray-200">
        {abas.map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition-all ${
              abaAtiva === aba.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das Abas */}
      <div>
        {abaAtiva === 'dashboard' && <RelatorioDashboard ativos={ativosFiltrados} />}
        {abaAtiva === 'movimentacoes' && <RelatorioMovimentacoes movimentacoes={movimentacoes} ativos={ativos} />}
        {abaAtiva === 'valor' && <RelatorioValor ativos={ativosFiltrados} />}
        {abaAtiva === 'utilizacao' && <RelatorioUtilizacao ativos={ativosFiltrados} movimentacoes={movimentacoes} />}
      </div>
    </div>
  );
}