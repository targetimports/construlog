import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function ConcertadorContexto({ onSave, initialData }) {
  const [data, setData] = useState(initialData || {
    nomeApp: '',
    descricao: '',
    problemasPrincipais: '',
    escopo: ''
  });
  const [autoLoading, setAutoLoading] = useState(false);

  const { data: entidades = [] } = useQuery({
    queryKey: ['entities-list'],
    queryFn: async () => {
      const entityNames = ['Obra', 'Orcamento', 'Cliente', 'Medicao', 'Colaborador', 'Material'];
      const results = await Promise.all(
        entityNames.map(async (name) => {
          try {
            const items = await base44.entities[name]?.list();
            return { name, count: items?.length || 0 };
          } catch {
            return { name, count: 0 };
          }
        })
      );
      return results;
    }
  });

  const handleAutoPreenchimento = async () => {
    setAutoLoading(true);
    try {
      const contextoAtual = {
        entidades: entidades.filter(e => e.count > 0),
        totalRegistros: entidades.reduce((acc, e) => acc + e.count, 0)
      };

      const prompt = `
Você é um especialista em auditoria de sistemas. Analise o contexto abaixo e gere informações para uma auditoria:

DADOS DO SISTEMA:
- Entidades: ${contextoAtual.entidades.map(e => `${e.name} (${e.count} registros)`).join(', ')}
- Total de registros: ${contextoAtual.totalRegistros}

Gere um JSON com:
{
  "nomeApp": "Nome sugerido baseado nas entidades encontradas",
  "descricao": "Descrição detalhada do que o app faz baseado nas entidades",
  "problemasPrincipais": "Liste 3-5 problemas comuns que apps deste tipo costumam ter",
  "escopo": "Sugira um escopo de auditoria completo para este tipo de aplicação"
}
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            nomeApp: { type: "string" },
            descricao: { type: "string" },
            problemasPrincipais: { type: "string" },
            escopo: { type: "string" }
          }
        }
      });

      setData(response);
    } catch (error) {
      console.error('Erro ao auto-preencher:', error);
    } finally {
      setAutoLoading(false);
    }
  };

  const handleSave = () => {
    onSave(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">Coletar Contexto</span>
          <Button 
            onClick={handleAutoPreenchimento}
            disabled={autoLoading}
            variant="outline"
            className="gap-2"
          >
            {autoLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                IA Preencher Automaticamente
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="nomeApp">Nome da Aplicação</Label>
          <Input
            id="nomeApp"
            placeholder="Ex: Construlog"
            value={data.nomeApp}
            onChange={(e) => setData({...data, nomeApp: e.target.value})}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="descricao">Descrição Geral</Label>
          <Textarea
            id="descricao"
            placeholder="Descreva brevemente o propósito da aplicação..."
            value={data.descricao}
            onChange={(e) => setData({...data, descricao: e.target.value})}
            className="mt-2"
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="problemas">Problemas Principais</Label>
          <Textarea
            id="problemas"
            placeholder="Liste os principais problemas/bugs conhecidos..."
            value={data.problemasPrincipais}
            onChange={(e) => setData({...data, problemasPrincipais: e.target.value})}
            className="mt-2"
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="escopo">Escopo da Auditoria</Label>
          <Textarea
            id="escopo"
            placeholder="O que você quer que seja auditado? (ex: páginas, funções, componentes, performance)"
            value={data.escopo}
            onChange={(e) => setData({...data, escopo: e.target.value})}
            className="mt-2"
            rows={3}
          />
        </div>

        <Button onClick={handleSave} className="w-full gap-2" size="lg">
          <CheckCircle2 className="w-5 h-5" />
          Salvar Contexto e Continuar
        </Button>
      </CardContent>
    </Card>
  );
}