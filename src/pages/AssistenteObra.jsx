import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, AlertCircle, ChevronRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormSkeleton } from '@/components/shared/Skeletons';

export default function AssistenteObra() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(1);
  const [obraId, setObraId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  });
  const [dadosObra, setDadosObra] = useState({});
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-lista'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: obra, isLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.read(obraId),
    enabled: !!obraId
  });

  const atualizarMutation = useMutation({
    mutationFn: (dados) => base44.entities.Obra.update(obraId, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
    }
  });

  // Se não tem obraId, mostra seletor
  if (!obraId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Assistente da Obra</h1>
            <p className="text-gray-600">Selecione uma obra para configurar</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="block text-sm font-medium mb-3">Escolha uma obra:</label>
            <select 
              onChange={(e) => setObraId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">-- Selecione --</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome || 'Sem nome'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !obra) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <FormSkeleton fields={6} />
        </div>
      </div>
    );
  }

  const podeAtivar = obra.fase === 'orcamento';
  const obraAtiva = obra.fase === 'ativa';

  const passos = [
    { num: 1, titulo: 'Dados Básicos', descricao: 'Informações da obra' },
    { num: 2, titulo: 'Importar Dados', descricao: 'Importar planilha da obra' },
    { num: 3, titulo: 'Ativos & Máquinas', descricao: 'Vincular equipamentos' },
    { num: 4, titulo: 'Equipe', descricao: 'Definir quem pode acessar' },
    { num: 5, titulo: 'Finalizar', descricao: 'Ativar a obra' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Assistente da Obra</h1>
          <p className="text-gray-600">
            Configure sua obra em poucos passos. Fase: <strong>{obra.fase}</strong>
          </p>
        </div>

        {/* Alerta se não está ativa */}
        {!obraAtiva && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Sua obra ainda não está ativada. Complete os passos e clique em "Ativar Obra" para iniciar a execução.
            </AlertDescription>
          </Alert>
        )}

        {/* Indicador de progresso */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {passos.map((p, idx) => (
              <div key={p.num} className="flex-1">
                <button
                  onClick={() => setPasso(p.num)}
                  className={`w-full flex flex-col items-center gap-2 p-3 rounded-lg transition ${
                    passo === p.num
                      ? 'bg-blue-100 border-2 border-blue-600'
                      : 'bg-white border border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    passo === p.num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {p.num}
                  </div>
                  <span className="text-xs font-medium text-center">{p.titulo}</span>
                </button>
                {idx < passos.length - 1 && (
                  <div className="h-1 bg-gray-300 mx-2 mt-3" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Conteúdo dos passos */}
        {passo === 1 && <Passo1 obra={obra} onSave={(dados) => {
          atualizarMutation.mutate(dados);
          setPasso(2);
        }} />}
        {passo === 2 && <Passo2 obraId={obraId} onNext={() => setPasso(3)} />}
        {passo === 3 && <Passo3 obraId={obraId} onNext={() => setPasso(4)} />}
        {passo === 4 && <Passo4 obraId={obraId} onNext={() => setPasso(5)} />}
        {passo === 5 && <Passo5 obra={obra} obraId={obraId} podeAtivar={podeAtivar} onComplete={() => navigate('/')} />}

        {/* Botões de navegação */}
        <div className="flex gap-4 mt-8">
          <Button
            onClick={() => setPasso(Math.max(1, passo - 1))}
            disabled={passo === 1}
            variant="outline"
          >
            Anterior
          </Button>
          {passo < 5 && (
            <Button onClick={() => setPasso(Math.min(5, passo + 1))} className="bg-blue-600 hover:bg-blue-700">
              Próximo <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Passo1({ obra, onSave }) {
  const [dados, setDados] = React.useState({
    nome: obra.nome || '',
    endereco: obra.endereco || '',
    cidade: obra.cidade || '',
    estado: obra.estado || '',
    responsavel_tecnico: obra.responsavel_tecnico || '',
    tipo_obra: obra.tipo_obra || 'edificacao'
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados Básicos da Obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome da Obra *</label>
          <input
            type="text"
            value={dados.nome}
            onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Obra</label>
            <select
              value={dados.tipo_obra}
              onChange={(e) => setDados({ ...dados, tipo_obra: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="edificacao">Edificação</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="reforma">Reforma</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Responsável Técnico</label>
            <input
              type="text"
              value={dados.responsavel_tecnico}
              onChange={(e) => setDados({ ...dados, responsavel_tecnico: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Endereço</label>
          <input
            type="text"
            value={dados.endereco}
            onChange={(e) => setDados({ ...dados, endereco: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input
              type="text"
              value={dados.cidade}
              onChange={(e) => setDados({ ...dados, cidade: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <input
              type="text"
              value={dados.estado}
              onChange={(e) => setDados({ ...dados, estado: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <Button onClick={() => onSave(dados)} className="w-full bg-blue-600 hover:bg-blue-700">
          Salvar e Continuar
        </Button>
      </CardContent>
    </Card>
  );
}

function Passo2({ obraId, onNext }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Dados da Obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Importe planilhas com despesas, materiais, mão de obra e outros custos. Os dados serão armazenados sem nenhuma perda.
        </p>
        <Button
          onClick={() => window.location.href = `/ImportarPlanilhaFinanceira?obra_id=${obraId}`}
          variant="outline"
          className="w-full"
        >
          Importar Planilha da Obra
        </Button>
        <p className="text-xs text-gray-500">Este passo é opcional. Você pode importar dados depois.</p>
        <Button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700">
          Prosseguir
        </Button>
      </CardContent>
    </Card>
  );
}

function Passo3({ obraId, onNext }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ativos & Máquinas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Vincule equipamentos e máquinas que serão utilizados na execução desta obra.
        </p>
        <Button
          onClick={() => window.location.href = `/Ativos?obra_id=${obraId}`}
          variant="outline"
          className="w-full"
        >
          Gerenciar Ativos da Obra
        </Button>
        <p className="text-xs text-gray-500">Este passo é opcional. Continue para finalizar a configuração.</p>
        <Button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700">
          Prosseguir
        </Button>
      </CardContent>
    </Card>
  );
}

function Passo4({ obraId, onNext }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe & Permissões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Defina quem terá acesso a esta obra e quais ações podem realizar.
        </p>
        <Button
          onClick={() => window.location.href = `/GestaoUsuarios?obra_id=${obraId}`}
          variant="outline"
          className="w-full"
        >
          Gerenciar Permissões
        </Button>
        <p className="text-xs text-gray-500">Este passo é opcional. Você pode configurar depois.</p>
        <Button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700">
          Prosseguir
        </Button>
      </CardContent>
    </Card>
  );
}

function Passo5({ obra, obraId, podeAtivar, onComplete }) {
  const navigate = useNavigate();
  const [ativando, setAtivando] = React.useState(false);

  const handleAtivar = async () => {
    setAtivando(true);
    try {
      const orcamento = await base44.entities.OrcamentoObra.filter({ obra_id: obraId });
      if (orcamento && orcamento.length > 0) {
        await base44.functions.invoke('ativarObraAPartirDoOrcamento', {
          orcamento_id: orcamento[0].id
        });
      }
      alert('Obra ativada com sucesso! Você pode começar a trabalhar com ela.');
      onComplete();
    } catch (error) {
      alert('Erro ao ativar obra: ' + error.message);
    } finally {
      setAtivando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finalizar e Ativar Obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {podeAtivar ? (
          <>
            <Alert className="border-green-200 bg-green-50">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Sua obra está pronta para ser ativada! Clique no botão abaixo para iniciar a execução.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleAtivar}
              disabled={ativando}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {ativando ? 'Ativando...' : 'Ativar Obra'}
            </Button>
          </>
        ) : (
          <>
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Sua obra já está ativada ({obra.fase}).
              </AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/')} className="w-full bg-blue-600 hover:bg-blue-700">
              Voltar ao Início
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}