import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * FormNotaFiscal - Componente reutilizável para upload e leitura de NF com IA
 * 
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - contexto_tipo: string (PEDIDO_COMPRA, RECEBIMENTO, VIAGEM, FINANCEIRO, OBRA)
 * - contexto_id: string (id do pedido, recebimento, etc)
 * - onSuccess: (nf) => void
 */
export default function FormNotaFiscal({ open, onClose, contexto_tipo, contexto_id, onSuccess }) {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [etapa, setEtapa] = useState('upload'); // upload, processando, editando
  const [dadosExtraidos, setDadosExtraidos] = useState(null);

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    },
  });

  const processarComIAMutation = useMutation({
    mutationFn: async (file_url) => {
      const response = await base44.functions.invoke('processarNotaFiscalComIA', {
        file_url,
        contexto_tipo,
        contexto_id,
      });
      return response.data;
    },
  });

  const salvarNFMutation = useMutation({
    mutationFn: async (dados) => {
      const nf = await base44.entities.NotaFiscal.create({
        numero_nf: dados.numero_nf,
        chave_nf: dados.chave_nf || null,
        data_emissao: dados.data_emissao,
        fornecedor_nome: dados.fornecedor_nome,
        fornecedor_cnpj: dados.fornecedor_cnpj || null,
        valor_total: Number(dados.valor_total) || 0,
        valor_impostos: Number(dados.valor_impostos) || 0,
        arquivo_url: dados.arquivo_url,
        contexto_tipo,
        contexto_id,
        status: 'VALIDADA',
        observacao: dados.observacao || '',
      });

      // Log de auditoria
      await base44.integrations.Core.InvokeLLM({
        prompt: `Log de criação de NF ${nf.numero_nf}`,
      });

      return nf;
    },
  });

  const handleUploadArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivo(file.name);
    setArquivo(file);
    setEtapa('processando');

    try {
      // 1. Upload do arquivo
      const file_url = await uploadMutation.mutateAsync(file);

      // 2. Processar com IA
      const dados = await processarComIAMutation.mutateAsync(file_url);

      setDadosExtraidos({ ...dados, arquivo_url: file_url });
      setEtapa('editando');
      toast.success('NF lida com sucesso');
    } catch (err) {
      toast.error('Erro ao processar NF: ' + err.message);
      setEtapa('upload');
    }
  };

  const handleEditarCampo = async (campo, valor) => {
    const valorOriginal = dadosExtraidos[campo];
    if (valorOriginal !== valor) {
      // Registrar alteração em auditoria (background)
      try {
        await base44.functions.invoke('registrarAlteracaoNotaFiscal', {
          nf_id: dadosExtraidos.id || 'novo',
          campo,
          valor_original: valorOriginal,
          valor_novo: valor,
        });
      } catch (err) {
        console.error('Erro ao registrar alteração:', err);
      }
    }
    setDadosExtraidos(prev => ({ ...prev, [campo]: valor }));
  };

  const handleConfirmar = async () => {
    try {
      const nf = await salvarNFMutation.mutateAsync(dadosExtraidos);
      qc.invalidateQueries({ queryKey: ['notas-fiscais'] });
      toast.success('NF registrada com sucesso');
      onSuccess?.(nf);
      onClose();
      setEtapa('upload');
      setDadosExtraidos(null);
      setArquivo(null);
      setNomeArquivo('');
    } catch (err) {
      toast.error('Erro ao salvar NF: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Nota Fiscal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ETAPA 1: UPLOAD */}
          {etapa === 'upload' && (
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-medium text-gray-900 mb-2">
                Faça upload da Nota Fiscal
              </p>
              <p className="text-xs text-gray-500 mb-4">
                PDF, Imagem ou XML (máx 10MB)
              </p>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xml"
                onChange={handleUploadArquivo}
                disabled={uploadMutation.isPending}
                className="hidden"
                id="nf-upload"
              />
              <Button
                onClick={() => document.getElementById('nf-upload').click()}
                disabled={uploadMutation.isPending}
                className="gap-2"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>
          )}

          {/* ETAPA 2: PROCESSANDO */}
          {etapa === 'processando' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-gray-900">
                Lendo Nota Fiscal com IA...
              </p>
              <p className="text-xs text-gray-500">{nomeArquivo}</p>
            </div>
          )}

          {/* ETAPA 3: EDITANDO */}
          {etapa === 'editando' && dadosExtraidos && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900">
                  <p className="font-semibold">NF lida com sucesso</p>
                  <p>Verifique e edite os dados antes de confirmar</p>
                </div>
              </div>

              {/* Campos Editáveis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Número NF</label>
                  <Input
                    value={dadosExtraidos.numero_nf || ''}
                    onChange={(e) => handleEditarCampo('numero_nf', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Chave (44 dígitos)</label>
                  <Input
                    value={dadosExtraidos.chave_nf || ''}
                    onChange={(e) => handleEditarCampo('chave_nf', e.target.value)}
                    className="text-sm"
                    maxLength={44}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Data Emissão</label>
                  <Input
                    type="date"
                    value={dadosExtraidos.data_emissao?.split('T')[0] || ''}
                    onChange={(e) => handleEditarCampo('data_emissao', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Fornecedor</label>
                  <Input
                    value={dadosExtraidos.fornecedor_nome || ''}
                    onChange={(e) => handleEditarCampo('fornecedor_nome', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">CNPJ Fornecedor</label>
                  <Input
                    value={dadosExtraidos.fornecedor_cnpj || ''}
                    onChange={(e) => handleEditarCampo('fornecedor_cnpj', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Valor Total (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dadosExtraidos.valor_total || 0}
                    onChange={(e) => handleEditarCampo('valor_total', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Impostos (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dadosExtraidos.valor_impostos || 0}
                    onChange={(e) => handleEditarCampo('valor_impostos', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="text-xs font-semibold text-gray-600">Observação</label>
                <textarea
                  value={dadosExtraidos.observacao || ''}
                  onChange={(e) => handleEditarCampo('observacao', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-md p-2 resize-none"
                  rows="2"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEtapa('upload');
                    setDadosExtraidos(null);
                  }}
                  disabled={salvarNFMutation.isPending}
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirmar}
                  disabled={salvarNFMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {salvarNFMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Confirmando...
                    </>
                  ) : (
                    'Confirmar e Salvar'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}