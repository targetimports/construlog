import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileText, BarChart3, Users, Settings, Download, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import RelatorioGraficoDiario from './RelatorioGraficoDiario';
import RelatorioApontamentoMaoObra from './RelatorioApontamentoMaoObra';
import ConfiguracaoModeloRelatorio from './ConfiguracaoModeloRelatorio';

export default function RelatoriosPainelDiario() {
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalGrafico, setModalGrafico] = useState(false);
  const [modalApontamento, setModalApontamento] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);

  const [parametros, setParametros] = useState({
    dataInicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    obra_id: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-relatorio'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra filtrada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obras.find((o) => o.id === parametros.obra_id)?.empresa_id);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Carregar configuração do modelo
  const { data: configModelo } = useQuery({
    queryKey: ['config-diario-relatorio', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      try {
        const configs = await base44.entities.ConfiguracaoSistema.filter({
          modulo: 'diario_obra',
          chave: 'modelo_relatorio',
          user_email: user.email
        });
        if (configs && configs.length > 0 && configs[0].valor) {
          return JSON.parse(configs[0].valor);
        }
      } catch (err) {
        // Fallback localStorage
        const chaveLS = `app:diarioRelatorioConfig:${user.email}`;
        const configLS = localStorage.getItem(chaveLS);
        if (configLS) return JSON.parse(configLS);
      }
      return null;
    },
    enabled: !!user?.email
  });

  const gerarRelatorioPeriodoMutation = useMutation({
    mutationFn: async () => {
      const query = {};
      if (parametros.obra_id) query.obra_id = parametros.obra_id;
      
      const diarios = await base44.entities.DiarioObra.filter(query, '-data', 500);
      
      // Filtrar por período
      const diariosFiltrados = diarios.filter(d => {
        if (!d.data) return false;
        return d.data >= parametros.dataInicio && d.data <= parametros.dataFim;
      });

      if (diariosFiltrados.length === 0) {
        throw new Error('Nenhum registro encontrado no período');
      }

      // Aplicar configuração do modelo
      const config = configModelo || {
        incluirMaoObra: true,
        incluirEquipamentos: true,
        incluirOcorrencias: true,
        ordenarPor: 'data'
      };

      // Ordenar conforme configuração
      const diariosOrdenados = config.ordenarPor === 'obra'
        ? diariosFiltrados.sort((a, b) => (a.obra_id || '').localeCompare(b.obra_id || ''))
        : diariosFiltrados;

      return { diarios: diariosOrdenados, config, total: diariosOrdenados.length };
    },
    onSuccess: (data) => {
      // Gerar EXCEL branded: uma linha por diário do período.
      const obraMap = Object.fromEntries(obras.map(o => [o.id, o.nome]));
      const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '');

      const headers = ['Data', 'Obra', 'Clima', 'Nº Funcionários', 'Atividades Realizadas'];
      const larguras = [12, 28, 14, 16, 50];
      if (data.config.incluirMaoObra) { headers.push('Mão de Obra'); larguras.push(32); }
      if (data.config.incluirEquipamentos) { headers.push('Equipamentos'); larguras.push(32); }
      if (data.config.incluirOcorrencias) { headers.push('Ocorrências'); larguras.push(40); }

      const rows = data.diarios.map((d) => {
        const row = [
          dataBR(d.data),
          obraMap[d.obra_id] || 'Obra não identificada',
          d.clima || '',
          Number(d.qtd_funcionarios) || 0,
          d.atividades_realizadas || '',
        ];
        if (data.config.incluirMaoObra) row.push((d.mao_obra || []).map(m => m.nome || m.funcao).filter(Boolean).join(', '));
        if (data.config.incluirEquipamentos) row.push((d.equipamentos || []).map(e => e.descricao).filter(Boolean).join(', '));
        if (data.config.incluirOcorrencias) row.push(d.ocorrencias || '');
        return row;
      });

      exportarXLSXBranded(`relatorio_diarios_${parametros.dataInicio}_${parametros.dataFim}`, [{
        nome: 'Diários de Obra',
        titulo: 'Relatório de Diários de Obra',
        subtitulo: `De ${dataBR(parametros.dataInicio)} até ${dataBR(parametros.dataFim)} · ${data.total} registro(s)`,
        headers,
        rows,
        larguras,
      }], { empresa, branding });

      toast.success('Excel exportado');
      setModalPeriodo(false);
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <>
      <div className="flex gap-2 w-full sm:w-auto">
        {/* Dropdown Relatórios */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-green-600 hover:bg-green-700 flex-1 sm:flex-none">
              <FileText className="w-4 h-4" />
              Relatórios
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setModalPeriodo(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Relatório por Período
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setModalGrafico(true)}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Relatório Gráfico
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setModalApontamento(true)}>
              <Users className="w-4 h-4 mr-2" />
              Apontamento Mão de Obra
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Botão Configurar */}
        <Button variant="outline" onClick={() => setModalConfig(true)} className="gap-2 flex-1 sm:flex-none">
          <Settings className="w-4 h-4" />
          Configurar
        </Button>
      </div>

      {/* Modal Relatório por Período */}
      <Dialog open={modalPeriodo} onOpenChange={setModalPeriodo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório por Período</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Data Início *</label>
                <Input
                  type="date"
                  value={parametros.dataInicio}
                  onChange={(e) => setParametros({ ...parametros, dataInicio: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Data Fim *</label>
                <Input
                  type="date"
                  value={parametros.dataFim}
                  onChange={(e) => setParametros({ ...parametros, dataFim: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Obra (opcional)</label>
              <select
                value={parametros.obra_id}
                onChange={(e) => setParametros({ ...parametros, obra_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todas as obras</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-3">
                <p className="text-xs text-blue-800">
                  Será gerado um arquivo Excel (.xlsx) com uma linha por diário do período,
                  seguindo as configurações do modelo de relatório.
                </p>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPeriodo(false)}>Cancelar</Button>
            <Button
              onClick={() => gerarRelatorioPeriodoMutation.mutate()}
              disabled={!parametros.dataInicio || !parametros.dataFim || gerarRelatorioPeriodoMutation.isPending}
              className="gap-2"
            >
              {gerarRelatorioPeriodoMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Gerar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Relatório Gráfico */}
      <RelatorioGraficoDiario open={modalGrafico} onClose={() => setModalGrafico(false)} />

      {/* Modal Apontamento Mão de Obra */}
      {modalApontamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <RelatorioApontamentoMaoObra />
            <Button variant="outline" onClick={() => setModalApontamento(false)} className="mt-4 w-full">
              Fechar
            </Button>
          </div>
        </div>
      )}

      {/* Modal Configuração */}
      <ConfiguracaoModeloRelatorio open={modalConfig} onClose={() => setModalConfig(false)} />
    </>
  );
}