import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import WizardImportacaoObra from '../wizard/WizardImportacaoObra';

export default function DialogNovaObra({ open, onOpenChange }) {
  const [modo, setModo] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [nomeObra, setNomeObra] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();

  const handleArquivoChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      const nomeDoArquivo = file.name.replace(/\.[^/.]+$/, '');
      setNomeObra(nomeDoArquivo);
    }
  };

  const handleImportar = async () => {
    if (!arquivo || !nomeObra.trim()) {
      toast.error('Selecione um arquivo e defina um nome');
      return;
    }

    setIsLoading(true);
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: arquivo });
      
      const response = await base44.functions.invoke('iniciarImportacaoObra', {
        arquivo_url: uploadResponse.file_url
      });

      if (response.data.success) {
        setSessionId(response.data.session_id);
        setWizardOpen(true);
        onOpenChange(false);
        toast.success('Planilha analisada! Iniciando assistente...');
      } else {
        toast.error('Erro ao processar planilha');
      }
    } catch (error) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCriarManual = () => {
    onOpenChange(false);
    setModo(null);
    setArquivo(null);
    setNomeObra('');
    navigate(createPageUrl('ObraForm'));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Nova Obra</DialogTitle>
          </DialogHeader>

        {!modo ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setModo('manual')}
              className="border-2 border-gray-200 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-all text-center space-y-3"
            >
              <FileText className="w-12 h-12 mx-auto text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">Criar Manualmente</p>
                <p className="text-sm text-gray-600 mt-1">Preencha os dados da obra diretamente</p>
              </div>
            </button>

            <button
              onClick={() => setModo('importar')}
              className="border-2 border-gray-200 rounded-lg p-8 hover:border-green-500 hover:bg-green-50 transition-all text-center space-y-3"
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">Importar OrçaFascio</p>
                <p className="text-sm text-gray-600 mt-1">Carregue uma planilha pronta</p>
              </div>
            </button>
          </div>
        ) : modo === 'manual' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Você será redirecionado para o formulário de criação</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setModo(null)}>
                Voltar
              </Button>
              <Button onClick={handleCriarManual} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Selecione a planilha (Excel ou CSV)</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleArquivoChange}
                  className="hidden"
                  id="arquivo-input-modal"
                />
                <label htmlFor="arquivo-input-modal" className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Clique para selecionar</p>
                  {arquivo && (
                    <p className="mt-2 text-sm font-semibold text-green-600">✓ {arquivo.name}</p>
                  )}
                </label>
              </div>
            </div>

            {arquivo && (
              <div>
                <label className="block text-sm font-medium mb-2">Nome da Obra</label>
                <Input
                  value={nomeObra}
                  onChange={(e) => setNomeObra(e.target.value)}
                  placeholder="Nome da obra"
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setModo(null)} disabled={isLoading}>
                Voltar
              </Button>
              <Button 
                onClick={handleImportar} 
                disabled={!arquivo || !nomeObra.trim() || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar e Criar Obra'
                )}
              </Button>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>

      {/* Wizard de Importação */}
      {wizardOpen && sessionId && (
        <WizardImportacaoObra
          open={wizardOpen}
          onClose={() => {
            setWizardOpen(false);
            setSessionId(null);
            setModo(null);
            setArquivo(null);
            setNomeObra('');
          }}
          sessionId={sessionId}
        />
      )}
    </>
  );
}