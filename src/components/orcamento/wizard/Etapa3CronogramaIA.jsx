import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Plus, Loader2, Zap } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ImportadorCronogramaExcel from '../../cronograma/ImportadorCronogramaExcel';
import FormAtividadeManual from '../../cronograma/FormAtividadeManual';
import ListaCronograma from '../../cronograma/ListaCronograma';

export default function Etapa3CronogramaIA({ onDadosAlterados, obraId }) {
  const [mostraNovaCronograma, setMostraNovaCronograma] = useState(false);
  const [mostraFormularioCronograma, setMostraFormularioCronograma] = useState(false);
  const [cronogramaId, setCronogramaId] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState(null);
  const [carregandoSugestao, setCarregandoSugestao] = useState(false);

  // Gerar sugestão de cronograma com IA
  const { mutate: gerarSugestaoIA } = useMutation({
    mutationFn: async () => {
      setCarregandoSugestao(true);
      try {
        const response = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é um especialista em gerenciamento de projetos de construção. 
          
O usuário está criando um novo projeto de construção e precisa de orientação sobre cronograma.

Forneça:
1. Uma orientação breve (2-3 linhas) sobre por que o cronograma é importante ANTES de definir os dados da obra
2. Recomendação: importar Excel (se tiver) ou criar manualmente?
3. Estrutura mínima esperada de um cronograma (Atividade, Início, Fim, Duração em dias)

Seja conciso e prático.`,
          response_json_schema: {
            type: 'object',
            properties: {
              orientacao: { type: 'string' },
              recomendacao: { type: 'string' },
              estrutura: { type: 'array', items: { type: 'string' } }
            }
          }
        });

        return response.data;
      } finally {
        setCarregandoSugestao(false);
      }
    },
    onSuccess: (data) => {
      setSugestaoIA(data);
      toast.success('Sugestão IA gerada!');
    },
    onError: (error) => {
      toast.error('Erro ao gerar sugestão: ' + error.message);
    }
  });

  useEffect(() => {
    if (!sugestaoIA) {
      gerarSugestaoIA();
    }
  }, []);

  const handleCronogramaImportado = () => {
    setCronogramaId(true);
    setMostraNovaCronograma(false);
    onDadosAlterados('cronograma', true);
    toast.success('Cronograma importado com sucesso!');
  };

  const handleAtividadeCriada = () => {
    setMostraFormularioCronograma(false);
    setCronogramaId(true);
    onDadosAlterados('cronograma', true);
    toast.success('Atividade criada com sucesso!');
  };

  return (
    <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Cronograma da Obra
        </CardTitle>
        <CardDescription>
          Defina as atividades e datas antes de configurar os dados da obra
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {sugestaoIA && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-900">
                  Orientação IA:
                </p>
                <p className="text-sm text-blue-800">{sugestaoIA.orientacao}</p>
                <p className="text-sm text-blue-800 font-medium">
                  Recomendação: {sugestaoIA.recomendacao}
                </p>
                <div className="text-xs text-blue-700 mt-2">
                  <p className="font-medium mb-1">Estrutura esperada:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {sugestaoIA.estrutura?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status do Cronograma */}
        <div className={`border rounded-lg p-4 ${
          cronogramaId 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <p className="text-sm font-medium">
            Status: <span className="font-bold">
              {cronogramaId ? '✓ Cronograma definido' : '✗ Sem cronograma'}
            </span>
          </p>
          {!cronogramaId && (
            <p className="text-xs text-gray-600 mt-1">
              Você poderá continuar, mas o cronograma é essencial para medições precisas.
            </p>
          )}
        </div>

        {/* Botões de Ação */}
        {!mostraNovaCronograma && !mostraFormularioCronograma && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              onClick={() => setMostraNovaCronograma(true)}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Upload className="w-4 h-4" />
              Importar Cronograma (Excel)
            </Button>
            <Button
              onClick={() => setMostraFormularioCronograma(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Atividade Manual
            </Button>
          </div>
        )}

        {/* Importador Excel */}
        {mostraNovaCronograma && (
          <div className="space-y-4">
            <ImportadorCronogramaExcel
              obraId={obraId}
              onImportado={handleCronogramaImportado}
            />
            <Button
              variant="ghost"
              onClick={() => setMostraNovaCronograma(false)}
              className="text-gray-600"
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Formulário Manual */}
        {mostraFormularioCronograma && (
          <div className="space-y-4">
            <FormAtividadeManual
              obraId={obraId}
              onAtividadeCriada={handleAtividadeCriada}
              onCancelar={() => setMostraFormularioCronograma(false)}
            />
          </div>
        )}

        {/* Lista de Cronograma */}
        {cronogramaId && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Atividades Criadas:</h4>
            <ListaCronograma obraId={obraId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}