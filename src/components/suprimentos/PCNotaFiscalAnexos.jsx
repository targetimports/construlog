import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, File, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PCNotaFiscalLeitura from './PCNotaFiscalLeitura';

// Tipos MIME aceitos
const MIME_TYPES_ACEITOS = {
  'application/xml': ['.xml'],
  'text/xml': ['.xml'],
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/zip': ['.zip'],
};

const EXTENSOES_ACEITAS = ['.xml', '.pdf', '.jpg', '.jpeg', '.png', '.zip'];
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export default function PCNotaFiscalAnexos({
  pedidoId,
  pedidoData = null,
  anexosExistentes = [],
  onAnexoAdicionado = null,
  onAplicarNF = null,
  disabled = false,
}) {
  const qc = useQueryClient();
  const [anexosLocais, setAnexosLocais] = useState([]);
  const [uploadando, setUploadando] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (arquivo) => {
      // Validar tipo MIME real
      if (!MIME_TYPES_ACEITOS[arquivo.type]) {
        throw new Error(`Tipo de arquivo não aceito: ${arquivo.type}`);
      }

      // Validar tamanho
      if (arquivo.size > TAMANHO_MAX_BYTES) {
        throw new Error(`Arquivo muito grande (máx 10MB). Tamanho: ${(arquivo.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // Upload para base44
      const formData = new FormData();
      formData.append('file', arquivo);

      const response = await base44.integrations.Core.UploadFile({
        file: arquivo,
      });

      return {
        id: `local-${Date.now()}`, // ID temporário para locais
        nome_original: arquivo.name,
        tipo_arquivo: arquivo.type,
        tamanho: arquivo.size,
        url: response.file_url,
        status_ia: 'PENDENTE',
        criado_em: new Date().toISOString(),
      };
    },
    onSuccess: (anexo) => {
      setAnexosLocais(prev => [...prev, anexo]);
      if (onAnexoAdicionado) onAnexoAdicionado(anexo);
      toast.success(`Arquivo "${anexo.nome_original}" anexado`);
    },
    onError: (err) => {
      toast.error(`Erro ao anexar: ${err.message}`);
    },
  });

  const handleFileChange = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    // Validar extensão (backup)
    const ext = '.' + arquivo.name.split('.').pop().toLowerCase();
    if (!EXTENSOES_ACEITAS.includes(ext)) {
      toast.error(`Extensão "${ext}" não permitida. Use: ${EXTENSOES_ACEITAS.join(', ')}`);
      return;
    }

    setUploadando(true);
    await uploadMutation.mutateAsync(arquivo);
    setUploadando(false);

    // Limpar input
    if (e.target) e.target.value = '';
  };

  const handleRemoverLocal = (id) => {
    setAnexosLocais(prev => prev.filter(a => a.id !== id));
  };

  const handleRemoverExistente = async (anexoId) => {
    // Placeholder para remover anexo já salvo (se necessário)
    // Por enquanto, apenas mostra opção se admin
    toast.info('Remover anexos já salvos requer contato com admin');
  };

  const getTipoArquivo = (tipo) => {
    if (tipo.includes('xml')) return 'XML (NF-e)';
    if (tipo.includes('pdf')) return 'PDF';
    if (tipo.includes('image')) return 'Imagem';
    if (tipo.includes('zip')) return 'ZIP';
    return tipo;
  };

  const formatarTamanho = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const todoAnexos = [...anexosExistentes, ...anexosLocais];

  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
      <div>
        <Label className="text-amber-900 font-semibold flex items-center gap-2">
          <File className="w-4 h-4" />
          Nota Fiscal / Anexos (opcional)
        </Label>
        <p className="text-xs text-amber-700 mt-1">
          XML de NF-e, PDF, ou imagem/scan — até 10MB por arquivo
        </p>
      </div>

      {/* Área de Upload */}
      {!disabled && (
        <div className="relative">
          <input
            type="file"
            accept=".xml,.pdf,.jpg,.jpeg,.png,.zip"
            onChange={handleFileChange}
            disabled={uploadando}
            className="hidden"
            id="pc-upload-nf"
          />
          <label
            htmlFor="pc-upload-nf"
            className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploadando
                ? 'border-amber-300 bg-amber-100'
                : 'border-amber-300 hover:bg-amber-100'
            }`}
          >
            {uploadando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span className="text-sm text-amber-700">Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 font-medium">
                  Clique ou arraste arquivo aqui
                </span>
              </>
            )}
          </label>
        </div>
      )}

      {/* Leitura da última NF anexada */}
      {todoAnexos.length > 0 && (
        <PCNotaFiscalLeitura
          anexo={todoAnexos[todoAnexos.length - 1]}
          pedidoId={pedidoId}
          pedidoData={pedidoData}
          onDadosExtraidos={(dados) => {
            // Callback para quando dados são extraídos com sucesso
            if (onAnexoAdicionado) onAnexoAdicionado(dados);
          }}
          onAplicarNF={onAplicarNF}
        />
      )}

      {/* Lista de Anexos */}
      {todoAnexos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-800">
            {todoAnexos.length} arquivo(s) anexado(s)
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {todoAnexos.map((anexo) => {
              const isLocal = anexo.id?.startsWith('local-');
              return (
                <div
                  key={anexo.id}
                  className="flex items-center justify-between gap-2 p-2 bg-white border border-amber-100 rounded text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 truncate">{anexo.nome_original}</p>
                      <p className="text-gray-500">
                        {getTipoArquivo(anexo.tipo_arquivo)} • {formatarTamanho(anexo.tamanho)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {anexo.status_ia === 'PROCESSADO' && (
                      <CheckCircle2 className="w-3 h-3 text-green-600" title="Processado por IA" />
                    )}
                    {anexo.status_ia === 'PENDENTE' && (
                      <div className="w-3 h-3 bg-yellow-400 rounded-full" title="Aguardando processamento" />
                    )}
                    {anexo.status_ia === 'PROCESSANDO' && (
                      <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                    )}
                    {anexo.status_ia === 'ERRO' && (
                      <AlertCircle className="w-3 h-3 text-red-600" title="Erro no processamento" />
                    )}

                    {!disabled && isLocal && (
                      <button
                        type="button"
                        onClick={() => handleRemoverLocal(anexo.id)}
                        className="p-1 hover:bg-red-50 rounded text-red-500"
                        title="Remover anexo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {todoAnexos.length === 0 && (
        <p className="text-xs text-amber-600 italic text-center py-2">
          Nenhum arquivo anexado ainda
        </p>
      )}
    </div>
  );
}