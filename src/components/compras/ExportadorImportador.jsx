import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ExportadorImportador({ obra_id, almoxarifado_id }) {
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const queryClient = useQueryClient();

  // Exportar demandas
  const exportarDemandas = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/functions/exportarDemandas', {
        method: 'POST',
        body: JSON.stringify({ obra_id }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Demandas_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      toast.success('Demandas exportadas com sucesso');
    },
    onError: () => toast.error('Erro ao exportar demandas')
  });

  // Exportar requisições
  const exportarRequisicoes = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/functions/exportarRequisicoes', {
        method: 'POST',
        body: JSON.stringify({ obra_id }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Requisicoes_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      toast.success('Requisições exportadas com sucesso');
    },
    onError: () => toast.error('Erro ao exportar requisições')
  });

  // Exportar saldos
  const exportarSaldos = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/functions/exportarSaldos', {
        method: 'POST',
        body: JSON.stringify({ almoxarifado_id }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Saldos_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      toast.success('Saldos exportados com sucesso');
    },
    onError: () => toast.error('Erro ao exportar saldos')
  });

  // Importar demandas
  const handleImportarDemandas = async (file) => {
    setImportando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const response = await base44.functions.invoke('importarDemandas', {
        file_url,
        obra_id
      });

      setResultadoImportacao({
        tipo: 'demandas',
        dados: response
      });

      if (response.demandas_criadas > 0) {
        queryClient.invalidateQueries(['demandas']);
        toast.success(`${response.demandas_criadas} demandas importadas`);
      }
      if (response.erros?.length > 0) {
        toast.error(`${response.erros.length} erros durante importação`);
      }
    } catch (error) {
      toast.error('Erro ao importar demandas');
    } finally {
      setImportando(false);
    }
  };

  // Importar requisições
  const handleImportarRequisicoes = async (file) => {
    setImportando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const response = await base44.functions.invoke('importarRequisicoes', {
        file_url
      });

      setResultadoImportacao({
        tipo: 'requisicoes',
        dados: response
      });

      if (response.requisicoes_criadas > 0) {
        queryClient.invalidateQueries(['requisicoes-compra']);
        toast.success(`${response.requisicoes_criadas} requisições importadas`);
      }
      if (response.erros?.length > 0) {
        toast.error(`${response.erros.length} erros durante importação`);
      }
    } catch (error) {
      toast.error('Erro ao importar requisições');
    } finally {
      setImportando(false);
    }
  };

  // Importar saldos
  const handleImportarSaldos = async (file) => {
    setImportando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const response = await base44.functions.invoke('importarSaldos', {
        file_url,
        almoxarifado_id
      });

      setResultadoImportacao({
        tipo: 'saldos',
        dados: response
      });

      if (response.saldos_atualizados > 0) {
        queryClient.invalidateQueries(['saldos-estoque']);
        toast.success(`${response.saldos_atualizados} saldos atualizados`);
      }
    } catch (error) {
      toast.error('Erro ao importar saldos');
    } finally {
      setImportando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exportar / Importar Planilhas</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="demandas" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="demandas">Demandas</TabsTrigger>
            <TabsTrigger value="requisicoes">Requisições</TabsTrigger>
            <TabsTrigger value="saldos">Saldos</TabsTrigger>
          </TabsList>

          {/* DEMANDAS */}
          <TabsContent value="demandas" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => exportarDemandas.mutate()}
                disabled={exportarDemandas.isPending}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Demandas
              </Button>
              <label className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar Demandas</span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImportarDemandas(e.target.files[0]);
                    }
                  }}
                  disabled={importando}
                />
              </label>
            </div>
          </TabsContent>

          {/* REQUISIÇÕES */}
          <TabsContent value="requisicoes" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => exportarRequisicoes.mutate()}
                disabled={exportarRequisicoes.isPending}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Requisições
              </Button>
              <label className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar Requisições</span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImportarRequisicoes(e.target.files[0]);
                    }
                  }}
                  disabled={importando}
                />
              </label>
            </div>
          </TabsContent>

          {/* SALDOS */}
          <TabsContent value="saldos" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => exportarSaldos.mutate()}
                disabled={exportarSaldos.isPending}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Saldos
              </Button>
              <label className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar Saldos</span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImportarSaldos(e.target.files[0]);
                    }
                  }}
                  disabled={importando}
                />
              </label>
            </div>
          </TabsContent>
        </Tabs>

        {/* Resultado de Importação */}
        {resultadoImportacao && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <div className="flex items-start gap-3">
              {resultadoImportacao.dados.status === 'sucesso' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="font-medium">Importação Concluída</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {resultadoImportacao.tipo === 'demandas' && 
                    `${resultadoImportacao.dados.demandas_criadas} demandas criadas`}
                  {resultadoImportacao.tipo === 'requisicoes' && 
                    `${resultadoImportacao.dados.requisicoes_criadas} requisições criadas`}
                  {resultadoImportacao.tipo === 'saldos' && 
                    `${resultadoImportacao.dados.saldos_atualizados} saldos atualizados`}
                </p>
                {resultadoImportacao.dados.erros?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-600">Erros encontrados:</p>
                    <ul className="text-xs text-red-600 mt-1 space-y-1">
                      {resultadoImportacao.dados.erros.slice(0, 3).map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                      {resultadoImportacao.dados.erros.length > 3 && (
                        <li>... e mais {resultadoImportacao.dados.erros.length - 3}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}