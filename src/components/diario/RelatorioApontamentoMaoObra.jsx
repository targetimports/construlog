import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function RelatorioApontamentoMaoObra() {
  const [openDialog, setOpenDialog] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    obraIds: [],
    profissionaisIds: [],
    tipo: 'analitico'
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-dropdown'],
    queryFn: () => base44.entities.Obra.list()
  });

  const gerarRelatorioMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('gerarRelatorioApontamentoMaoObra', filtros);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.validacoes?.length > 0) {
        toast.warning(`Relatório gerado com ${data.validacoes.length} aviso(s)`);
      } else {
        toast.success('Relatório gerado com sucesso');
      }

      // Preparar para download Excel
      const ws = require('xlsx');
      const wb = ws.utils.book_new();
      const ws_dados = ws.utils.json_to_sheet(data.dados);
      ws.utils.book_append_sheet(wb, ws_dados, 'Apontamento');
      ws.writeFile(wb, `apontamento_${new Date().toISOString().split('T')[0]}.xlsx`);

      setOpenDialog(false);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <>
      <Button onClick={() => setOpenDialog(true)} className="gap-2">
        <Download className="w-4 h-4" />
        Relatório Apontamento
      </Button>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório Apontamento Mão de Obra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Período */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Data Início</label>
                <Input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data Fim</label>
                <Input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                />
              </div>
            </div>

            {/* Obras */}
            <div>
              <label className="text-xs font-medium">Obras</label>
              <select
                multiple
                value={filtros.obraIds}
                onChange={(e) => setFiltros({
                  ...filtros,
                  obraIds: Array.from(e.target.selectedOptions, o => o.value)
                })}
                className="w-full p-2 border rounded text-sm h-20"
              >
                {obras.map(obra => (
                  <option key={obra.id} value={obra.id}>{obra.nome}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Deixe vazio para todas</p>
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs font-medium">Tipo de Relatório</label>
              <div className="flex gap-2 mt-1">
                {['analitico', 'sintetico'].map(tipo => (
                  <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo"
                      value={tipo}
                      checked={filtros.tipo === tipo}
                      onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
                    />
                    <span className="text-sm capitalize">{tipo}</span>
                  </label>
                ))}
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">
                <p className="text-xs">
                  {filtros.tipo === 'analitico' 
                    ? 'Detalhado: data, função, profissional, obra, quantidade'
                    : 'Resumido: função, profissional, total dias, obras'
                  }
                </p>
              </div>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => gerarRelatorioMutation.mutate()}
              disabled={!filtros.dataInicio || !filtros.dataFim || gerarRelatorioMutation.isPending}
              className="gap-2"
            >
              {gerarRelatorioMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Gerar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}