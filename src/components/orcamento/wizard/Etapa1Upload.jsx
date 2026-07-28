import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function Etapa1Upload({ dadosImport, setDadosImport }) {
  const handleArquivoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      
      setDadosImport({
        ...dadosImport,
        filename: file.name,
        fileUrl: uploadResponse.file_url,
        nomeObra: file.name.replace(/\.[^/.]+$/, '')
      });
      
      toast.success('Arquivo carregado com sucesso');
    } catch (error) {
      toast.error(`Erro ao fazer upload: ${error.message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 1: Upload da Planilha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleArquivoChange}
            className="hidden"
            id="arquivo-wizard"
          />
          <label htmlFor="arquivo-wizard" className="cursor-pointer block">
            {!dadosImport.fileUrl ? (
              <>
                <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-1">Selecione sua planilha</p>
                <p className="text-sm text-gray-500">Suporta Excel (.xlsx, .xls) e CSV</p>
              </>
            ) : (
              <>
                <FileText className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium text-green-700 mb-1">{dadosImport.filename}</p>
                <p className="text-sm text-gray-500">Clique para trocar arquivo</p>
              </>
            )}
          </label>
        </div>

        {dadosImport.fileUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              ✓ Arquivo carregado. Avance para revisar os materiais importados.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}