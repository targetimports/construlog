import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Database, RefreshCw, Trash2, Zap, CheckCircle, XCircle, Clock, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import BackfillObrasPanel from '../components/admin/BackfillObrasPanel';
import BackupOperacionalPanel from '../components/admin/BackupOperacionalPanel';

export default function AjustesAdministracaoDados() {
  const [activeTab, setActiveTab] = useState('reset');
  const queryClient = useQueryClient();

  // Reset State
  const [deleteOperational, setDeleteOperational] = useState(true);
  const [deleteCatalogs, setDeleteCatalogs] = useState(false);
  const [deleteUploads, setDeleteUploads] = useState(false);
  const [deleteDemo, setDeleteDemo] = useState(false);
  const [confirmText1, setConfirmText1] = useState('');
  const [confirmText2, setConfirmText2] = useState('');
  const [confirmOtp, setConfirmOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  
  // Estado para "Excluir Tudo"
  const [showResetTotal, setShowResetTotal] = useState(false);
  const [resetTotalConfirm, setResetTotalConfirm] = useState('');
  const [resetTotalCheckbox, setResetTotalCheckbox] = useState(false);
  const [isResetingTotal, setIsResettingTotal] = useState(false);
  
  // Estado para Backup
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  // Seed State
  const [qtdObras, setQtdObras] = useState(5);
  const [insumosPorObra, setInsumosPorObra] = useState(20);
  const [qtdClientes, setQtdClientes] = useState(5);
  const [qtdFornecedores, setQtdFornecedores] = useState(5);
  const [gerarComprasEstoque, setGerarComprasEstoque] = useState(false);
  const [gerarMedicoes, setGerarMedicoes] = useState(false);
  const [gerarLogistica, setGerarLogistica] = useState(false);
  const [prefixo, setPrefixo] = useState('DEMO');
  const [lastDemoRunId, setLastDemoRunId] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['data-admin-logs'],
    queryFn: () => base44.entities.DataAdminLog.list('-created_date', 50),
    enabled: activeTab === 'logs'
  });

  const previewMutation = useMutation({
    mutationFn: () => base44.functions.invoke('adminDataPreview', {
      deleteOperational,
      deleteCatalogs,
      deleteDemo
    }),
    onSuccess: (response) => {
      setPreviewData(response.data.counts);
      setShowPreview(true);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      toast.success('Prévia gerada com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao gerar prévia: ${error.message}`);
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => base44.functions.invoke('adminResetData', {
      deleteOperational,
      deleteCatalogs,
      deleteUploads,
      deleteDemo,
      confirmation: {
        text1: confirmText1,
        text2: confirmText2,
        otp: confirmOtp
      }
    }),
    onSuccess: (response) => {
      setIsResetting(false);
      const data = response.data;
      if (data.success) {
        toast.success('Reset concluído com sucesso! Recarregando...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(`Reset concluído com erros: ${data.errors?.join(', ')}`);
      }
      refetchLogs();
      setShowPreview(false);
      setConfirmText1('');
      setConfirmText2('');
      setConfirmOtp('');
    },
    onError: (error) => {
      setIsResetting(false);
      const errorMsg = error?.response?.status === 404 
        ? 'Função não encontrada. Verifique se a função adminResetData está implementada.'
        : error.message;
      toast.error(`Erro ao executar reset: ${errorMsg}`);
      console.error('Reset error:', error);
    }
  });

  const seedMutation = useMutation({
    mutationFn: () => base44.functions.invoke('adminSeedDemoData', {
      qtdObras,
      insumosPorObra,
      qtdClientes,
      qtdFornecedores,
      gerarComprasEstoque,
      gerarMedicoes,
      gerarLogistica,
      prefixo
    }),
    onSuccess: (response) => {
      const data = response.data;
      setLastDemoRunId(data.demoRunId);
      toast.success(`Dados demo gerados com sucesso! ${data.created.Obra} obras criadas.`);
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['demandas-estoque'] });
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`Erro ao gerar dados demo: ${error.message}`);
    }
  });

  const deleteDemoMutation = useMutation({
    mutationFn: (demoRunId) => base44.functions.invoke('adminDeleteDemoData', {
      demoRunId,
      deleteAll: !demoRunId
    }),
    onSuccess: (response) => {
      const data = response.data;
      toast.success(`Dados demo removidos com sucesso! ${data.deleted.Obra || 0} obras.`);
      setLastDemoRunId(null);
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['demandas-estoque'] });
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`Erro ao remover dados demo: ${error.message}`);
    }
  });

  // Mutation para reset total com FULL_RESET
  const resetTotalMutation = useMutation({
    mutationFn: () => base44.functions.invoke('adminResetData', {
      deleteOperational: true,
      deleteCatalogs: true,
      deleteUploads: true,
      deleteDemo: true,
      fullReset: true,  // Flag para apagar TUDO mesmo
      confirmation: {
        text1: 'APAGAR TUDO',
        text2: 'GERMANOS',
        otp: '999999'  // Não valida OTP quando fullReset=true
      }
    }),
    onSuccess: (response) => {
      setIsResettingTotal(false);
      const data = response.data;
      if (data.success) {
        toast.success(`RESET TOTAL CONCLUÍDO! ${Object.keys(data.deleted).length} tipos apagados. Limpando caches...`);
        
        // Aguardar um pouco e depois limpar tudo
        setTimeout(() => {
          // Limpar localStorage completamente
          localStorage.clear();
          sessionStorage.clear();
          
          // Invalidar TODOS os queries do react-query
          queryClient.clear();
          queryClient.resetQueries();
          
          // Forçar refresh total
          window.location.href = '/Dashboard';
        }, 1500);
      } else {
        toast.error(`Reset com erros: ${data.errors?.length || 0} problemas.`);
      }
      
      refetchLogs();
      setShowResetTotal(false);
      setResetTotalConfirm('');
      setResetTotalCheckbox(false);
    },
    onError: (error) => {
      setIsResettingTotal(false);
      const errorMsg = error?.response?.status === 404 
        ? 'Função não encontrada. Verifique se a função adminResetData está implementada.'
        : error.message;
      toast.error(`Erro ao executar reset total: ${errorMsg}`);
      console.error('Reset total error:', error);
    }
  });

  const handleResetTotal = () => {
    // Validação: FULL RESET requer apenas confirmação de digitação
    if (resetTotalConfirm !== 'APAGAR TUDO' || !resetTotalCheckbox) {
      toast.error('Confirmação inválida. Digite "APAGAR TUDO" e marque o checkbox.');
      return;
    }
    
    // Double-check final
    const confirmed = window.confirm(
      'AVISO FINAL:\n\nVocê está prestes a APAGAR PERMANENTEMENTE todos os dados do sistema.\n\nEsta ação é IRREVERSÍVEL. Tem certeza?'
    );
    
    if (!confirmed) {
      toast.error('Reset cancelado.');
      return;
    }
    
    setIsResettingTotal(true);
    resetTotalMutation.mutate();
  };

  const isResetTotalValid = resetTotalConfirm === 'APAGAR TUDO' && resetTotalCheckbox;

  // Mutation para exportar backup
  const exportBackupMutation = useMutation({
    mutationFn: () => base44.functions.invoke('exportarBackupCompleto', {}),
    onSuccess: (response) => {
      const data = response.data;
      if (data.success && data.backup) {
        // Gerar arquivo JSON
        const element = document.createElement('a');
        const file = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `backup-germanos-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        
        toast.success(`Backup exportado! ${data.summary.totalRegistros} registros de ${data.summary.entidadesExportadas} entidades.`);
      }
    },
    onError: (error) => {
      toast.error(`Erro ao exportar backup: ${error.message}`);
    }
  });

  // Mutation para importar backup
  const importBackupMutation = useMutation({
    mutationFn: (backupData) => base44.functions.invoke('importarBackupCompleto', { backup: backupData }),
    onSuccess: (response) => {
      const data = response.data;
      if (data.success) {
        toast.success(`Backup importado! ${data.totalImported} registros restaurados.`);
        setShowBackupModal(false);
        queryClient.clear();
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(`Importação concluída com ${data.totalErrorCount} erros.`);
      }
    },
    onError: (error) => {
      toast.error(`Erro ao importar backup: ${error.message}`);
    }
  });

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    exportBackupMutation.mutate();
    setIsExportingBackup(false);
  };

  const handleImportBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target?.result);
        if (!backupData.data) {
          toast.error('Arquivo de backup inválido');
          return;
        }
        setIsImportingBackup(true);
        importBackupMutation.mutate(backupData);
      } catch (err) {
        toast.error('Erro ao ler arquivo de backup');
      }
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!deleteOperational && !deleteCatalogs && !deleteDemo) {
      toast.error('Selecione ao menos um escopo para resetar');
      return;
    }
    previewMutation.mutate();
  };

  const handleReset = () => {
    if (confirmText1 !== 'APAGAR TUDO' || confirmText2 !== 'GERMANOS' || confirmOtp !== generatedOtp) {
      toast.error('Confirmação inválida. Verifique os campos.');
      return;
    }
    
    // Validação extra: ao menos um escopo deve estar selecionado
    if (!deleteOperational && !deleteCatalogs && !deleteDemo) {
      toast.error('Selecione ao menos um escopo para resetar');
      return;
    }
    
    setIsResetting(true);
    resetMutation.mutate();
  };

  const isConfirmValid = confirmText1 === 'APAGAR TUDO' && 
                         confirmText2 === 'GERMANOS' && 
                         confirmOtp === generatedOtp;

  if (!user || !['admin', 'programador'].includes(user.role) && user.acesso_global !== true) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
        <p className="text-gray-600 mt-2">Apenas administradores podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-600" />
          Administração de Dados
        </h1>
        <p className="text-gray-600 mt-2">
          Gerencie os dados do sistema: reset completo, geração de dados demo e logs de ações
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-5">
          <TabsTrigger value="reset">
            <Trash2 className="w-4 h-4 mr-1" />
            Reset
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="w-4 h-4 mr-1" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="seed">
            <Zap className="w-4 h-4 mr-1" />
            Demo
          </TabsTrigger>
          <TabsTrigger value="backfill">
            <Wrench className="w-4 h-4 mr-1" />
            Backfill
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="w-4 h-4 mr-1" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: RESET */}
        <TabsContent value="reset" className="space-y-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Zona de Perigo - Reset de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-red-600">
                Esta ação é <strong>irreversível</strong> e apagará dados permanentemente. Use com extremo cuidado.
              </p>

              {/* Botão RESET TOTAL */}
              <div className="bg-red-100 border-2 border-red-600 rounded-lg p-4">
                <p className="text-sm font-bold text-red-800 mb-3">
                  EXCLUIR TODOS OS DADOS DO SISTEMA
                </p>
                <p className="text-xs text-red-700 mb-3">
                  Esta ação apagará <strong>PERMANENTEMENTE</strong> TUDO: todas as obras, materiais, contas, documentos, viagens, etc. O sistema voltará a estar 100% vazio. Esta ação <strong>NÃO pode ser desfeita</strong>.
                </p>
                <Button
                  onClick={() => setShowResetTotal(true)}
                  className="w-full bg-red-700 hover:bg-red-800 text-white font-bold"
                  size="lg"
                >
                  EXCLUIR TODOS OS DADOS
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">Ou escolha o que resetar especificamente:</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="deleteOperational"
                    checked={deleteOperational}
                    onChange={(e) => setDeleteOperational(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="deleteOperational">
                    Apagar Dados Operacionais (transacionais: medições, requisições, viagens, etc)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="deleteCatalogs"
                    checked={deleteCatalogs}
                    onChange={(e) => setDeleteCatalogs(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="deleteCatalogs">
                    Apagar Cadastros Operacionais (obras, clientes, fornecedores, colaboradores)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="deleteDemo"
                    checked={deleteDemo}
                    onChange={(e) => setDeleteDemo(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="deleteDemo">
                    Apagar Dados Demo (marcados como is_demo=true)
                  </Label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  {previewMutation.isPending ? 'Gerando prévia...' : 'Gerar Prévia do Reset'}
                </Button>
                <Button
                  onClick={handleExportBackup}
                  disabled={isExportingBackup || exportBackupMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  {isExportingBackup ? 'Exportando...' : 'Baixar Backup'}
                </Button>
                <Button
                  onClick={() => setShowBackupModal(true)}
                  variant="outline"
                  className="flex-1"
                >
                  Restaurar Backup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Modal de Confirmação */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-red-700">Confirmação de Reset</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-semibold mb-2">
                    Os seguintes dados serão PERMANENTEMENTE apagados:
                  </p>
                  {previewData && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(previewData).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span>{key}:</span>
                          <span className="font-semibold">{value} registros</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Digite: APAGAR TUDO</Label>
                    <Input
                      value={confirmText1}
                      onChange={(e) => setConfirmText1(e.target.value)}
                      placeholder="APAGAR TUDO"
                      className={confirmText1 === 'APAGAR TUDO' ? 'border-green-500' : 'border-red-300'}
                    />
                  </div>

                  <div>
                    <Label>Digite: GERMANOS</Label>
                    <Input
                      value={confirmText2}
                      onChange={(e) => setConfirmText2(e.target.value)}
                      placeholder="GERMANOS"
                      className={confirmText2 === 'GERMANOS' ? 'border-green-500' : 'border-red-300'}
                    />
                  </div>

                  <div>
                    <Label>Código de Confirmação: <strong className="text-lg text-blue-600">{generatedOtp}</strong></Label>
                    <Input
                      value={confirmOtp}
                      onChange={(e) => setConfirmOtp(e.target.value)}
                      placeholder="Digite o código acima"
                      className={confirmOtp === generatedOtp ? 'border-green-500' : 'border-red-300'}
                    />
                  </div>
                </div>

                {isResetting && (
                  <div className="space-y-2">
                    <Progress value={66} />
                    <p className="text-sm text-center text-gray-600">Processando reset...</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowPreview(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isResetting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleReset}
                    disabled={!isConfirmValid || resetMutation.isPending || isResetting}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {isResetting ? 'Processando...' : 'CONFIRMAR RESET'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal BACKUP RESTORE */}
          <Dialog open={showBackupModal} onOpenChange={setShowBackupModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Restaurar Backup</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Selecione um arquivo de backup (JSON) para restaurar todos os dados.
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    disabled={isImportingBackup || importBackupMutation.isPending}
                    className="hidden"
                    id="backup-file-input"
                  />
                  <label htmlFor="backup-file-input" className="cursor-pointer">
                    <div className="text-4xl mb-2"></div>
                    <p className="text-gray-900 font-medium">Clique ou arraste arquivo aqui</p>
                    <p className="text-xs text-gray-500 mt-1">Arquivo JSON do backup</p>
                  </label>
                </div>

                {isImportingBackup && (
                  <div className="space-y-2">
                    <Progress value={50} />
                    <p className="text-sm text-center text-gray-600">Restaurando dados...</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowBackupModal(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isImportingBackup}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal RESET TOTAL */}
          <Dialog open={showResetTotal} onOpenChange={setShowResetTotal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-red-500 border-2">
              <DialogHeader>
                <DialogTitle className="text-red-700 text-2xl font-bold">EXCLUIR TODOS OS DADOS DO SISTEMA</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
                  <p className="text-sm text-red-900 font-bold mb-3">
                    AVISO CRÍTICO - LEIA COM ATENÇÃO:
                  </p>
                  <ul className="text-xs text-red-800 space-y-2 list-disc list-inside">
                    <li>TODOS os dados operacionais serão DELETADOS PERMANENTEMENTE</li>
                    <li>Inclui: Obras, Materiais, Contas, Viagens, Requisições, Medições, Diários, Documentos</li>
                    <li>Dashboard e Financeiro voltarão a 0,00 (completamente zerado)</li>
                    <li>Usuários, senhas, permissões e menus NÃO serão afetados</li>
                    <li><strong>Esta ação NÃO pode ser desfeita!</strong></li>
                    <li>Você DEVE fazer backup antes (clique em "Baixar Backup")</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                  <p className="text-xs text-amber-800 font-semibold">Dica: Clique em "Baixar Backup" antes de prosseguir para poder restaurar depois se necessário.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="font-bold text-red-700 text-sm">Passo 1: Digite exatamente: APAGAR TUDO</Label>
                    <Input
                      value={resetTotalConfirm}
                      onChange={(e) => setResetTotalConfirm(e.target.value.toUpperCase())}
                      placeholder="APAGAR TUDO"
                      className={resetTotalConfirm === 'APAGAR TUDO' ? 'border-green-500 border-2 bg-green-50' : 'border-red-300 border-2'}
                      maxLength={20}
                    />
                    {resetTotalConfirm === 'APAGAR TUDO' && (
                      <p className="text-xs text-green-600 mt-1">Confirmação de texto OK</p>
                    )}
                  </div>

                  <div>
                    <Label className="font-bold text-red-700 text-sm">Passo 2: Marque para confirmar</Label>
                    <div className="flex items-start space-x-2 mt-2">
                      <input
                        type="checkbox"
                        id="resetTotalCheckbox"
                        checked={resetTotalCheckbox}
                        onChange={(e) => setResetTotalCheckbox(e.target.checked)}
                        className="w-5 h-5 mt-0.5"
                      />
                      <Label htmlFor="resetTotalCheckbox" className="text-xs text-gray-700 font-medium leading-relaxed">
                        ✓ Entendo e aceito que esta ação é <strong>irreversível</strong>, que <strong>TODOS</strong> os dados serão deletados, e que fiz backup de tudo que preciso manter
                      </Label>
                    </div>
                    {resetTotalCheckbox && (
                      <p className="text-xs text-green-600 mt-1">Confirmação de aviso OK</p>
                    )}
                  </div>
                </div>

                {isResetingTotal && (
                  <div className="space-y-2 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <Progress value={60} />
                    <p className="text-sm text-center text-blue-800 font-medium">Deletando todos os dados do banco... (pode levar alguns minutos)</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowResetTotal(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isResetingTotal}
                  >
                    ← Voltar / Cancelar
                  </Button>
                  <Button
                    onClick={handleResetTotal}
                    disabled={!isResetTotalValid || resetTotalMutation.isPending || isResetingTotal}
                    className={`flex-1 ${isResetTotalValid ? 'bg-red-700 hover:bg-red-800' : 'bg-gray-400'}`}
                    size="lg"
                  >
                    {isResetingTotal ? 'DELETANDO...' : 'CONFIRMAR E APAGAR TUDO'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 2: BACKUP OPERACIONAL */}
        <TabsContent value="backup">
          <BackupOperacionalPanel />
        </TabsContent>

        {/* TAB 3: SEED DEMO */}
        <TabsContent value="seed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                Gerar Dados de Demonstração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Gera dados aleatórios mas coerentes para testes e demonstrações. Todos os dados são marcados como <code>is_demo=true</code>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantidade de Obras</Label>
                  <Input
                    type="number"
                    value={qtdObras}
                    onChange={(e) => setQtdObras(Number(e.target.value))}
                    min="1"
                    max="50"
                  />
                </div>

                <div>
                  <Label>Insumos por Obra</Label>
                  <Input
                    type="number"
                    value={insumosPorObra}
                    onChange={(e) => setInsumosPorObra(Number(e.target.value))}
                    min="5"
                    max="100"
                  />
                </div>

                <div>
                  <Label>Clientes</Label>
                  <Input
                    type="number"
                    value={qtdClientes}
                    onChange={(e) => setQtdClientes(Number(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>

                <div>
                  <Label>Fornecedores</Label>
                  <Input
                    type="number"
                    value={qtdFornecedores}
                    onChange={(e) => setQtdFornecedores(Number(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>

                <div>
                  <Label>Prefixo</Label>
                  <Input
                    value={prefixo}
                    onChange={(e) => setPrefixo(e.target.value)}
                    placeholder="DEMO"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="gerarComprasEstoque"
                    checked={gerarComprasEstoque}
                    onChange={(e) => setGerarComprasEstoque(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="gerarComprasEstoque">Gerar Compras e Estoque</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="gerarMedicoes"
                    checked={gerarMedicoes}
                    onChange={(e) => setGerarMedicoes(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="gerarMedicoes">Gerar Medições</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="gerarLogistica"
                    checked={gerarLogistica}
                    onChange={(e) => setGerarLogistica(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="gerarLogistica">Gerar Logística (Viagens)</Label>
                </div>
              </div>

              <Button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {seedMutation.isPending ? 'Gerando...' : 'Gerar Dados Demo'}
              </Button>

              {lastDemoRunId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-2">Última geração: <code>{lastDemoRunId}</code></p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.location.href = '/obras?demo=true'}
                      variant="outline"
                      size="sm"
                    >
                      Ver Obras Demo
                    </Button>
                    <Button
                      onClick={() => deleteDemoMutation.mutate(lastDemoRunId)}
                      disabled={deleteDemoMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      Desfazer Esta Geração
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: BACKFILL */}
        <TabsContent value="backfill">
          <BackfillObrasPanel />
        </TabsContent>


        {/* TAB 5: LOGS */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Administração</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum log encontrado</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}>
                              {log.action}
                            </Badge>
                            {log.status === 'SUCCESS' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(log.created_date).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Executado por: {log.executed_by_email}
                          </p>
                          {log.duration_ms && (
                            <p className="text-xs text-gray-500">
                              Duração: {(log.duration_ms / 1000).toFixed(2)}s
                            </p>
                          )}
                          {log.error_message && (
                            <p className="text-xs text-red-600 mt-1">
                              Erro: {log.error_message}
                            </p>
                          )}
                        </div>
                        {log.result_json && (
                          <div className="text-xs text-gray-500 text-right">
                            {Object.entries(log.result_json).map(([key, value]) => (
                              <div key={key}>
                                {key}: {typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : value}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}