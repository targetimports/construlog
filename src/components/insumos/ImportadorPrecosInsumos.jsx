import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Upload, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

// Importa uma planilha de preços direto para a base mestre de custos (Insumo).
export default function ImportadorPrecosInsumos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [modo, setModo] = useState('novo');
  const [uploadando, setUploadando] = useState(false);
  const [erro, setErro] = useState(null);

  const reset = () => { setFileUrl(null); setFileName(''); setErro(null); setModo('novo'); };

  const importar = useMutation({
    mutationFn: () => base44.functions.invoke('importarPlanilhaPrecosSINAPI', { file_url: fileUrl, modo_importacao: modo }),
    onSuccess: (response) => {
      const res = response?.data;
      if (res?.status === 'sucesso') {
        const r = res.resumo || {};
        toast.success(`Importação concluída: ${r.inseridos || 0} inserido(s), ${r.atualizados || 0} atualizado(s).`);
        queryClient.invalidateQueries({ queryKey: ['insumos'] });
        setOpen(false);
        reset();
      } else {
        setErro(res?.mensagem || 'Erro na importação.');
      }
    },
    onError: (err) => setErro(err.message || 'Erro ao importar.'),
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadando(true);
    setErro(null);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      const url = response?.file_url || response?.data?.file_url;
      if (url) { setFileUrl(url); setFileName(file.name); }
      else setErro('Erro ao fazer upload do arquivo.');
    } catch (e2) {
      setErro(e2.message || 'Erro ao fazer upload.');
    }
    setUploadando(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Upload className="w-4 h-4" /> Importar Planilha
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Planilha de Preços</DialogTitle>
            <DialogDescription>
              Cria/atualiza insumos a partir de uma planilha (.xlsx, .xls ou .csv) com colunas de Código, Descrição, Unidade e Preço.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUpload}
                disabled={uploadando || importar.isPending}
                className="text-sm"
              />
              {uploadando && <p className="text-sm text-blue-600 mt-2">Enviando arquivo…</p>}
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 flex-1">{erro}</p>
                <button onClick={() => setErro(null)} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
              </div>
            )}

            {fileUrl && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-green-800"><span className="font-medium">{fileName}</span> pronto para importar.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Modo de importação</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" value="novo" checked={modo === 'novo'} onChange={(e) => setModo(e.target.value)} />
                  Apenas novos itens
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" value="atualizar" checked={modo === 'atualizar'} onChange={(e) => setModo(e.target.value)} />
                  Atualizar existentes
                </label>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-800">Atualizar um preço guarda o valor anterior no histórico do insumo. Orçamentos futuros usam o novo preço.</p>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button
                onClick={() => importar.mutate()}
                disabled={!fileUrl || importar.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {importar.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando…</> : 'Importar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
