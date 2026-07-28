import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, Archive, FileJson, Link, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const DOMINIOS = [
  { id: 'obras', label: 'Obras & Documentos', icon: '' },
  { id: 'orcamento', label: 'Orçamentos', icon: '' },
  { id: 'medicoes', label: 'Medições', icon: '' },
  { id: 'contratos', label: 'Contratos', icon: '' },
  { id: 'financeiro', label: 'Financeiro', icon: '' },
  { id: 'compras', label: 'Compras & OC', icon: '' },
  { id: 'estoque', label: 'Estoque', icon: '' },
  { id: 'diario', label: 'Diário de Obra', icon: '' },
  { id: 'rh', label: 'RH & Apontamentos', icon: '' },
  { id: 'logistica', label: 'Logística', icon: '' },
  { id: 'nf', label: 'Notas Fiscais', icon: '' },
  { id: 'cadastros', label: 'Cadastros Base', icon: '' },
];

export default function BackupOperacionalPanel() {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedDominios, setSelectedDominios] = useState(DOMINIOS.map(d => d.id));
  const [progress, setProgress] = useState(0);
  const [ultimoBackup, setUltimoBackup] = useState(null);

  const toggleDominio = (id) => {
    setSelectedDominios(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedDominios(DOMINIOS.map(d => d.id));
  const clearAll = () => setSelectedDominios([]);

  const backupMutation = useMutation({
    mutationFn: async () => {
      setProgress(10);
      const response = await base44.functions.invoke('backupOperacional', {
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        dominios: selectedDominios,
      });
      setProgress(80);
      return response;
    },
    onSuccess: (response) => {
      setProgress(100);
      const data = response.data;

      // A função retorna ZIP em ArrayBuffer via axios
      // Como o SDK retorna response.data como blob/arraybuffer quando Content-Type é zip
      // Fallback: se data for objeto (erro), mostrar erro
      if (data?.error) {
        toast.error(`Erro: ${data.error}`);
        setProgress(0);
        return;
      }

      // Criar download do ZIP
      let blob;
      if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        blob = new Blob([data], { type: 'application/zip' });
      } else {
        // fallback: tentar tratar como texto/json
        blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-operacional-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const agora = new Date().toLocaleString('pt-BR');
      setUltimoBackup({ data: agora, dominios: selectedDominios.length });
      toast.success('Backup gerado e download iniciado!');
      setTimeout(() => setProgress(0), 2000);
    },
    onError: (error) => {
      setProgress(0);
      toast.error(`Erro ao gerar backup: ${error.message}`);
    }
  });

  const isRunning = backupMutation.isPending;

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Archive className="w-5 h-5" />
            Backup Operacional — Download ZIP
          </CardTitle>
          <p className="text-sm text-blue-700">
            Exporta todos os dados selecionados em arquivos JSON por domínio, compactados em um único ZIP.
            Inclui lista de URLs de arquivos/mídias vinculados.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Período */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Filtrar por período (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data início</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data fim</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>
            {!dataInicio && !dataFim && (
              <p className="text-xs text-gray-500 mt-1">Sem filtro de período = exporta todo o histórico.</p>
            )}
          </div>

          {/* Domínios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Domínios a exportar</p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Todos</button>
                <span className="text-gray-300">|</span>
                <button onClick={clearAll} className="text-xs text-gray-500 hover:underline">Nenhum</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOMINIOS.map(d => (
                <button
                  key={d.id}
                  onClick={() => toggleDominio(d.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    selectedDominios.includes(d.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span>{d.icon}</span>
                  <span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{selectedDominios.length} de {DOMINIOS.length} domínios selecionados</p>
          </div>

          {/* O que é incluído */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">O ZIP conterá:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                <FileJson className="w-3 h-3 text-blue-500" /> dados/{'{domínio}'}.json
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                <Link className="w-3 h-3 text-purple-500" /> arquivos/links_arquivos.json
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                <FileJson className="w-3 h-3 text-green-500" /> manifesto.json
              </span>
            </div>
          </div>

          {/* Progresso */}
          {(isRunning || progress > 0) && (
            <div className="space-y-2">
              <Progress value={isRunning ? Math.min(progress + 5, 95) : progress} />
              <p className="text-sm text-center text-blue-700">
                {isRunning ? 'Exportando dados, aguarde...' : 'Concluído!'}
              </p>
            </div>
          )}

          {/* Último backup */}
          {ultimoBackup && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" />
              <span>Último backup: {ultimoBackup.data} — {ultimoBackup.dominios} domínios</span>
            </div>
          )}

          <Button
            onClick={() => backupMutation.mutate()}
            disabled={isRunning || selectedDominios.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            size="lg"
          >
            <Download className="w-5 h-5" />
            {isRunning ? 'Gerando backup...' : 'Gerar e Baixar Backup (ZIP)'}
          </Button>

          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Este backup exporta dados em JSON. Arquivos/mídias armazenados no storage não são incluídos — apenas os links de URL para download posterior.
              Para um backup completo dos arquivos, faça download manual pelos links em <code>links_arquivos.json</code>.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}