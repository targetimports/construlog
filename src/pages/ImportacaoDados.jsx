import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportacaoDados() {
  const [arquivo, setArquivo] = useState(null);
  const [tipo, setTipo] = useState('materiais');
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState(null);

  const handleUpload = async () => {
    if (!arquivo) {
      toast.error('Selecione um arquivo');
      return;
    }

    const formData = new FormData();
    formData.append('file', arquivo);
    formData.append('tipo', tipo);

    try {
      setProgresso(10);
      
      const file_url = await base44.integrations.Core.UploadFile({ file: arquivo });
      setProgresso(50);

      const jsonSchema = {
        type: 'object',
        properties: {
          descricao_material: { type: 'string' },
          quantidade: { type: 'number' },
          valor_unitario: { type: 'number' }
        }
      };

      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url.file_url,
        json_schema: jsonSchema
      });

      setProgresso(80);

      if (extracted.status === 'success' && Array.isArray(extracted.output)) {
        const sucessos = extracted.output.length;
        
        for (const item of extracted.output) {
          await base44.entities.Material.create(item);
        }

        setProgresso(100);
        setResultado({
          sucesso: true,
          quantidade: sucessos,
          mensagem: `${sucessos} itens importados com sucesso`
        });
        toast.success(`Importação completa: ${sucessos} registros`);
      }
    } catch (err) {
      setResultado({
        sucesso: false,
        mensagem: err.message
      });
      toast.error('Erro na importação');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Importação em Lote</h1>
        <p className="text-gray-600 mt-1">Importe múltiplos registros via arquivo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Fazer Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Dados</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="materiais">Materiais</option>
              <option value="colaboradores">Colaboradores</option>
              <option value="medicoes">Medições</option>
              <option value="fornecedores">Fornecedores</option>
            </select>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setArquivo(e.target.files?.[0])}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="font-semibold">Arraste o arquivo ou clique para selecionar</p>
              <p className="text-sm text-gray-600">Formatos aceitos: XLSX, XLS, CSV</p>
              {arquivo && <p className="mt-2 text-green-600">{arquivo.name}</p>}
            </label>
          </div>

          {progresso > 0 && (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progresso}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{progresso}%</p>
            </div>
          )}

          {resultado && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              resultado.sucesso ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {resultado.sucesso ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div>
                <p className={`font-semibold ${resultado.sucesso ? 'text-green-800' : 'text-red-800'}`}>
                  {resultado.mensagem}
                </p>
                {resultado.sucesso && resultado.quantidade && (
                  <p className="text-sm text-green-700 mt-1">
                    {resultado.quantidade} registros processados
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={!arquivo}
          >
            Importar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}