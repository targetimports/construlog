import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Loader2, AlertCircle } from 'lucide-react';

/**
 * Modal genérico para anexar NF a qualquer entidade
 * 
 * Uso:
 * <ModalAnexarNFGenerico
 *   open={open}
 *   referencia_tipo="PEDIDO"
 *   referencia_id={pedidoId}
 *   referencia_nome="PC-2026-001"
 *   onClose={() => setOpen(false)}
 *   onSuccess={() => { refresh data }}
 * />
 */
export default function ModalAnexarNFGenerico({
  open,
  referencia_tipo,
  referencia_id,
  referencia_nome,
  onClose,
  onSuccess,
}) {
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState('upload'); // upload, analise, confirmacao
  const [arquivo, setArquivo] = useState(null);
  const [nfData, setNfData] = useState({
    numero: '',
    chave_acesso: '',
    emissor_nome: '',
    data_emissao: '',
    valor_total: 0,
    observacao: '',
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    },
  });

  const analisarMutation = useMutation({
    mutationFn: async (fileUrl) => {
      const { data } = await base44.functions.invoke('processarNotaFiscalComIA', {
        arquivo_url: fileUrl,
      });
      return data;
    },
  });

  const salvarMutation = useMutation({
    mutationFn: async (nfPayload) => {
      // Criar NF
      const nf = await base44.entities.NotaFiscal.create({
        tipo: 'NF',
        numero: nfPayload.numero,
        chave_acesso: nfPayload.chave_acesso,
        emissor_nome: nfPayload.emissor_nome,
        data_emissao: nfPayload.data_emissao,
        valor_total: nfPayload.valor_total,
        valor_final_ajustado: nfPayload.valor_total,
        status: 'ANALISADO_IA',
        arquivo_url: arquivo?.url,
        observacao: nfPayload.observacao,
      });

      // Vincular
      await base44.entities.NotaFiscalVinculo.create({
        documento_fiscal_id: nf.id,
        referencia_tipo,
        referencia_id,
        referencia_nome,
      });

      // Registrar auditoria
      await base44.entities.NotaFiscalAuditoria.create({
        documento_fiscal_id: nf.id,
        user_id: (await base44.auth.me()).email,
        acao: 'CRIACAO',
        campo_alterado: 'status',
        valor_antigo: null,
        valor_novo: 'ANALISADO_IA',
        motivo: `Anexado via módulo ${referencia_tipo}`,
      });

      return nf;
    },
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setArquivo(file);
    uploadMutation.mutate(file, {
      onSuccess: async (fileUrl) => {
        toast.loading('Analisando com IA...');
        analisarMutation.mutate(fileUrl, {
          onSuccess: (iaData) => {
            toast.dismiss();
            setNfData({
              numero: iaData.numero_extraido || '',
              chave_acesso: iaData.chave_extraida || '',
              emissor_nome: iaData.emissor_extraido?.nome || '',
              data_emissao: iaData.data_extraida || '',
              valor_total: iaData.valores_extraidos?.total || 0,
              observacao: `IA confiança: ${(iaData.confianca * 100).toFixed(0)}%`,
            });
            setArquivo(prev => ({ ...prev, url: fileUrl }));
            setEtapa('confirmacao');
            toast.success('NF analisada! Revise os dados abaixo.');
          },
          onError: () => {
            toast.error('Erro na análise. Preencha manualmente.');
            setArquivo(prev => ({ ...prev, url: fileUrl }));
            setEtapa('confirmacao');
          },
        });
      },
      onError: () => {
        toast.error('Erro ao fazer upload');
      },
    });
  };

  const handleSalvar = () => {
    if (!nfData.numero || !nfData.data_emissao || !nfData.valor_total) {
      toast.error('Preencha número, data e valor da NF');
      return;
    }

    salvarMutation.mutate(nfData, {
      onSuccess: () => {
        toast.success('✓ NF anexada com sucesso!');
        qc.invalidateQueries({ queryKey: ['nf-vinculos', referencia_id] });
        onSuccess?.();
        handleFechar();
      },
      onError: (error) => {
        toast.error('Erro: ' + error.message);
      },
    });
  };

  const handleFechar = () => {
    setEtapa('upload');
    setArquivo(null);
    setNfData({
      numero: '',
      chave_acesso: '',
      emissor_nome: '',
      data_emissao: '',
      valor_total: 0,
      observacao: '',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Anexar Nota Fiscal</DialogTitle>
        </DialogHeader>

        {/* ETAPA 1: Upload */}
        {etapa === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="nf-file" className="text-sm font-semibold text-gray-900">
                Enviar PDF/Imagem
              </label>
              <div className="flex items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition cursor-pointer">
                <label htmlFor="nf-file" className="cursor-pointer flex flex-col items-center gap-2 w-full">
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-600 font-medium">
                    {uploadMutation.isPending ? 'Enviando...' : 'Clique para selecionar ou arraste'}
                  </span>
                  <span className="text-xs text-gray-500">PDF, PNG, JPG (máx 10MB)</span>
                </label>
                <input
                  id="nf-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>A IA analisará automaticamente e sugerirá valores que você pode editar.</p>
            </div>

            <Button onClick={handleFechar} variant="outline" className="w-full">
              Cancelar
            </Button>
          </div>
        )}

        {/* ETAPA 2: Confirmação */}
        {etapa === 'confirmacao' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-900">Número da NF *</label>
              <Input
                value={nfData.numero}
                onChange={(e) => setNfData(d => ({ ...d, numero: e.target.value }))}
                placeholder="Ex: 12345"
                disabled={salvarMutation.isPending}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-900">Chave de Acesso</label>
              <Input
                value={nfData.chave_acesso}
                onChange={(e) => setNfData(d => ({ ...d, chave_acesso: e.target.value }))}
                placeholder="44 dígitos"
                disabled={salvarMutation.isPending}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-900">Emissor *</label>
              <Input
                value={nfData.emissor_nome}
                onChange={(e) => setNfData(d => ({ ...d, emissor_nome: e.target.value }))}
                placeholder="Razão social"
                disabled={salvarMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-900">Data *</label>
                <Input
                  type="date"
                  value={nfData.data_emissao}
                  onChange={(e) => setNfData(d => ({ ...d, data_emissao: e.target.value }))}
                  disabled={salvarMutation.isPending}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-900">Valor *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={nfData.valor_total}
                  onChange={(e) => setNfData(d => ({ ...d, valor_total: Number(e.target.value) }))}
                  disabled={salvarMutation.isPending}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-900">Observação</label>
              <Textarea
                value={nfData.observacao}
                onChange={(e) => setNfData(d => ({ ...d, observacao: e.target.value }))}
                placeholder="Notas adicionais..."
                disabled={salvarMutation.isPending}
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleFechar}
                disabled={salvarMutation.isPending}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={salvarMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              >
                {salvarMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
                ) : (
                  'Anexar NF'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}