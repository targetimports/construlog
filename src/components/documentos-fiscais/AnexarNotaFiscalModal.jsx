import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle2, AlertCircle, Info, Lock } from 'lucide-react';
import { toast } from 'sonner';
import PainelHistoricoNF from './PainelHistoricoNF';

/**
 * AnexarNotaFiscalModal - Modal padrão para anexar e processar NF
 * Fluxo: ENVIADO -> ANALISADO_IA -> CONFIRMADO
 * Com auditoria e controle de permissões
 */
export default function AnexarNotaFiscalModal({
  open,
  onClose,
  referencia_tipo,
  referencia_id,
  onSuccess,
}) {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [etapa, setEtapa] = useState('upload'); // upload, analisando, editando, confirmando
  const [historicoExpanded, setHistoricoExpanded] = useState(false);
  const [nfIdAtual, setNfIdAtual] = useState(null);
  const [dadosNF, setDadosNF] = useState({
    numero: '',
    chave_acesso: '',
    emissor_nome: '',
    emissor_cnpj: '',
    data_emissao: '',
    valor_total: 0,
    valor_desconto: 0,
    valor_frete: 0,
    valor_outros: 0,
    observacao: '',
    arquivo_url: '',
    ai_json: null,
  });
  const [alteracoesRegistradas, setAlteracoesRegistradas] = useState([]);

  // Verificar permissão do usuário
  const { data: user } = useQuery({
    queryKey: ['user-atual'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000
  });

  const { data: historicoAuditoria = [] } = useQuery({
    queryKey: ['nf-auditoria-modal', nfIdAtual],
    queryFn: () => nfIdAtual ? base44.entities.NotaFiscalAuditoria.filter({ documento_fiscal_id: nfIdAtual }, '-created_date', 20) : [],
    enabled: !!nfIdAtual && etapa === 'editando'
  });

  // Verificar se usuário pode editar valores (Financeiro, Diretoria, Admin)
  const podeEditarValores = user && ['admin', 'financeiro', 'diretoria'].includes(user.role?.toLowerCase());

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    },
  });

  const processarComIAMutation = useMutation({
    mutationFn: async (file_url) => {
      // Criar documento fiscal temporário
      const nf = await base44.entities.NotaFiscal.create({
        tipo: 'NF',
        numero: 'TEMP',
        data_emissao: new Date().toISOString().split('T')[0],
        emissor_nome: 'Processando...',
        valor_total: 0,
        status: 'ENVIADO',
        arquivo_url: file_url,
        criado_por_user_id: (await base44.auth.me()).email,
      });

      // Analisar com IA
      const response = await base44.functions.invoke('analisarDocumentoFiscal', {
        documento_fiscal_id: nf.id,
      });

      return { ...response.data.dados_extraidos, nf_id: nf.id, aviso: response.data.aviso };
    },
  });

  const salvarNotaFiscalMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('salvarNotaFiscalCompleta', {
        nf_data: dadosNF,
        referencia_tipo,
        referencia_id,
        alteracoes_auditoria: alteracoesRegistradas,
      });
      return response.data;
    },
  });

  const handleUploadArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivo(file.name);
    setArquivo(file);
    setEtapa('analisando');

    try {
      const file_url = await uploadMutation.mutateAsync(file);
      const dados = await processarComIAMutation.mutateAsync(file_url);

      setNfIdAtual(dados.nf_id);
      setDadosNF(prev => ({
        ...prev,
        numero: dados.numero || '',
        chave_acesso: dados.emissor_cnpj || '',
        emissor_nome: dados.emissor_nome || '',
        emissor_cnpj: dados.emissor_cnpj || '',
        data_emissao: dados.data_emissao || '',
        valor_total: Number(dados.valor_total) || 0,
        valor_frete: Number(dados.valor_frete) || 0,
        valor_desconto: Number(dados.valor_desconto) || 0,
        valor_outros: Number(dados.valor_outros) || 0,
        arquivo_url: file_url,
        ai_json: dados,
        nf_id: dados.nf_id,
      }));

      setEtapa('editando');
      toast.success('Documento analisado com sucesso!');
    } catch (err) {
      toast.error('Erro ao analisar: ' + err.message);
      setEtapa('upload');
    }
  };

  const handleEditarCampo = async (campo, valor) => {
    // Verificar permissão para campos financeiros
    const camposFinanceiros = ['valor_total', 'valor_desconto', 'valor_frete', 'valor_outros'];
    if (camposFinanceiros.includes(campo) && !podeEditarValores) {
      toast.error('Você não tem permissão para editar valores financeiros');
      return;
    }

    const valorAnterior = dadosNF[campo];
    
    // Registrar alteração se houve mudança
    if (valorAnterior !== valor) {
      setAlteracoesRegistradas(prev => [
        ...prev,
        {
          campo,
          valor_antigo: String(valorAnterior || ''),
          valor_novo: String(valor),
          timestamp: new Date().toISOString(),
        },
      ]);

      // Se NF já existe, registrar na auditoria imediatamente
      if (nfIdAtual) {
        try {
          await base44.functions.invoke('registrarAlteracaoNFAuditoria', {
            documento_fiscal_id: nfIdAtual,
            campo_alterado: campo,
            valor_antigo: valorAnterior,
            valor_novo: valor,
            motivo: 'Edição de valor',
            acao: 'EDICAO'
          });
          qc.invalidateQueries({ queryKey: ['nf-auditoria-modal', nfIdAtual] });
        } catch (err) {
          console.error('Erro registrando auditoria:', err);
        }
      }
    }

    setDadosNF(prev => ({ ...prev, [campo]: valor }));
  };

  // Calcular valor final ajustado
  const valorFinalAjustado = 
    dadosNF.valor_total - 
    dadosNF.valor_desconto + 
    dadosNF.valor_frete + 
    dadosNF.valor_outros;

  const handleConfirmar = async () => {
    if (!dadosNF.numero || !dadosNF.data_emissao) {
      toast.error('Número e data de emissão são obrigatórios');
      return;
    }

    setEtapa('confirmando');
    try {
      const nf = await salvarNotaFiscalMutation.mutateAsync();
      qc.invalidateQueries({ queryKey: ['notas-fiscais'] });
      toast.success('Nota Fiscal anexada com sucesso!');
      onSuccess?.(nf);
      
      // Reset
      setEtapa('upload');
      setDadosNF({
        numero: '',
        chave_acesso: '',
        emissor_nome: '',
        emissor_cnpj: '',
        data_emissao: '',
        valor_total: 0,
        valor_desconto: 0,
        valor_frete: 0,
        valor_outros: 0,
        observacao: '',
        arquivo_url: '',
        ai_json: null,
      });
      setAlteracoesRegistradas([]);
      setArquivo(null);
      setNomeArquivo('');
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
      setEtapa('editando');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anexar Nota Fiscal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ETAPA 1: UPLOAD */}
          {etapa === 'upload' && (
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-medium text-gray-900 mb-2">Upload da Nota Fiscal</p>
              <p className="text-xs text-gray-500 mb-4">PDF, JPG, PNG ou XML (máx 10MB)</p>
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
                  <><Loader2 className="w-4 h-4 animate-spin" />Carregando...</>
                ) : (
                  <><Upload className="w-4 h-4" />Selecionar Arquivo</>
                )}
              </Button>
            </div>
          )}

          {/* ETAPA 2: ANALISANDO */}
          {etapa === 'analisando' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-gray-900">Analisando com IA...</p>
              <p className="text-xs text-gray-500">{nomeArquivo}</p>
            </div>
          )}

          {/* ETAPA 3: EDITANDO */}
          {etapa === 'editando' && (
            <div className="space-y-4">
              {/* Aviso de IA */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-semibold">Valores sugeridos pela IA</p>
                  <p>Revise todos os campos e edite se necessário antes de confirmar.</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-xs text-blue-900">
                  <p className="font-semibold">Documento analisado</p>
                  <p>Verifique e edite os dados conforme necessário</p>
                </div>
              </div>

              {/* Arquivo */}
              {dadosNF.arquivo_url && (
                <div className="text-xs">
                  <a href={dadosNF.arquivo_url} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline">
                    Visualizar arquivo original
                  </a>
                </div>
              )}

              {/* Seção 1: Identificação */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-900">Identificação</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Número *</label>
                    <Input
                      value={dadosNF.numero}
                      onChange={(e) => handleEditarCampo('numero', e.target.value)}
                      placeholder="Ex: 12345"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Chave (44 dígitos)</label>
                    <Input
                      value={dadosNF.chave_acesso}
                      onChange={(e) => handleEditarCampo('chave_acesso', e.target.value)}
                      placeholder="Chave da NF-e"
                      maxLength={44}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Data Emissão *</label>
                  <Input
                    type="date"
                    value={dadosNF.data_emissao}
                    onChange={(e) => handleEditarCampo('data_emissao', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Seção 2: Emissor */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-900">Emissor</h3>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Nome *</label>
                  <Input
                    value={dadosNF.emissor_nome}
                    onChange={(e) => handleEditarCampo('emissor_nome', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">CNPJ</label>
                  <Input
                    value={dadosNF.emissor_cnpj}
                    onChange={(e) => handleEditarCampo('emissor_cnpj', e.target.value)}
                    placeholder="Ex: 12345678000198"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Seção 3: Valores */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-900">Valores</h3>
                  {!podeEditarValores && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      <Lock className="w-3 h-3" />
                      Visualização
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Valor Total (R$) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={dadosNF.valor_total}
                      onChange={(e) => handleEditarCampo('valor_total', Number(e.target.value))}
                      disabled={!podeEditarValores}
                      className="text-sm"
                      title={!podeEditarValores ? 'Apenas Financeiro, Diretoria ou Admin podem editar' : ''}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Desconto (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={dadosNF.valor_desconto}
                      onChange={(e) => handleEditarCampo('valor_desconto', Number(e.target.value))}
                      disabled={!podeEditarValores}
                      className="text-sm"
                      title={!podeEditarValores ? 'Apenas Financeiro, Diretoria ou Admin podem editar' : ''}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Frete (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={dadosNF.valor_frete}
                      onChange={(e) => handleEditarCampo('valor_frete', Number(e.target.value))}
                      disabled={!podeEditarValores}
                      className="text-sm"
                      title={!podeEditarValores ? 'Apenas Financeiro, Diretoria ou Admin podem editar' : ''}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Outros (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={dadosNF.valor_outros}
                      onChange={(e) => handleEditarCampo('valor_outros', Number(e.target.value))}
                      disabled={!podeEditarValores}
                      className="text-sm"
                      title={!podeEditarValores ? 'Apenas Financeiro, Diretoria ou Admin podem editar' : ''}
                    />
                  </div>
                </div>

                {/* Valor Final Calculado */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Valor Final Ajustado:</span>
                  <span className="text-lg font-bold text-green-600">
                    R$ {valorFinalAjustado.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Observações */}
              <div className="border rounded-lg p-4">
                <label className="text-xs font-semibold text-gray-700 block mb-2">
                  Observações
                </label>
                <textarea
                  value={dadosNF.observacao}
                  onChange={(e) => handleEditarCampo('observacao', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-md p-2 resize-none"
                  rows="2"
                  placeholder="Informações adicionais..."
                />
              </div>

              {/* Histórico de Alterações na Sessão Atual */}
              {alteracoesRegistradas.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-900 mb-2">
                    Alterações nesta sessão: {alteracoesRegistradas.length}
                  </p>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-xs text-amber-800">
                    {alteracoesRegistradas.map((alt, idx) => (
                      <div key={idx} className="flex gap-1">
                        <span className="font-medium">{alt.campo}:</span>
                        <span className="line-through">{alt.valor_antigo}</span>
                        <span>→</span>
                        <span className="font-medium">{alt.valor_novo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Painel de Histórico de Auditoria */}
              <PainelHistoricoNF
                historicoAuditoria={historicoAuditoria}
                isExpanded={historicoExpanded}
                onToggle={() => setHistoricoExpanded(!historicoExpanded)}
              />

              {/* Botões */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEtapa('upload');
                    setDadosNF({
                      numero: '',
                      chave_acesso: '',
                      emissor_nome: '',
                      emissor_cnpj: '',
                      data_emissao: '',
                      valor_total: 0,
                      valor_desconto: 0,
                      valor_frete: 0,
                      valor_outros: 0,
                      observacao: '',
                      arquivo_url: '',
                      ai_json: null,
                    });
                    setAlteracoesRegistradas([]);
                  }}
                  disabled={salvarNotaFiscalMutation.isPending}
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirmar}
                  disabled={salvarNotaFiscalMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {salvarNotaFiscalMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Confirmando...</>
                  ) : (
                    'Confirmar e Anexar'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 4: CONFIRMANDO */}
          {etapa === 'confirmando' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-green-500" />
              <p className="text-sm font-medium text-gray-900">Salvando Nota Fiscal...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}