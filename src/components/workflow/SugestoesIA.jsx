import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SugestoesIA({ tipo_entidade, valor, obra_id, onAplicar }) {
  const [carregando, setCarregando] = useState(false);
  const [sugestoes, setSugestoes] = useState(null);

  const obterSugestoes = async () => {
    setCarregando(true);
    try {
      const response = await base44.functions.invoke('sugerirAprovadoresIA', {
        tipo_entidade,
        valor,
        obra_id
      });
      setSugestoes(response.data.sugestoes);
    } catch (error) {
      console.error('Erro ao obter sugestões:', error);
    } finally {
      setCarregando(false);
    }
  };

  const confiancaConfig = {
    alta: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: '' },
    media: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '' },
    baixa: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: '' }
  };

  if (!sugestoes && !carregando) {
    return (
      <Card className="bg-purple-500/10 border-purple-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-purple-400 font-medium">Sugestões de IA Disponíveis</p>
                <p className="text-gray-400 text-sm">A IA pode sugerir aprovadores ideais com base no histórico</p>
              </div>
            </div>
            <Button
              onClick={obterSugestoes}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Obter Sugestões
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (carregando) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 text-purple-500 mx-auto mb-3 animate-spin" />
          <p className="text-gray-400">A IA está analisando o histórico de workflows...</p>
        </CardContent>
      </Card>
    );
  }

  const config = confiancaConfig[sugestoes?.confianca] || confiancaConfig.media;

  return (
    <Card className="bg-gray-900 border-purple-500/20">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h4 className="text-white font-semibold">Sugestões da IA</h4>
          </div>
          <Badge className={config.color}>
            {config.icon} Confiança {sugestoes?.confianca}
          </Badge>
        </div>

        {sugestoes?.justificativa && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-300 text-sm">{sugestoes.justificativa}</p>
          </div>
        )}

        {sugestoes?.aprovadores_sugeridos && (
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Aprovadores Sugeridos:</p>
            {sugestoes.aprovadores_sugeridos.map((aprov, idx) => (
              <div key={idx} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Nível {aprov.nivel}: {aprov.cargo}</p>
                    <p className="text-gray-400 text-sm">Prazo sugerido: {aprov.prazo_dias} dias</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {onAplicar && (
          <Button
            onClick={() => onAplicar(sugestoes)}
            className="w-full bg-purple-500 hover:bg-purple-600"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Aplicar Sugestões ao Workflow
          </Button>
        )}
      </CardContent>
    </Card>
  );
}