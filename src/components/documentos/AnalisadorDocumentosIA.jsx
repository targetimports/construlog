import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertTriangle, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AnalisadorDocumentosIA({ obraId }) {
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [tipoDoc, setTipoDoc] = useState('outro');
  const [abaCriticas, setAbaCriticas] = useState(true);

  const tiposDoc = [
    { value: 'contrato', label: 'Contrato' },
    { value: 'planta', label: 'Planta/Projeto' },
    { value: 'especificacao_tecnica', label: 'Especificação Técnica' },
    { value: 'aditivo', label: 'Aditivo' },
    { value: 'outro', label: 'Outro Documento' }
  ];

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalisando(true);
    try {
      // Upload do arquivo
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const documentoUrl = uploadRes.file_url;

      // Análise via IA
      const resultado = await base44.functions.invoke('analisadorDocumentosObraIA', {
        obraId,
        documentoUrl,
        tipoDocumento: tipoDoc
      });

      setAnalise(resultado.data.analise);
      setArquivo(file.name);
      toast.success('Documento analisado com sucesso!');
    } catch (erro) {
      toast.error('Erro: ' + erro.message);
    } finally {
      setAnalisando(false);
    }
  };

  if (analisando) {
    return (
      <Card className="bg-blue-50">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-700">Analisando documento...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Análise de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Processa contratos, plantas, especificações e aditivos para extrair informações-chave e identificar riscos
          </p>

          {/* Tipo de Documento */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Tipo de Documento</label>
            <select
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            >
              {tiposDoc.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 cursor-pointer">
            <input
              type="file"
              onChange={handleUpload}
              disabled={analisando}
              className="hidden"
              id="doc-upload"
              accept=".pdf,.doc,.docx,.txt,.jpg,.png"
            />
            <label htmlFor="doc-upload" className="cursor-pointer block">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">Selecione um documento</p>
              <p className="text-xs text-gray-500">PDF, Word, Imagem ou Texto</p>
            </label>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { clausulas_criticas, conflitos_detectados, riscos, datas_prazos, alertas, score_analise } = analise;
  const scoreColor = score_analise >= 7 ? 'text-green-600' : score_analise >= 4 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-base">{arquivo}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{analise.resumo}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-600">Score</p>
              <p className={`text-3xl font-bold ${scoreColor}`}>{score_analise?.toFixed(1)}/10</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alertas Críticos */}
      {alertas && alertas.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-900">
              <AlertCircle className="w-4 h-4" />
              Alertas Críticos ({alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((alerta, idx) => (
              <div key={idx} className="flex gap-2 text-sm">
                <span className="text-red-600 font-bold">!</span>
                <span className="text-red-900">{alerta}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setAbaCriticas(true)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            abaCriticas
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Cláusulas Críticas ({clausulas_criticas?.length || 0})
        </button>
        <button
          onClick={() => setAbaCriticas(false)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            !abaCriticas
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Conflitos & Riscos ({(conflitos_detectados?.length || 0) + (riscos?.length || 0)})
        </button>
      </div>

      {/* Cláusulas Críticas */}
      {abaCriticas && (
        <div className="space-y-3">
          {clausulas_criticas?.map((clausula, idx) => (
            <Card key={idx} className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-sm text-yellow-900">{clausula.titulo}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${
                    clausula.severidade === 'crítica' 
                      ? 'bg-red-200 text-red-900' 
                      : 'bg-yellow-200 text-yellow-900'
                  }`}>
                    {clausula.severidade?.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-700">{clausula.conteudo}</p>
                <div className="bg-white rounded p-2">
                  <p className="text-xs font-semibold text-gray-700">Impacto:</p>
                  <p className="text-xs text-gray-600 mt-1">{clausula.impacto}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conflitos e Riscos */}
      {!abaCriticas && (
        <div className="space-y-3">
          {conflitos_detectados?.map((conflito, idx) => (
            <Card key={`conf-${idx}`} className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {conflito.descricao}
                </CardTitle>
                <p className="text-xs text-orange-700 mt-1">{conflito.localizacao}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-orange-900 font-semibold mb-1">Recomendação:</p>
                <p className="text-xs text-gray-700">{conflito.recomendacao}</p>
              </CardContent>
            </Card>
          ))}

          {riscos?.map((risco, idx) => (
            <Card key={`risco-${idx}`} className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-sm text-red-900">{risco.tipo}</CardTitle>
                  <span className="text-xs px-2 py-1 rounded bg-red-200 text-red-900 font-semibold">
                    {risco.nivel?.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-700">{risco.descricao}</p>
                <div className="bg-white rounded p-2">
                  <p className="text-xs font-semibold text-gray-700">Mitigação:</p>
                  <p className="text-xs text-gray-600 mt-1">{risco.mitigacao}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Datas e Prazos */}
      {datas_prazos && datas_prazos.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm">Datas e Prazos Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {datas_prazos.map((data, idx) => (
                <li key={idx} className="text-xs text-blue-900">✓ {data}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        onClick={() => { setAnalise(null); setArquivo(null); }}
        className="w-full"
      >
        Analisar Outro Documento
      </Button>
    </div>
  );
}