import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Etapa4CronogramaUpload({ obraId, onDadosCarregados }) {
  const [arquivo, setArquivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(null);

  const handleArquivoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Selecione um arquivo .xlsx ou .xls');
      return;
    }

    setLoading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;

      const importRes = await base44.functions.invoke('importarCronogramaFisFinan', {
        file_url: fileUrl,
        obra_id: obraId
      });

      if (importRes.data?.sucesso) {
        setArquivo(file.name);
        setResumo(importRes.data.resumo);
        onDadosCarregados({
          arquivo: file.name,
          linhas: importRes.data.dados,
          resumo: importRes.data.resumo
        });
        toast.success('Cronograma carregado com sucesso!');
      } else {
        const errorMsg = importRes.data?.error || importRes.data?.detalhes || 'Erro ao importar cronograma';
        toast.error(errorMsg);
      }
    } catch (error) {
      toast.error(`Erro ao processar cronograma: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 4: Upload Cronograma - OPCIONAL</CardTitle>
        <p className="text-sm text-gray-600 mt-2">Selecione o arquivo "Cronograma.xlsx" (pode ser deixado em branco)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".xlsx"
            onChange={handleArquivoChange}
            disabled={loading}
            className="hidden"
            id="file-crono-input"
          />
          <label htmlFor="file-crono-input" className="cursor-pointer">
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">{loading ? 'Carregando...' : 'Clique para selecionar (opcional)'}</p>
            <p className="text-xs text-gray-500">ou arraste o arquivo aqui</p>
          </label>
        </div>

        {arquivo && resumo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <p className="font-semibold text-blue-900">Arquivo carregado: {arquivo}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Linhas</p>
                <p className="text-lg font-bold text-blue-700">{resumo.linhas}</p>
              </div>
              <div>
                <p className="text-gray-600">Períodos</p>
                <p className="text-lg font-bold text-blue-700">{resumo.periodos}</p>
              </div>
              <div>
                <p className="text-gray-600">Hash</p>
                <p className="text-xs font-mono text-gray-600">{resumo.hash}</p>
              </div>
            </div>
          </div>
        )}

        {!arquivo && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            Você pode prosseguir sem importar cronograma agora. Será possível adicionar depois.
          </div>
        )}
      </CardContent>
    </Card>
  );
}