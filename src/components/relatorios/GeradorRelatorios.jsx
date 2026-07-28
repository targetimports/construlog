import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function GeradorRelatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState('obras');
  const [filtro, setFiltro] = useState({});

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const gerarRelatorioObras = () => {
    try {
      const dados = obras.map(o => ({
        'Nome': o.nome,
        'Cliente': o.cliente,
        'Orçamento': `R$ ${(o.total_final_orcamento || 0).toLocaleString('pt-BR')}`,
        'Status': o.status,
        'Fase': o.fase,
        'Data Início': o.data_inicio
      }));

      const csv = [
        Object.keys(dados[0]).join(','),
        ...dados.map(row => Object.values(row).map(v => `"${v}"`).join(','))
      ].join('\n');

      downloadCSV(csv, 'relatorio_obras.csv');
      toast.success('Relatório de Obras gerado!');
    } catch (err) {
      toast.error('Erro ao gerar relatório');
    }
  };

  const gerarRelatorioCustos = () => {
    try {
      const dados = medicoes.map(m => ({
        'Número': m.numero,
        'Data': m.data_medicao,
        'Valor Realizado': `R$ ${(m.valor_total_realizado || 0).toLocaleString('pt-BR')}`,
        'Status': m.status
      }));

      const csv = [
        Object.keys(dados[0]).join(','),
        ...dados.map(row => Object.values(row).map(v => `"${v}"`).join(','))
      ].join('\n');

      downloadCSV(csv, 'relatorio_custos.csv');
      toast.success('Relatório de Custos gerado!');
    } catch (err) {
      toast.error('Erro ao gerar relatório');
    }
  };

  const gerarRelatorioPessoas = () => {
    try {
      const dados = colaboradores.map(c => ({
        'Nome': c.nome,
        'Cargo': c.cargo,
        'Email': c.email,
        'Status': c.status,
        'Departamento': c.departamento || 'N/A',
        'Salário': `R$ ${(c.salario || 0).toLocaleString('pt-BR')}`
      }));

      const csv = [
        Object.keys(dados[0]).join(','),
        ...dados.map(row => Object.values(row).map(v => `"${v}"`).join(','))
      ].join('\n');

      downloadCSV(csv, 'relatorio_pessoas.csv');
      toast.success('Relatório de Pessoas gerado!');
    } catch (err) {
      toast.error('Erro ao gerar relatório');
    }
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gerador de Relatórios</h2>
        <p className="text-gray-600 mt-1">Exporte dados em formato CSV</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md cursor-pointer transition-shadow" onClick={() => setTipoRelatorio('obras')}>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="font-semibold">Relatório de Obras</p>
              <p className="text-sm text-gray-600 mt-1">{obras.length} registros</p>
              <Button 
                size="sm" 
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  gerarRelatorioObras();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md cursor-pointer transition-shadow" onClick={() => setTipoRelatorio('custos')}>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-semibold">Relatório de Custos</p>
              <p className="text-sm text-gray-600 mt-1">{medicoes.length} medições</p>
              <Button 
                size="sm" 
                className="mt-4 w-full bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  e.stopPropagation();
                  gerarRelatorioCustos();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md cursor-pointer transition-shadow" onClick={() => setTipoRelatorio('pessoas')}>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="font-semibold">Relatório de Pessoas</p>
              <p className="text-sm text-gray-600 mt-1">{colaboradores.length} colaboradores</p>
              <Button 
                size="sm" 
                className="mt-4 w-full bg-purple-600 hover:bg-purple-700"
                onClick={(e) => {
                  e.stopPropagation();
                  gerarRelatorioPessoas();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}