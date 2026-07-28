import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalisadorDocumento({ onAnaliseCompleta }) {
  const [arquivo, setArquivo] = useState(null);
  const [uploadando, setUploadando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArquivo(file);
      setAnalise(null);
    }
  };

  const analisarDocumento = async () => {
    if (!arquivo) return;

    setUploadando(true);
    try {
      // Upload do arquivo
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: arquivo });
      const fileUrl = uploadResponse.file_url;

      setUploadando(false);
      setAnalisando(true);

      // Análise com IA
      const response = await base44.functions.invoke('analisarDocumentoIA', {
        file_url: fileUrl,
        tipo_documento: arquivo.name
      });

      setAnalise(response.data.analise);
      toast.success('Documento analisado com sucesso!');
      
      if (onAnaliseCompleta) {
        onAnaliseCompleta(response.data.analise);
      }
    } catch (error) {
      toast.error('Erro ao analisar documento');
      console.error(error);
    } finally {
      setUploadando(false);
      setAnalisando(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Análise de Documento com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-gray-400">Anexar Documento (PDF, Imagem)</Label>
          <Input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
            className="mt-1.5 bg-gray-800 border-gray-700 text-white"
          />
        </div>

        {arquivo && !analise && (
          <Button
            onClick={analisarDocumento}
            disabled={uploadando || analisando}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            {uploadando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : analisando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Analisar Documento
              </>
            )}
          </Button>
        )}

        {analise && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Análise Concluída</span>
              </div>
            </div>

            {analise.resumo && (
              <div>
                <Label className="text-gray-400 text-sm">Resumo</Label>
                <p className="text-gray-300 text-sm mt-1">{analise.resumo}</p>
              </div>
            )}

            {analise.valores_identificados && analise.valores_identificados.length > 0 && (
              <div>
                <Label className="text-gray-400 text-sm">Valores Identificados</Label>
                <div className="mt-2 space-y-2">
                  {analise.valores_identificados.map((item, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-gray-800 rounded">
                      <span className="text-gray-400 text-sm">{item.descricao}</span>
                      <span className="text-emerald-400 font-medium">
                        {item.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analise.datas_importantes && analise.datas_importantes.length > 0 && (
              <div>
                <Label className="text-gray-400 text-sm">Datas Importantes</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analise.datas_importantes.map((item, idx) => (
                    <Badge key={idx} className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {item.tipo}: {item.data}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {analise.partes_envolvidas && analise.partes_envolvidas.length > 0 && (
              <div>
                <Label className="text-gray-400 text-sm">Partes Envolvidas</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analise.partes_envolvidas.map((parte, idx) => (
                    <Badge key={idx} variant="outline" className="text-gray-400">
                      {parte}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {analise.riscos_identificados && analise.riscos_identificados.length > 0 && (
              <div>
                <Label className="text-gray-400 text-sm">Riscos Identificados</Label>
                <div className="mt-2 space-y-1">
                  {analise.riscos_identificados.map((risco, idx) => (
                    <div key={idx} className="text-red-400 text-sm">• {risco}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}