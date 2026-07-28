import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload, Zap, AlertTriangle, CheckCircle2, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function ModalAnexarNotaFiscalUniversal({
  open,
  onClose,
  referencia_tipo,
  referencia_id,
  referencia_nome,
  obra_id,
  onSuccess,
}) {
  const [stage, setStage] = useState('upload'); // upload, analyzing, editing, confirmed
  const [uploadedFile, setUploadedFile] = useState(null);
  const [nfData, setNfData] = useState(null);
  const [nfId, setNfId] = useState(null);
  const [editMode, setEditMode] = useState({});
  const [showAuditoria, setShowAuditoria] = useState(false);

  // Upload arquivo
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Criar NF
      const nf = await base44.functions.invoke('notaFiscalCriar', {
        arquivo_url: file_url,
        tipo: 'NF',
      });
      
      return nf.data;
    },
    onSuccess: (nf) => {
      setNfId(nf.id);
      setNfData(nf);
      setStage('analyzing');
      toast.success('Arquivo enviado com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  // Analisar com IA
  const analisarMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('notaFiscalAnalisarIA', {
        documento_fiscal_id: nfId,
      });
      return result.data.nf;
    },
    onSuccess: (nfAtualizada) => {
      setNfData(nfAtualizada);
      setStage('editing');
      toast.success('Análise concluída com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro na análise: ${error.message}`);
    },
  });

  // Editar campo
  const editarMutation = useMutation({
    mutationFn: async ({ campo, valor_novo, motivo }) => {
      const result = await base44.functions.invoke('notaFiscalEditar', {
        documento_fiscal_id: nfId,
        campo,
        valor_novo,
        motivo,
      });
      return result.data.nf;
    },
    onSuccess: (nfAtualizada) => {
      setNfData(nfAtualizada);
      toast.success('Campo atualizado');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Confirmar
  const confirmarMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('notaFiscalConfirmar', {
        documento_fiscal_id: nfId,
      });
      return result.data.nf;
    },
    onSuccess: (nfConfirmada) => {
      setNfData(nfConfirmada);
      setStage('linking');
      toast.success('Documento confirmado');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Vincular
  const vincularMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('notaFiscalVincular', {
        documento_fiscal_id: nfId,
        referencia_tipo,
        referencia_id,
        referencia_nome,
        obra_id: obra_id || null,
      });
      return result.data.vinculo;
    },
    onSuccess: () => {
      toast.success('Documento vinculado com sucesso');
      onSuccess && onSuccess();
      handleClose();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Buscar auditoria
  const { data: auditoria = [] } = useQuery({
    queryKey: ['nfAuditoria', nfId],
    queryFn: async () => {
      if (!nfId) return [];
      const result = await base44.functions.invoke('notaFiscalObter', {
        documento_fiscal_id: nfId,
      });
      return result.data.auditoria || [];
    },
    enabled: !!nfId && showAuditoria,
  });

  const handleClose = () => {
    setStage('upload');
    setUploadedFile(null);
    setNfData(null);
    setNfId(null);
    setEditMode({});
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleFieldChange = (campo, valor) => {
    setEditMode({ ...editMode, [campo]: true });
    
    const novoValor = campo.startsWith('valor_') ? parseFloat(valor) : valor;
    editarMutation.mutate({
      campo,
      valor_novo: novoValor,
      motivo: 'Edição manual do usuário',
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anexar Nota Fiscal / Documento</DialogTitle>
        </DialogHeader>

        {/* STAGE: UPLOAD */}
        {stage === 'upload' && (
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Upload className="h-4 w-4" />
              <AlertDescription>
                Envie PDF, imagem ou XML da nota fiscal para iniciar
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xml"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium">
                  {uploadedFile ? uploadedFile.name : 'Clique para selecionar arquivo'}
                </p>
              </label>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => uploadMutation.mutate(uploadedFile)}
                disabled={!uploadedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STAGE: ANALYZING */}
        {stage === 'analyzing' && nfData && (
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                Analisando com IA... Extraindo dados do documento
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => analisarMutation.mutate()}
                disabled={analisarMutation.isPending}
              >
                {analisarMutation.isPending ? 'Analisando...' : 'Analisar com IA'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STAGE: EDITING */}
        {stage === 'editing' && nfData && (
          <div className="space-y-4">
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="auditoria">Histórico</TabsTrigger>
              </TabsList>

              {/* ABA: DADOS */}
              <TabsContent value="dados" className="space-y-4">
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    Valores sugeridos pela IA — revise e ajuste se necessário
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tipo e Número</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={nfData.tipo} onValueChange={(val) => handleFieldChange('tipo', val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NF">NF</SelectItem>
                          <SelectItem value="NFE">NFe</SelectItem>
                          <SelectItem value="NFS">NFS</SelectItem>
                          <SelectItem value="RECIBO">Recibo</SelectItem>
                          <SelectItem value="OUTRO">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Número"
                        value={nfData.numero}
                        onChange={(e) => handleFieldChange('numero', e.target.value)}
                      />
                    </div>
                    <Input
                      placeholder="Chave de acesso (44 dígitos)"
                      value={nfData.chave_acesso || ''}
                      onChange={(e) => handleFieldChange('chave_acesso', e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Emissor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Razão social / Nome"
                      value={nfData.emissor_nome}
                      onChange={(e) => handleFieldChange('emissor_nome', e.target.value)}
                    />
                    <Input
                      placeholder="CNPJ (sem formatação)"
                      value={nfData.emissor_cnpj || ''}
                      onChange={(e) => handleFieldChange('emissor_cnpj', e.target.value)}
                    />
                    <Input
                      type="date"
                      value={nfData.data_emissao}
                      onChange={(e) => handleFieldChange('data_emissao', e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Valores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Total
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={nfData.valor_total}
                          onChange={(e) => handleFieldChange('valor_total', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Desconto
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={nfData.valor_desconto}
                          onChange={(e) => handleFieldChange('valor_desconto', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Frete
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={nfData.valor_frete}
                          onChange={(e) => handleFieldChange('valor_frete', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Outros
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={nfData.valor_outros}
                          onChange={(e) => handleFieldChange('valor_outros', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Valor Final Ajustado</p>
                      <p className="text-lg font-bold text-blue-600">
                        R$ {nfData.valor_final_ajustado?.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ABA: AUDITORIA */}
              <TabsContent value="auditoria" className="space-y-3">
                {auditoria.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem histórico</p>
                ) : (
                  <div className="space-y-2">
                    {auditoria.map((audit, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 text-xs">
                            <p className="font-semibold">{audit.user_nome}</p>
                            <p className="text-gray-600">{audit.acao}</p>
                            <p className="text-gray-500">
                              {audit.campo_alterado}: <span className="line-through">{audit.valor_antigo}</span> →{' '}
                              <span className="font-semibold">{audit.valor_novo}</span>
                            </p>
                            {audit.motivo && (
                              <p className="text-gray-500 italic mt-1">{audit.motivo}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(audit.created_date).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={() => setStage('upload')}
              >
                Nova Foto
              </Button>
              <Button
                onClick={() => confirmarMutation.mutate()}
                disabled={confirmarMutation.isPending || !nfData.numero}
              >
                {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STAGE: LINKING */}
        {stage === 'linking' && nfData && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Documento confirmado! Vincular ao registro {referencia_nome || referencia_id}
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumo da NF</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Número:</span>
                  <span className="font-semibold">{nfData.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Emissor:</span>
                  <span className="font-semibold">{nfData.emissor_nome}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Valor Final:</span>
                  <span className="font-bold text-blue-600">
                    R$ {nfData.valor_final_ajustado?.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => vincularMutation.mutate()}
                disabled={vincularMutation.isPending}
              >
                {vincularMutation.isPending ? 'Vinculando...' : 'Vincular ao Registro'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}