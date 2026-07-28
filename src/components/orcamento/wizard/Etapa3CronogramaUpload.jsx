import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function Etapa3CronogramaUpload({ onDadosCarregados }) {
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
    console.log('Iniciando upload do cronograma:', file.name);
    
    try {
      // Upload do arquivo
      console.log('Fazendo upload...');
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;
      console.log('Upload concluído:', fileUrl);

      // Importação
      console.log('Importando cronograma...');
      const importRes = await base44.functions.invoke('importarCronogramaFisFinan', {
        file_url: fileUrl
      });
      console.log('Resposta da importação:', importRes.data);

      if (importRes.data?.sucesso || importRes.data?.dados) {
        setArquivo(file.name);
        const resumoData = importRes.data?.resumo || {
          linhas: importRes.data?.dados?.length || 0,
          periodos: 0
        };
        setResumo(resumoData);
        
        // Notificar wizard
        onDadosCarregados({
          arquivo: file.name,
          dados: importRes.data?.dados || [],
          resumo: resumoData
        });
        
        toast.success(`Cronograma carregado: ${resumoData.linhas} linhas, ${resumoData.periodos} períodos`);
      } else {
        console.error('Erro na importação:', importRes.data);
        toast.error(importRes.data?.error || 'Erro ao importar cronograma');
      }
    } catch (error) {
      console.error('Erro crítico:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
      console.log('Processamento finalizado');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 3: Cronograma Físico-Financeiro (Opcional)</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Você pode importar o cronograma agora ou pular esta etapa
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleArquivoChange}
            disabled={loading}
            className="hidden"
            id="cronograma-input"
          />
          <label htmlFor="cronograma-input" className="cursor-pointer">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">{loading ? 'Carregando...' : 'Clique para selecionar'}</p>
            <p className="text-xs text-gray-500">ou arraste o arquivo aqui</p>
          </label>
        </div>

        {arquivo && resumo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="font-semibold text-green-900">Cronograma carregado: {arquivo}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Linhas</p>
                <p className="text-lg font-bold text-green-700">{resumo.linhas}</p>
              </div>
              <div>
                <p className="text-gray-600">Períodos</p>
                <p className="text-lg font-bold text-green-700">{resumo.periodos || 0}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            ℹVocê pode prosseguir sem importar o cronograma. Ele pode ser adicionado posteriormente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}