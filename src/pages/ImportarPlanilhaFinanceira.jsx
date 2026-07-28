import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';

export default function ImportarPlanilhaFinanceira() {
  const [importacaoId, setImportacaoId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [obraId, setObraId] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const queryClient = useQueryClient();

  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: importacao } = useQuery({
    queryKey: ['importacao', importacaoId],
    queryFn: () => base44.entities.ImportacaoPlanilha.read(importacaoId),
    enabled: !!importacaoId
  });

  const { data: linhasErro } = useQuery({
    queryKey: ['linhas-erro', importacaoId],
    queryFn: () => base44.entities.ImportacaoLinha.filter({ importacao_id: importacaoId, parse_status: 'erro' }),
    enabled: !!importacaoId
  });

  const processarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processarImportacaoPlanilha', {
        importacao_id: importacaoId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importacao', importacaoId] });
      queryClient.invalidateQueries({ queryKey: ['linhas-erro', importacaoId] });
    }
  });

  const reprocessarLinhaMutation = useMutation({
    mutationFn: async ({ linha_id, dados }) => {
      await base44.entities.ImportacaoLinha.update(linha_id, {
        raw_json: JSON.stringify(dados),
        parse_status: 'pendente',
        erros: null
      });
      
      // Reprocessar apenas essa linha
      const response = await base44.functions.invoke('processarImportacaoPlanilha', {
        importacao_id: importacaoId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linhas-erro', importacaoId] });
    }
  });

  const handleFileUpload = async (file) => {
    if (!obraId) {
      toast.error('Selecione uma obra primeiro');
      return;
    }

    try {
      setNomeArquivo(file.name);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);

      // Criar ImportacaoPlanilha
      const novaImportacao = await base44.entities.ImportacaoPlanilha.create({
        obra_id: obraId,
        nome_arquivo: file.name,
        status: 'enviada',
        tipo: 'financeiro'
      });

      // Processar cada aba
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Salvar cada linha com raw_json completo
        for (let i = 0; i < dados.length; i++) {
          const linha = dados[i];
          if (!linha || Object.values(linha).every(v => !v)) continue; // pular linhas vazias

          const raw_json = JSON.stringify(linha);
          const hash = btoa(raw_json).substring(0, 20);

          await base44.entities.ImportacaoLinha.create({
            importacao_id: novaImportacao.id,
            aba: sheetName,
            linha_numero: i + 2, // excel começa em 1
            raw_json,
            hash_linha: hash,
            parse_status: 'pendente',
            mapeado_para: 'lancamento_financeiro'
          });
        }
      }

      // Gerar preview
      setPreview({
        importacao_id: novaImportacao.id,
        linhas_totais: Object.values(workbook.Sheets).reduce((acc, sheet) => {
          const dados = XLSX.utils.sheet_to_json(sheet);
          return acc + dados.filter(d => Object.values(d).some(v => v)).length;
        }, 0),
        abas: workbook.SheetNames
      });

      setImportacaoId(novaImportacao.id);
    } catch (error) {
      toast.error('Erro ao processar arquivo: ' + error.message);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Planilha Financeira</h1>
        <p className="text-gray-500 text-sm mt-1">
          Importe despesas/receitas preservando todos os dados originais
        </p>
      </div>

      {!importacaoId ? (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Selecionar Obra e Arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Obra *</label>
              <ComboboxBusca
                options={(obras || []).map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                value={obraId}
                onSelect={(v) => setObraId(v || '')}
                placeholder="Selecione uma obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra."
              />
            </div>

            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-blue-500" />
                  <span className="font-medium">Clique para selecionar o arquivo</span>
                  <span className="text-xs text-gray-500">Excel (.xlsx, .xls) ou CSV</span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Preview */}
          {preview && (!importacao || importacao.status === 'enviada') && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Preview da Importação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-2xl font-bold text-blue-600">{preview.linhas_totais}</div>
                    <div className="text-sm text-gray-600">Linhas a processar</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-2xl font-bold text-blue-600">{preview.abas.length}</div>
                    <div className="text-sm text-gray-600">Abas encontradas</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Abas</div>
                    <div className="text-sm font-medium">{preview.abas.join(', ')}</div>
                  </div>
                </div>

                <Button
                  onClick={() => processarMutation.mutate()}
                  disabled={processarMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {processarMutation.isPending ? 'Processando...' : 'Processar Importação'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Status */}
          {importacao && importacao.status !== 'enviada' && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  {importacao.status === 'processada' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {importacao.status === 'com_erros' && <AlertCircle className="w-5 h-5 text-orange-600" />}
                  {importacao.status === 'enviada' && <Clock className="w-5 h-5 text-gray-600" />}
                  Resultado da Importação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{importacao.linhas_ok}</div>
                    <div className="text-sm text-gray-600">Linhas OK</div>
                  </div>
                  <div className={`p-4 rounded border ${importacao.linhas_erro > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-2xl font-bold ${importacao.linhas_erro > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {importacao.linhas_erro}
                    </div>
                    <div className="text-sm text-gray-600">Com erro</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">{importacao.total_linhas}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>

                {importacao.linhas_erro > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      {importacao.linhas_erro} linha(s) com erro. Clique abaixo para corrigir.
                    </AlertDescription>
                  </Alert>
                )}

                {importacao.status === 'processada' && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Importação concluída com sucesso!
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Linhas com Erro */}
          {linhasErro && linhasErro.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Linhas com Erro — Corrigir e Reprocessar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {linhasErro.map(linha => (
                    <div key={linha.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-red-900">
                            Aba: {linha.aba} | Linha {linha.linha_numero}
                          </p>
                          <p className="text-sm text-red-700 mt-1">{linha.erros}</p>
                        </div>
                      </div>
                      
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-red-800 hover:text-red-900">
                          Ver dados brutos e editar
                        </summary>
                        <LinhaEditor
                          linha={linha}
                          onReprocessar={(dados) => reprocessarLinhaMutation.mutate({ linha_id: linha.id, dados })}
                        />
                      </details>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => {
              setImportacaoId(null);
              setPreview(null);
            }}
            variant="outline"
          >
            Nova Importação
          </Button>
        </div>
      )}
    </div>
  );
}

function LinhaEditor({ linha, onReprocessar }) {
  const [dados, setDados] = useState(JSON.parse(linha.raw_json));

  return (
    <div className="mt-3 p-3 bg-white rounded border border-red-200 space-y-2">
      {Object.entries(dados).map(([key, value]) => (
        <div key={key}>
          <label className="text-xs font-medium text-gray-700">{key}</label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => setDados({ ...dados, [key]: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      ))}
      <Button
        onClick={() => onReprocessar(dados)}
        size="sm"
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        Reprocessar Linha
      </Button>
    </div>
  );
}