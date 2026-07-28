import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function IntegracaoMedicaoDiario({ obraId, medicaoId }) {
  const [medicao, setMedicao] = useState(null);
  const [diarioVinculado, setDiarioVinculado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState(null);

  // Carregar dados
  useEffect(() => {
    const carregarDados = async () => {
      try {
        if (medicaoId) {
          const meds = await base44.entities.Medicao.filter({ id: medicaoId }, null, 1);
          if (meds.length > 0) {
            setMedicao(meds[0]);
            
            // Buscar diário da mesma data
            const diarios = await base44.entities.DiarioObra.filter({
              obra_id: obraId,
              data: meds[0].periodo_fim
            }, null, 1);
            
            if (diarios.length > 0) {
              setDiarioVinculado(diarios[0]);
            } else {
              // Sugerir criar diário
              setSugestoes({
                criar_diario: true,
                data: meds[0].periodo_fim,
                atividades_sugeridas: meds[0].itens?.map(i => ({
                  descricao: i.descricao,
                  percentual: i.percentual_medido
                })) || []
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar:', error);
      }
    };

    carregarDados();
  }, [medicaoId, obraId]);

  const criarDiarioVinculado = async () => {
    if (!medicao) return;

    setLoading(true);
    try {
      // Criar diário com dados da medição
      const novoD = await base44.entities.DiarioObra.create({
        obra_id: obraId,
        data: medicao.periodo_fim,
        atividades: medicao.itens?.map(item => ({
          item_orcamento_id: item.item_orcamento_id,
          descricao: item.descricao,
          quantidade_executada: item.quantidade_medida,
          status: 'concluido'
        })) || [],
        responsavel: medicao.responsavel_medicao,
        observacoes: `Auto-vinculado de Medição #${medicao.numero}`
      });

      // Vincular medição ao diário
      await base44.entities.Medicao.update(medicaoId, {
        ...medicao,
        diario_vinculado_id: novoD.id
      });

      setDiarioVinculado(novoD);
      setSugestoes(null);
      toast.success('Diário criado e vinculado automaticamente!');
    } catch (error) {
      toast.error('Erro ao criar diário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!medicao) return <p className="p-4 text-gray-500">Carregando...</p>;

  return (
    <div className="space-y-4">
      {/* Status de Vínculo */}
      {diarioVinculado ? (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-900 font-semibold">Vinculado ao Diário</span>
            </div>
            <Badge className="bg-green-100 text-green-800">#{diarioVinculado.id}</Badge>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-orange-900 font-semibold">Sem Diário Vinculado</span>
          </CardContent>
        </Card>
      )}

      {/* Sugestão de Criação */}
      {sugestoes?.criar_diario && !diarioVinculado && (
        <Alert className="bg-blue-50 border-blue-200">
          <Link className="h-4 w-4 text-blue-600" />
          <div className="ml-2">
            <p className="font-medium text-blue-900 mb-2">Criar Diário da mesma data?</p>
            <p className="text-sm text-blue-700 mb-3">
              Transferirá automaticamente {sugestoes.atividades_sugeridas?.length || 0} atividades da medição
            </p>
            <Button
              onClick={criarDiarioVinculado}
              disabled={loading}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              {loading ? 'Criando...' : '+ Criar Diário Vinculado'}
            </Button>
          </div>
        </Alert>
      )}

      {/* Dados Sincronizados */}
      {(medicao || diarioVinculado) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dados Integrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-gray-600 text-xs">Medição</p>
                <p className="font-semibold text-blue-900">#{medicao.numero}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-gray-600 text-xs">Diário</p>
                <p className="font-semibold text-purple-900">
                  {diarioVinculado ? `#${diarioVinculado.id}` : '-'}
                </p>
              </div>
            </div>

            {/* Atividades Transferidas */}
            {medicao.itens && (
              <div>
                <p className="font-semibold text-gray-900 mb-2">Atividades Sincronizadas:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {medicao.itens.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-700 flex-1">{item.descricao}</span>
                      <Badge className="bg-green-100 text-green-800">{item.percentual_medido || 0}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}