import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ScannerConteudoIndevido() {
  const [needles, setNeedles] = useState(
    'PRINCIPAIS CARACTERÍSTICAS IMPLEMENTADAS\nTESTES EXECUTADOS\nPROMPT\nPROMPT\nHARDENING'
  );
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    try {
      const needlesList = needles
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      const res = await base44.functions.invoke('scanForbiddenStrings', {
        needles: needlesList,
        limit_per_entity: 50,
        max_matches: 200,
        include_archived: true,
        dry_run: true
      });

      if (res.data?.ok) {
        setResult(res.data);
        toast.success(`✓ Scan completo: ${res.data.matches_count} correspondências`);
      } else {
        toast.error(res.data?.error || 'Erro ao rodar scanner');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
    setScanning(false);
  };

  const handleCopyJSON = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(json);
    toast.success('✓ Evidência copiada para clipboard');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scanner Conteúdo Indevido</h1>
        <p className="text-gray-600 mt-1">Busca global por strings proibidas em todas as entidades</p>
      </div>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Strings a Buscar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={needles}
            onChange={(e) => setNeedles(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="Uma string por linha..."
          />
          <Button
            onClick={handleScan}
            disabled={scanning}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {scanning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {scanning ? 'Scaneando...' : 'Rodar Scanner'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Card */}
      {result && (
        <Card className={result.matches_count === 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Resultados</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Build ID: {result.build_id}</p>
            </div>
            {result.matches_count === 0 ? (
              <Badge className="bg-green-600">✓ Limpo</Badge>
            ) : (
              <Badge className="bg-orange-600">{result.matches_count} encontrado(s)</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Entidades Scaneadas</p>
                <p className="font-semibold text-lg">{result.scanned}</p>
              </div>
              <div>
                <p className="text-gray-600">Correspondências</p>
                <p className={`font-semibold text-lg ${result.matches_count === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                  {result.matches_count}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-semibold">{result.dry_run ? 'DRY-RUN' : 'EXECUTADO'}</p>
              </div>
            </div>

            {/* Hint */}
            <div className={`p-3 rounded-lg ${result.matches_count === 0 ? 'bg-green-100' : 'bg-orange-100'} text-sm`}>
              {result.matches_count === 0 ? (
                <>
                  <p className="font-semibold text-green-900 mb-1">✓ Nenhuma ocorrência em dados</p>
                  <p className="text-green-800">{result.hint}</p>
                </>
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-orange-900">Encontradas correspondências</p>
                      <p className="text-orange-800 text-xs mt-1">Revise os registros abaixo.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Matches Table */}
            {result.matches_count > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left p-2 font-semibold">Entidade</th>
                      <th className="text-left p-2 font-semibold">ID</th>
                      <th className="text-left p-2 font-semibold">Campo</th>
                      <th className="text-left p-2 font-semibold">Snippet</th>
                      <th className="text-left p-2 font-semibold">String</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((match, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-100">
                        <td className="p-2 font-mono text-xs text-blue-600">{match.entity}</td>
                        <td className="p-2 font-mono text-xs text-gray-600">{match.id.substring(0, 8)}...</td>
                        <td className="p-2 font-mono text-xs text-gray-600">{match.field}</td>
                        <td className="p-2 text-xs text-gray-700 max-w-xs truncate">{match.snippet}</td>
                        <td className="p-2">
                          <Badge className="bg-orange-100 text-orange-800 text-xs">{match.needle_found}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Copy Button */}
            <Button
              onClick={handleCopyJSON}
              variant="outline"
              className="w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Evidência JSON
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}