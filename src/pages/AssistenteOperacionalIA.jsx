import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, CheckCircle2, AlertCircle, Clock, Undo2, Loader2, Edit3, Trash2, ExternalLink, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { ListSkeleton } from '@/components/shared/Skeletons';

export default function AssistenteOperacionalIA() {
  const [comando, setComando] = useState('');
  const [conversas, setConversas] = useState([]);
  const [actionDraft, setActionDraft] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const conversaRef = useRef(null);
  const recognitionRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const [obraSelecionada, setObraSelecionada] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs-ia'],
    queryFn: () => base44.entities.LogAcaoIA.list('-created_date', 50)
  });

  // Detectar se é comando ou pergunta
  const detectarTipo = (texto) => {
    const palavrasConsulta = ['quanto', 'qual', 'quais', 'quando', 'onde', 'como', 'gastei', 'gastou', 'recebi', 'paguei', 'devo', 'total', 'resumo', 'lista', 'mostrar', 'ver'];
    const palavrasAcao = ['criar', 'pagar', 'receber', 'registrar', 'lançar', 'bota', 'adicionar', 'excluir', 'deletar', 'editar', 'alterar'];
    
    const textoLower = texto.toLowerCase();
    const temConsulta = palavrasConsulta.some(p => textoLower.includes(p));
    const temAcao = palavrasAcao.some(p => textoLower.includes(p));
    
    // Se tiver palavras de ação, é comando
    if (temAcao) return 'comando';
    // Se tiver palavras de consulta, é pergunta
    if (temConsulta) return 'consulta';
    // Se começar com R$, valor, número, provavelmente é comando
    if (/^(r\$|rs|\d+)/.test(textoLower)) return 'comando';
    // Default: consulta (mais seguro)
    return 'consulta';
  };

  // Consulta (perguntas)
  const consultaMutation = useMutation({
    mutationFn: async (pergunta) => {
      const response = await base44.functions.invoke('assistenteConsulta', {
        pergunta,
        contexto: {
          obraId: obraSelecionada,
          userId: user?.id
        }
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setConversas(prev => [...prev, {
          tipo: 'resposta',
          mensagem: data.resposta,
          timestamp: new Date()
        }]);
      } else {
        toast.error('Não consegui responder');
      }
    },
    onError: (error) => {
      setConversas(prev => [...prev, {
        tipo: 'erro',
        mensagem: 'Desculpe, não consegui processar sua pergunta.',
        timestamp: new Date()
      }]);
      toast.error('Erro ao processar pergunta');
    }
  });

  // Passo 1: Parse do comando (ações)
  const parseComandoMutation = useMutation({
    mutationFn: async (cmd) => {
      const response = await base44.functions.invoke('parseAssistantCommand', {
        comando: cmd,
        contexto: {
          obraId: obraSelecionada,
          userId: user?.id,
          perfil: user?.perfil_sistema || user?.cargo
        }
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.needs_clarification) {
        const camposFaltantes = data.missing_fields.join(', ');
        setConversas(prev => [...prev, {
          tipo: 'aviso',
          mensagem: `⚠️ Dados incompletos. Por favor, informe: ${camposFaltantes}`,
          timestamp: new Date()
        }]);
        toast.warning(`Faltam dados: ${camposFaltantes}`);
        return;
      }
      
      if (data.success) {
        validarDraftMutation.mutate(data.actionDraft);
      } else {
        toast.error('Erro ao interpretar comando');
      }
    },
    onError: (error) => {
      setConversas(prev => [...prev, {
        tipo: 'erro',
        mensagem: error.message || 'Erro ao processar comando',
        timestamp: new Date()
      }]);
      toast.error('Erro ao processar comando');
    }
  });

  // Passo 2: Validar draft
  const validarDraftMutation = useMutation({
    mutationFn: async (draft) => {
      const response = await base44.functions.invoke('validateActionDraft', {
        actionDraft: draft
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.permissao_negada) {
        toast.error('❌ Sem permissão para esta ação');
        setConversas(prev => [...prev, {
          tipo: 'erro',
          mensagem: `❌ Sem permissão: ${data.errors.join(', ')}`,
          timestamp: new Date()
        }]);
        return;
      }

      if (!data.valid) {
        toast.error('⚠️ Dados incompletos ou inválidos');
        setConversas(prev => [...prev, {
          tipo: 'erro',
          mensagem: `⚠️ Erro de validação:\n${data.errors.join('\n')}`,
          timestamp: new Date()
        }]);
        return;
      }

      // Mostrar preview
      const draftValidado = { ...data.actionDraft, status: 'validated' };
      setActionDraft(draftValidado);
      setEditedFields({}); // Reset edited fields
      setShowPreview(true);

      // Warnings
      if (data.warnings && data.warnings.length > 0) {
        setConversas(prev => [...prev, {
          tipo: 'aviso',
          mensagem: `⚠️ ${data.warnings.join('\n')}`,
          timestamp: new Date()
        }]);
      }
    },
    onError: (error) => {
      toast.error('Erro na validação');
    }
  });

  // Passo 3: Executar ação
  const executarAcaoMutation = useMutation({
    mutationFn: async (draft) => {
      const response = await base44.functions.invoke('executeAssistantAction', {
        actionDraft: draft
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('✓ Ação executada com sucesso!');
        
        setConversas(prev => [...prev, {
          tipo: 'resposta',
          mensagem: `✓ Executado com sucesso!\n✓ ${data.entidade} atualizado\n✓ ID: ${data.registro_id}`,
          sucesso: true,
          timestamp: new Date()
        }]);

        // Log da ação
        base44.functions.invoke('logAssistantAction', {
          actionDraft,
          result: data,
          status: 'executado'
        });

        // Invalidar queries
        queryClient.invalidateQueries({ queryKey: ['logs-ia'] });
        queryClient.invalidateQueries({ queryKey: ['contas'] });
        queryClient.invalidateQueries({ queryKey: ['material'] });
        queryClient.invalidateQueries({ queryKey: ['frete'] });

        setShowPreview(false);
        setActionDraft(null);
      } else {
        toast.error('Erro: ' + data.error);
        setConversas(prev => [...prev, {
          tipo: 'erro',
          mensagem: `❌ Erro: ${data.error}\n${data.details || ''}`,
          timestamp: new Date()
        }]);
      }
    },
    onError: (error) => {
      toast.error('Erro ao executar ação');
      setConversas(prev => [...prev, {
        tipo: 'erro',
        mensagem: error.message || 'Erro ao executar',
        timestamp: new Date()
      }]);
    }
  });

  const desfazerAcaoMutation = useMutation({
    mutationFn: async (logId) => {
      const log = logs.find(l => l.id === logId);
      if (!log || !log.valor_anterior) {
        throw new Error('Não é possível desfazer esta ação');
      }

      // Restaurar valor anterior
      await base44.entities[log.entidade_afetada].update(log.registro_id, log.valor_anterior);
      
      // Marcar log como desfeito
      await base44.entities.LogAcaoIA.update(logId, {
        status: 'desfeito',
        desfeito_em: new Date().toISOString(),
        desfeito_por: user.email
      });

      return { log };
    },
    onSuccess: () => {
      toast.success('Ação desfeita com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['logs-ia'] });
    },
    onError: (error) => {
      toast.error('Erro ao desfazer: ' + error.message);
    }
  });

  const handleEnviar = (e) => {
    e.preventDefault();
    if (!comando.trim()) return;

    setConversas(prev => [...prev, {
      tipo: 'usuario',
      mensagem: comando,
      timestamp: new Date()
    }]);

    // Detectar tipo e rotear
    const tipo = detectarTipo(comando);
    
    if (tipo === 'consulta') {
      consultaMutation.mutate(comando);
    } else {
      parseComandoMutation.mutate(comando);
    }
    
    setComando('');
  };

  const handleConfirmarExecucao = () => {
    // Se for exclusão, pedir confirmação extra
    if (actionDraft.acao === 'DELETE_RECORD') {
      setShowDeleteConfirm(true);
      return;
    }
    
    // Mesclar campos editados
    const draftFinal = {
      ...actionDraft,
      dados: {
        ...actionDraft.dados,
        ...editedFields
      }
    };
    
    executarAcaoMutation.mutate(draftFinal);
  };

  const handleConfirmarExclusao = () => {
    const draftFinal = {
      ...actionDraft,
      dados: {
        ...actionDraft.dados,
        ...editedFields
      }
    };
    
    setShowDeleteConfirm(false);
    executarAcaoMutation.mutate(draftFinal);
  };

  const handleCancelarPreview = () => {
    setShowPreview(false);
    setActionDraft(null);
    setEditedFields({});
    toast.info('Ação cancelada');
  };

  const handleEditarCampos = () => {
    setShowEditDialog(true);
  };

  const handleSalvarEdicao = () => {
    setShowEditDialog(false);
    toast.success('Campos atualizados');
  };

  useEffect(() => {
    if (conversaRef.current) {
      conversaRef.current.scrollTop = conversaRef.current.scrollHeight;
    }
  }, [conversas]);

  // Inicializar reconhecimento de voz
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const texto = event.results[0][0].transcript;
        setTranscript(texto);
        setComando(texto);
        
        // Enviar automaticamente após transcrição
        setTimeout(() => {
          setConversas(prev => [...prev, {
            tipo: 'usuario',
            mensagem: texto,
            timestamp: new Date()
          }]);

          const tipo = detectarTipo(texto);
          if (tipo === 'consulta') {
            consultaMutation.mutate(texto);
          } else {
            parseComandoMutation.mutate(texto);
          }
          
          setComando('');
          setTranscript('');
        }, 300);
      };
      
      recognition.onerror = (event) => {
        console.error('Erro no reconhecimento de voz:', event.error);
        toast.error('Erro ao gravar áudio');
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const handleToggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error('Reconhecimento de voz não suportado neste navegador');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        toast.info('🎤 Gravando... Fale agora');
      } catch (error) {
        console.error('Erro ao iniciar gravação:', error);
        toast.error('Erro ao iniciar gravação');
      }
    }
  };

  const exemplos = [
    'R$ 500 combustível hoje',
    'quanto gastei hoje?',
    'paguei 180 de frete agora',
    'qual o total de gastos?',
    'criar conta a pagar 3500 fornecedor X vence dia 20'
  ];

  const getAcaoLabel = (acao) => {
    const labels = {
      'CREATE_EXPENSE': '💰 Criar Despesa',
      'CREATE_INCOME': '💵 Criar Receita',
      'CREATE_AP': '📝 Criar Conta a Pagar',
      'CREATE_AR': '📄 Criar Conta a Receber',
      'PAY_AP': '✅ Pagar Conta',
      'RECEIVE_AR': '✅ Receber Conta',
      'EDIT_RECORD': '✏️ Editar Registro',
      'DELETE_RECORD': '🗑️ Excluir Registro'
    };
    return labels[acao] || acao;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="🤖 Assistente Operacional IA"
        subtitle="Gerencie registros financeiros por comandos de texto"
      />

      {/* Seletor de Obra */}
      {obras && obras.length > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Obra:</label>
              <select
                value={obraSelecionada || ''}
                onChange={(e) => setObraSelecionada(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Nenhuma obra selecionada</option>
                {obras.map(obra => (
                  <option key={obra.id} value={obra.id}>{obra.nome}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                Conversa com IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Área de conversas */}
              <div 
                ref={conversaRef}
                className="h-96 overflow-y-auto space-y-3 bg-gray-50 rounded-lg p-4"
              >
                {conversas.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <Bot className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">Olá! Sou seu assistente operacional.</p>
                      <p className="text-sm text-gray-500">Digite um comando para começar.</p>
                    </div>
                  </div>
                ) : (
                  conversas.map((conv, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${conv.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
                    >
                      {conv.tipo !== 'usuario' && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div className={`max-w-md rounded-lg p-3 ${
                        conv.tipo === 'usuario' 
                          ? 'bg-blue-600 text-white'
                          : conv.tipo === 'erro'
                          ? 'bg-red-50 border border-red-200'
                          : conv.tipo === 'aviso'
                          ? 'bg-yellow-50 border border-yellow-200'
                          : conv.sucesso
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <p className={`text-sm whitespace-pre-line ${conv.tipo === 'usuario' ? 'text-white' : 'text-gray-900'}`}>
                          {conv.mensagem}
                        </p>
                      </div>
                      {conv.tipo === 'usuario' && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                {/* Preview da ação */}
                {showPreview && actionDraft && (
                  <div className="border-2 border-blue-500 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-600" />
                        <p className="font-bold text-blue-900">Preview da Ação</p>
                      </div>
                      {actionDraft.confidence && (
                        <Badge variant="outline" className="text-xs">
                          Confiança: {Math.round(actionDraft.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-3 text-sm bg-white rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-gray-600 font-medium">Ação:</span>
                        <Badge className="bg-blue-600 text-white">{getAcaoLabel(actionDraft.acao)}</Badge>
                      </div>
                      
                      {(actionDraft.dados.valor || editedFields.valor) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Valor:</span>
                          <span className="font-bold text-lg text-green-700">
                            R$ {(editedFields.valor || actionDraft.dados.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      
                      {(actionDraft.dados.descricao || editedFields.descricao) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Descrição:</span>
                          <span className="font-medium text-gray-900">{editedFields.descricao || actionDraft.dados.descricao}</span>
                        </div>
                      )}
                      
                      {(actionDraft.dados.categoria || editedFields.categoria) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Categoria:</span>
                          <Badge variant="outline">{editedFields.categoria || actionDraft.dados.categoria}</Badge>
                        </div>
                      )}
                      
                      {(actionDraft.dados.data || editedFields.data) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Data:</span>
                          <span className="font-medium">
                            {new Date(editedFields.data || actionDraft.dados.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      
                      {(actionDraft.dados.fornecedor_cliente || editedFields.fornecedor_cliente) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            {actionDraft.acao.includes('AR') ? 'Cliente:' : 'Fornecedor:'}
                          </span>
                          <span className="font-medium">{editedFields.fornecedor_cliente || actionDraft.dados.fornecedor_cliente}</span>
                        </div>
                      )}
                      
                      {(actionDraft.dados.data_vencimento || editedFields.data_vencimento) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Vencimento:</span>
                          <span className="font-medium">
                            {new Date(editedFields.data_vencimento || actionDraft.dados.data_vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      
                      {actionDraft.requires_approval && (
                        <div className="mt-3 pt-3 border-t">
                          <Badge className="bg-yellow-100 text-yellow-800 w-full justify-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Requer aprovação (valor alto ou perfil limitado)
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex justify-between pt-2 border-t text-xs">
                        <span className="text-gray-500">Entidade:</span>
                        <span className="text-gray-400">{actionDraft.entidade_alvo}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {actionDraft.acao === 'DELETE_RECORD' ? (
                        <Button
                          onClick={handleConfirmarExecucao}
                          disabled={executarAcaoMutation.isPending}
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          {executarAcaoMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Excluindo...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Confirmar Exclusão
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleConfirmarExecucao}
                          disabled={executarAcaoMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {executarAcaoMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Executando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Confirmar e Criar
                            </>
                          )}
                        </Button>
                      )}
                      
                      <Button
                        onClick={handleEditarCampos}
                        variant="outline"
                        disabled={executarAcaoMutation.isPending}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      
                      <Button
                        onClick={handleCancelarPreview}
                        variant="outline"
                        disabled={executarAcaoMutation.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Input de comando */}
              <form onSubmit={handleEnviar} className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleToggleRecording}
                  disabled={parseComandoMutation.isPending || consultaMutation.isPending}
                  className={isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-gray-600 hover:bg-gray-700'}
                >
                  {isRecording ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
                
                <Input
                  value={comando}
                  onChange={(e) => setComando(e.target.value)}
                  placeholder={isRecording ? '🎤 Gravando...' : 'Digite ou grave seu comando...'}
                  disabled={parseComandoMutation.isPending || consultaMutation.isPending || isRecording}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={parseComandoMutation.isPending || consultaMutation.isPending || !comando.trim() || isRecording}
                >
                  {(parseComandoMutation.isPending || consultaMutation.isPending) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>

              {/* Exemplos */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Exemplos de comandos:</p>
                <div className="flex flex-wrap gap-2">
                  {exemplos.map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => setComando(ex)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de ações */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Ações</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={5} />
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">Nenhuma ação registrada</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {logs.map((log) => {
                    const valorNovo = log.valor_novo?.valor || log.valor_novo?.amount || 0;
                    const registroId = log.registro_id;
                    
                    return (
                      <div key={log.id} className={`rounded-lg p-3 space-y-2 ${
                        log.status === 'executado' ? 'bg-green-50 border border-green-200' :
                        log.status === 'pendente_aprovacao' ? 'bg-yellow-50 border border-yellow-200' :
                        log.status === 'desfeito' ? 'bg-gray-50 border border-gray-200' :
                        'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {getAcaoLabel(log.acao_realizada)}
                              </Badge>
                              {log.status === 'executado' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : log.status === 'pendente_aprovacao' ? (
                                <Clock className="w-4 h-4 text-yellow-600" />
                              ) : log.status === 'desfeito' ? (
                                <Undo2 className="w-4 h-4 text-gray-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                            </div>
                            
                            <p className="text-sm font-medium text-gray-900">
                              {log.comando_original}
                            </p>
                            
                            {valorNovo > 0 && (
                              <p className="text-sm font-bold text-gray-700 mt-1">
                                R$ {valorNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-500">
                                {new Date(log.created_date).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              
                              {registroId && log.status === 'executado' && (
                                <Link 
                                  to={createPageUrl(getLinkPagina(log.entidade_afetada))}
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  Ver registro
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {log.status === 'executado' && log.valor_anterior && (user?.role === 'admin' || user?.perfil_sistema === 'admin') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full h-7 text-xs mt-2"
                            onClick={() => desfazerAcaoMutation.mutate(log.id)}
                            disabled={desfazerAcaoMutation.isPending}
                          >
                            <Undo2 className="w-3 h-3 mr-1" />
                            Desfazer esta ação
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Permissões */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Suas Permissões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {user?.role === 'admin' || user?.perfil_sistema === 'admin' ? (
                <>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Admin: Acesso Total
                  </Badge>
                </>
              ) : user?.perfil_sistema === 'financeiro' ? (
                <>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Criar Despesas/Receitas
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Contas a Pagar/Receber
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Pagamentos/Recebimentos
                  </Badge>
                </>
              ) : user?.perfil_sistema === 'engenharia' ? (
                <>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Criar Despesas
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-600 w-full justify-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Outras ações bloqueadas
                  </Badge>
                </>
              ) : user?.perfil_sistema === 'compras' ? (
                <>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Criar Despesas
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Contas a Pagar
                  </Badge>
                </>
              ) : (
                <>
                  <Badge className="bg-yellow-100 text-yellow-800 w-full justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Acesso Limitado
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Editar Campos */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Campos</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {actionDraft?.dados.valor !== undefined && (
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editedFields.valor || actionDraft?.dados.valor || ''}
                  onChange={(e) => setEditedFields({...editedFields, valor: parseFloat(e.target.value)})}
                />
              </div>
            )}
            
            {actionDraft?.dados.descricao !== undefined && (
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editedFields.descricao || actionDraft?.dados.descricao || ''}
                  onChange={(e) => setEditedFields({...editedFields, descricao: e.target.value})}
                  rows={3}
                />
              </div>
            )}
            
            {actionDraft?.dados.categoria !== undefined && (
              <div>
                <Label>Categoria</Label>
                <Input
                  value={editedFields.categoria || actionDraft?.dados.categoria || ''}
                  onChange={(e) => setEditedFields({...editedFields, categoria: e.target.value})}
                />
              </div>
            )}
            
            {actionDraft?.dados.fornecedor_cliente !== undefined && (
              <div>
                <Label>{actionDraft?.acao.includes('AR') ? 'Cliente' : 'Fornecedor'}</Label>
                <Input
                  value={editedFields.fornecedor_cliente || actionDraft?.dados.fornecedor_cliente || ''}
                  onChange={(e) => setEditedFields({...editedFields, fornecedor_cliente: e.target.value})}
                />
              </div>
            )}
            
            {actionDraft?.dados.data_vencimento !== undefined && (
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={editedFields.data_vencimento || actionDraft?.dados.data_vencimento || ''}
                  onChange={(e) => setEditedFields({...editedFields, data_vencimento: e.target.value})}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarEdicao}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmação de Exclusão */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-700 mb-3">
              Você tem certeza que deseja <strong>excluir permanentemente</strong> este registro?
            </p>
            
            {actionDraft?.dados.descricao && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-600">Registro:</p>
                <p className="font-medium text-gray-900">{actionDraft.dados.descricao}</p>
              </div>
            )}
            
            <p className="text-xs text-red-600 mt-3">
              ⚠️ Esta ação não pode ser desfeita facilmente.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmarExclusao}
              className="bg-red-600 hover:bg-red-700"
              disabled={executarAcaoMutation.isPending}
            >
              {executarAcaoMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sim, Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getLinkPagina(entidade) {
  const mapa = {
    'ContaFinanceira': 'ContasPagar',
    'Material': 'ObraMaterial',
    'Frete': 'ObraFretes',
    'MaoDeObra': 'ObraMaoDeObra',
    'Imposto': 'ObraImpostos',
    'Alimentacao': 'ObraAlimentacao',
    'AluguelEquipamento': 'ObraAluguelCombustivel',
    'Estadia': 'ObraEstadias',
    'Retirada': 'ObraRetiradas',
    'Investimento': 'FinanceiroAvancado',
    'LancamentoGenerico': 'FinanceiroAvancado'
  };
  
  return mapa[entidade] || 'FinanceiroAvancado';
}