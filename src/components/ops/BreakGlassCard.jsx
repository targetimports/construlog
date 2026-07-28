import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Check } from 'lucide-react';

export default function BreakGlassCard() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('gerarBreakGlassToken', {});
      if (res.data?.ok) {
        setToken(res.data);
        toast.success('✓ Break-glass token gerado');
      } else {
        toast.error(res.data?.error || 'Erro');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (token?.token_plain) {
      navigator.clipboard.writeText(token.token_plain);
      setCopied(true);
      toast.success('✓ Token copiado para clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <CardTitle className="text-lg text-red-800">Break-Glass Token</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700">
          Token de emergência para operações críticas em produção. Cada token pode ser usado apenas uma vez.
        </p>

        {!token ? (
          <Button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Gerando...' : 'Gerar Novo Token'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="bg-white border-2 border-red-300 rounded p-4">
              <p className="text-xs text-gray-600 font-semibold mb-2">TOKEN (copie agora - exibe apenas uma vez)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold text-red-700 bg-gray-100 p-2 rounded">
                  {token.token_plain}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> OK
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-white rounded">
                <p className="text-xs text-gray-600">Escopo</p>
                <p className="font-semibold">{token.scope}</p>
              </div>
              <div className="p-2 bg-white rounded">
                <p className="text-xs text-gray-600">Expira em</p>
                <p className="font-semibold">{token.expires_minutes} min</p>
              </div>
            </div>

            <div className="p-3 bg-red-100 border border-red-300 rounded text-xs text-red-800">
              Este token expira em {token.expires_minutes} minutos e pode ser usado apenas uma vez. Não compartilhe.
            </div>

            <Button 
              onClick={() => setToken(null)}
              variant="outline"
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}