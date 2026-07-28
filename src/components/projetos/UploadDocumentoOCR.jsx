import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function UploadDocumentoOCR({ projetoId, onDocumentoProcessado }) {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [schemaPersonalizado, setSchemaPersonalizado] = useState('');
  const [mostrarResultado, setMostrarResultado] = useState(false);

  const schemaPadrao = {
    type: "object",
    properties: {
      titulo: { type: "string" },
      numero_documento: { type: "string" },
      data: { type: "string" },
      responsavel: { type: "string" },
      empresa: { type: "string" },
      descricao: { type: "string" },
      quantitativos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            quantidade: { type: "number" },
            unidade: { type: "string" }
          }
        }
      }
    }
  };

  const handleArquivoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const tiposPermitidos = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!tiposPermitidos.includes(file.type)) {
        toast.error('Apenas arquivos PNG, JPG ou PDF são permitidos');
        return;
      }
      setArquivo(file);
      setResultado(null);
    }
  };

  const processarDocumento = async () => {
    if (!arquivo) {
      toast.error('Selecione um arquivo');
      return;
    }

    setProcessando(true);
    try {
      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });

      // 2. Schema a usar (personalizado ou padrão)
      let schema = schemaPadrao;
      if (schemaPersonalizado.trim()) {
        try {
          schema = JSON.parse(schemaPersonalizado);
        } catch (error) {
          toast.error('Schema JSON inválido. Usando schema padrão.');
        }
      }

      // 3. Extrair dados via OCR
      const resultadoOCR = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      if (resultadoOCR.status === 'success') {
        const documentoProcessado = {
          nome: arquivo.name,
          url: file_url,
          tipo: arquivo.type,
          dados_extraidos: resultadoOCR.output,
          data_processamento: new Date().toISOString()
        };

        setResultado(documentoProcessado);
        setMostrarResultado(true);
        toast.success('Documento processado com sucesso!');

        if (onDocumentoProcessado) {
          onDocumentoProcessado(documentoProcessado);
        }
      } else {
        toast.error(resultadoOCR.details || 'Erro ao processar documento');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar documento: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Upload e OCR de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-400 text-sm">Arquivo (PDF, PNG, JPG)</Label>
            <div className="mt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload-ocr').click()}
                className="border-gray-700 text-gray-400 hover:bg-gray-800"
              >
                <Upload className="w-4 h-4 mr-2" />
                Selecionar Arquivo
              </Button>
              {arquivo && (
                <span className="text-sm text-gray-400">{arquivo.name}</span>
              )}
            </div>
            <input
              id="file-upload-ocr"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleArquivoChange}
              className="hidden"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">
              Schema JSON (opcional - para extrair dados específicos)
            </Label>
            <Textarea
              value={schemaPersonalizado}
              onChange={(e) => setSchemaPersonalizado(e.target.value)}
              placeholder={JSON.stringify(schemaPadrao, null, 2)}
              className="mt-2 bg-gray-800 border-gray-700 text-gray-300 font-mono text-xs h-32"
            />
            <p className="text-xs text-gray-500 mt-1">
              Deixe em branco para usar schema padrão (título, número, data, quantitativos, etc.)
            </p>
          </div>

          <Button
            onClick={processarDocumento}
            disabled={!arquivo || processando}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            {processando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Processar com OCR
              </>
            )}
          </Button>

          {resultado && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Documento processado!</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMostrarResultado(true)}
                  className="border-green-500/20 text-green-400 hover:bg-green-500/10"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver Dados
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={mostrarResultado} onOpenChange={setMostrarResultado}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Dados Extraídos do Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Arquivo: {resultado?.nome}</p>
              <p className="text-xs text-gray-500">
                Processado em: {resultado?.data_processamento && new Date(resultado.data_processamento).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-3">Dados Extraídos:</h4>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-950 p-4 rounded overflow-x-auto">
                {JSON.stringify(resultado?.dados_extraidos, null, 2)}
              </pre>
            </div>

            <Button
              onClick={() => setMostrarResultado(false)}
              className="w-full bg-gray-700 hover:bg-gray-600"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}