import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Building2, Package, FileText, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function WizardImportacaoObra({ open, onClose, sessionId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState(1);
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [createdObraId, setCreatedObraId] = useState(null);
  const [createdObraName, setCreatedObraName] = useState(null);
  const [dadosObra, setDadosObra] = useState({});
  const [dadosCliente, setDadosCliente] = useState({});

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['import-session', sessionId],
    queryFn: async () => {
      const sessions = await base44.entities.ImportSession.filter({ id: sessionId });
      return sessions[0] || null;
    },
    enabled: !!sessionId && open,
    retry: false
  });

  const { data: materiais = [], isLoading: loadingMateriais } = useQuery({
    queryKey: ['import-materiais', sessionId],
    queryFn: () => base44.entities.ImportMaterial.filter({ session_id: sessionId }),
    enabled: !!sessionId && open && etapa === 3,
    retry: false
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list().catch(() => []),
    enabled: etapa === 2,
    retry: false
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list().catch(() => []),
    enabled: etapa === 1,
    retry: false
  });

  const finalizarMutation = useMutation({
    mutationFn: async () => {
      if (status === 'processing') return;
      setStatus('processing');
      
      return await base44.functions.invoke('finalizarImportacaoObra', {
        session_id: sessionId,
        dados_obra: dadosObra,
        dados_cliente: dadosCliente
      });
    },
    onSuccess: (response) => {
      setCreatedObraId(response.data.obra_id);
      setCreatedObraName(response.data.obra_name || dadosObra.nome);
      setStatus('success');
      
      queryClient.invalidateQueries(['obras']);
      queryClient.invalidateQueries(['obra', response.data.obra_id]);
    },
    onError: (error) => {
      setStatus('error');
      toast.error(`Erro ao finalizar: ${error.message}`);
    }
  });

  useEffect(() => {
    if (session && session.dados_extraidos) {
      setDadosObra(prev => ({
        ...prev,
        nome: session.dados_extraidos.nomeObra || '',
        status: 'planejamento',
        tipo: 'privada'
      }));
    }
  }, [session]);

  const validarEtapa = () => {
    if (etapa === 1) {
      if (!dadosObra.nome) {
        toast.error('Nome da obra é obrigatório');
        return false;
      }
    }
    if (etapa === 2) {
      if (dadosObra.tipo === 'privada' && !dadosCliente.cliente_id) {
        toast.error('Cliente é obrigatório para obras privadas');
        return false;
      }
      if (!dadosObra.centro_custo) {
        toast.error('Centro de Custo é obrigatório');
        return false;
      }
    }
    if (etapa === 3) {
      const pendentes = materiais.filter(m => !m.resolved);
      if (pendentes.length > 0) {
        toast.error(`Existem ${pendentes.length} materiais sem resolução. Mapeie ou crie todos antes de continuar.`);
        return false;
      }
    }
    return true;
  };

  const proximaEtapa = () => {
    if (validarEtapa()) {
      if (etapa === 4) {
        finalizarMutation.mutate();
      } else {
        setEtapa(etapa + 1);
      }
    }
  };

  const etapaAnterior = () => {
    if (etapa > 1) {
      setEtapa(etapa - 1);
    }
  };

  const renderConteudo = () => {
    // Status de processamento ou sucesso sobrescreve a etapa
    if (status === 'processing') {
      return (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Processando Importação...</h3>
          <p className="text-gray-600">Criando obra, orçamento e materiais</p>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div className="text-center py-12 space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              OBRA ORÇA FÁCIL IMPORTADA COM SUCESSO 
            </h3>
            <p className="text-gray-600 mb-4">
              {createdObraName || 'Obra criada'} está pronta para uso
            </p>
          </div>

          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <Button
              size="lg"
              onClick={() => {
                onClose();
                navigate(createPageUrl(`ObraDetalhes?id=${createdObraId}`));
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              ABRIR ESTA OBRA
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                onClose();
                navigate(createPageUrl('Obras') + '?origem=ORCA_FACIL');
              }}
            >
              VER TODAS AS OBRAS CRIADAS (ORÇA FÁCIL)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatus('idle');
                setEtapa(1);
                setCreatedObraId(null);
                setCreatedObraName(null);
                setDadosObra({});
                setDadosCliente({});
              }}
            >
              Importar outra planilha
            </Button>
          </div>
        </div>
      );
    }

    // Etapas normais
    switch (etapa) {
      case 1:
        return <Etapa1DadosObra 
          dados={dadosObra} 
          onChange={setDadosObra} 
          colaboradores={colaboradores} 
        />;
      case 2:
        return <Etapa2ClienteCentroCusto 
          dados={dadosObra} 
          dadosCliente={dadosCliente}
          onChangeDados={setDadosObra}
          onChangeCliente={setDadosCliente}
          clientes={clientes}
        />;
      case 3:
        return <Etapa3Materiais 
          materiais={materiais} 
          sessionId={sessionId} 
          loading={loadingMateriais}
        />;
      case 4:
        return <Etapa4Revisao 
          dados={dadosObra} 
          dadosCliente={dadosCliente}
          materiais={materiais}
          session={session}
        />;
      default:
        return null;
    }
  };

  if (loadingSession) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Assistente de Importação de Obra
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        {status === 'idle' && (
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Etapa {etapa} de 4</span>
              <span className="text-gray-600">{Math.round((etapa / 4) * 100)}%</span>
            </div>
            <Progress value={(etapa / 4) * 100} className="h-2" />
          </div>
        )}

        {/* Conteúdo */}
        <div className="py-6">
          {renderConteudo()}
        </div>

        {/* Botões de Navegação - só aparecem em estado idle */}
        {status === 'idle' && (
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={etapaAnterior}
              disabled={etapa === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={proximaEtapa}
              disabled={finalizarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {etapa === 4 ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar e Criar Obra
                </>
              ) : (
                <>
                  Próxima Etapa
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ETAPA 1 - Dados da Obra
function Etapa1DadosObra({ dados, onChange, colaboradores }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Dados da Obra</h3>
        <p className="text-sm text-gray-600">Complete as informações básicas da obra</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="nome">Nome da Obra *</Label>
          <Input
            id="nome"
            value={dados.nome || ''}
            onChange={(e) => onChange({ ...dados, nome: e.target.value })}
            placeholder="Ex: Construção Residencial - Rua ABC"
          />
        </div>

        <div>
          <Label htmlFor="tipo">Tipo *</Label>
          <Select value={dados.tipo || undefined} onValueChange={(v) => onChange({ ...dados, tipo: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="privada">Privada</SelectItem>
              <SelectItem value="publica">Pública</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={dados.status || undefined} onValueChange={(v) => onChange({ ...dados, status: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planejamento">Planejamento</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="pausada">Pausada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="endereco">Endereço</Label>
          <Input
            id="endereco"
            value={dados.endereco || ''}
            onChange={(e) => onChange({ ...dados, endereco: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input
            id="cidade"
            value={dados.cidade || ''}
            onChange={(e) => onChange({ ...dados, cidade: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="data_inicio">Data Início</Label>
          <Input
            id="data_inicio"
            type="date"
            value={dados.data_inicio || ''}
            onChange={(e) => onChange({ ...dados, data_inicio: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="data_prevista_fim">Previsão Término</Label>
          <Input
            id="data_prevista_fim"
            type="date"
            value={dados.data_prevista_fim || ''}
            onChange={(e) => onChange({ ...dados, data_prevista_fim: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="responsavel">Responsável (Engenheiro/Mestre)</Label>
          <Select value={dados.responsavel_email || undefined} onValueChange={(v) => onChange({ ...dados, responsavel_email: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {colaboradores && colaboradores.length > 0 ? (
                colaboradores.map(c => (
                  <SelectItem key={c.id} value={c.email || `temp-${c.id}`}>
                    {c.nome}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="nenhum" disabled>Nenhum colaborador cadastrado</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ETAPA 2 - Cliente / Centro Custo
function Etapa2ClienteCentroCusto({ dados, dadosCliente, onChangeDados, onChangeCliente, clientes }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Cliente e Centro de Custo</h3>
        <p className="text-sm text-gray-600">Defina o cliente e organize por centro de custo</p>
      </div>

      {dados.tipo === 'privada' && (
        <div>
          <Label htmlFor="cliente">Cliente *</Label>
          <Select value={dadosCliente.cliente_id || undefined} onValueChange={(v) => {
            const cli = clientes.find(c => c.id === v);
            onChangeCliente({ cliente_id: v, cliente_nome: cli?.nome });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes && clientes.length > 0 ? (
                clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))
              ) : (
                <SelectItem value="nenhum" disabled>Nenhum cliente cadastrado</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">Se o cliente não existe, crie-o na tela de Cadastros</p>
        </div>
      )}

      {dados.tipo === 'publica' && (
        <div>
          <Label htmlFor="orgao">Órgão/Entidade *</Label>
          <Input
            id="orgao"
            value={dadosCliente.orgao || ''}
            onChange={(e) => onChangeCliente({ ...dadosCliente, orgao: e.target.value })}
            placeholder="Ex: Prefeitura Municipal"
          />
        </div>
      )}

      <div>
        <Label htmlFor="centro_custo">Centro de Custo *</Label>
        <Input
          id="centro_custo"
          value={dados.centro_custo || ''}
          onChange={(e) => onChangeDados({ ...dados, centro_custo: e.target.value })}
          placeholder="Ex: OBRAS-2026-001"
        />
      </div>

      <div>
        <Label htmlFor="valor_contrato">Valor do Contrato (R$)</Label>
        <Input
          id="valor_contrato"
          type="number"
          step="0.01"
          value={dados.valor_contrato || ''}
          onChange={(e) => onChangeDados({ ...dados, valor_contrato: parseFloat(e.target.value) || 0 })}
          placeholder="Ex: 150000.00"
        />
        <p className="text-xs text-gray-500 mt-1">Valor total do contrato da obra</p>
      </div>
    </div>
  );
}

// ETAPA 3 - Materiais
function Etapa3Materiais({ materiais, sessionId, loading }) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState(new Set());

  const resolverMutation = useMutation({
    mutationFn: async ({ materialId, insumoId, action }) => {
      if (action === 'create') {
        const material = materiais.find(m => m.id === materialId);
        const novoInsumo = await base44.entities.Insumo.create({
          codigo: material.codigo,
          banco: material.banco,
          descricao: material.descricao,
          unidade: material.unidade,
          tipo: 'material'
        });
        insumoId = novoInsumo.id;
      }
      
      await base44.entities.ImportMaterial.update(materialId, {
        insumo_match_id: insumoId,
        match_status: action === 'create' ? 'novo' : 'ok',
        resolved: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['import-materiais', sessionId]);
      toast.success('Material resolvido');
    }
  });

  const criarEmLoteMutation = useMutation({
    mutationFn: async (materialIds) => {
      const resultados = [];
      for (const id of materialIds) {
        const material = materiais.find(m => m.id === id);
        if (!material || material.resolved) continue;
        
        try {
          const novoInsumo = await base44.entities.Insumo.create({
            codigo: material.codigo,
            banco: material.banco,
            descricao: material.descricao,
            unidade: material.unidade,
            tipo: 'material'
          });
          
          await base44.entities.ImportMaterial.update(id, {
            insumo_match_id: novoInsumo.id,
            match_status: 'novo',
            resolved: true
          });
          
          resultados.push({ id, sucesso: true });
        } catch (err) {
          resultados.push({ id, sucesso: false, erro: err.message });
        }
      }
      return resultados;
    },
    onSuccess: (resultados) => {
      const sucesso = resultados.filter(r => r.sucesso).length;
      const falhas = resultados.filter(r => !r.sucesso).length;
      queryClient.invalidateQueries(['import-materiais', sessionId]);
      setSelectedIds(new Set());
      toast.success(`${sucesso} materiais criados` + (falhas > 0 ? ` (${falhas} falhas)` : ''));
    }
  });

  const toggleItem = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(materiais.map(m => m.id)));
  };

  const selectPendentes = () => {
    setSelectedIds(new Set(pendentes.map(m => m.id)));
  };

  const selectResolvidos = () => {
    setSelectedIds(new Set(resolvidos.map(m => m.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const getSelectAllState = () => {
    if (selectedIds.size === 0) return 'unchecked';
    if (selectedIds.size === materiais.length) return 'checked';
    return 'indeterminate';
  };

  const handleCriarEmLote = () => {
    const pendentesSelecionados = Array.from(selectedIds).filter(id => {
      const mat = materiais.find(m => m.id === id);
      return mat && !mat.resolved;
    });
    
    if (pendentesSelecionados.length === 0) {
      toast.error('Selecione materiais pendentes para criar');
      return;
    }
    
    criarEmLoteMutation.mutate(pendentesSelecionados);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const pendentes = materiais.filter(m => !m.resolved);
  const resolvidos = materiais.filter(m => m.resolved);
  const pendentesSelecionados = Array.from(selectedIds).filter(id => {
    const mat = materiais.find(m => m.id === id);
    return mat && !mat.resolved;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Materiais e Insumos</h3>
        <p className="text-sm text-gray-600">
          {pendentes.length === 0 ? (
            <span className="text-green-600">✓ Todos os materiais estão resolvidos</span>
          ) : (
            <span className="text-amber-600">{pendentes.length} materiais precisam de atenção</span>
          )}
        </p>
      </div>

      {/* Controles de Seleção */}
      <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={getSelectAllState() === 'checked'}
                ref={(el) => {
                  if (el) el.indeterminate = getSelectAllState() === 'indeterminate';
                }}
                onChange={() => {
                  if (getSelectAllState() === 'checked') {
                    clearSelection();
                  } else {
                    selectAll();
                  }
                }}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Selecionar todos</span>
            </label>
            <span className="text-sm text-gray-600">
              ({selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={selectPendentes}>
            Selecionar Pendentes ({pendentes.length})
          </Button>
          <Button size="sm" variant="outline" onClick={selectResolvidos}>
            Selecionar Resolvidos ({resolvidos.length})
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelection}>
            Limpar Seleção
          </Button>
        </div>

        {/* Ações em Lote */}
        {selectedIds.size > 0 && (
          <div className="pt-3 border-t flex gap-2">
            {pendentesSelecionados.length > 0 && (
              <Button
                size="sm"
                onClick={handleCriarEmLote}
                disabled={criarEmLoteMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {criarEmLoteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    Criar {pendentesSelecionados.length} Novo{pendentesSelecionados.length > 1 ? 's' : ''} em Lote
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900">Pendentes</h4>
          {pendentes.map(mat => (
            <div key={mat.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(mat.id)}
                  onChange={() => toggleItem(mat.id)}
                  className="w-4 h-4 mt-1 rounded border-gray-300"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{mat.descricao}</p>
                      <p className="text-sm text-gray-600">
                        Código: {mat.codigo} | Unidade: {mat.unidade} | Qtd: {mat.quantidade}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800">Pendente</Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolverMutation.mutate({ materialId: mat.id, action: 'create' })}
                      disabled={resolverMutation.isPending}
                    >
                      Criar Novo Insumo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast.info('Funcionalidade de mapeamento será implementada');
                      }}
                    >
                      Mapear para Existente
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolvidos.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 text-green-700">Resolvidos ({resolvidos.length})</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {resolvidos.map(mat => (
              <div key={mat.id} className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(mat.id)}
                  onChange={() => toggleItem(mat.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{mat.descricao}</p>
                    <p className="text-xs text-gray-600">Qtd: {mat.quantidade} {mat.unidade}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ETAPA 4 - Revisão
function Etapa4Revisao({ dados, dadosCliente, materiais, session }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Revisão Final</h3>
        <p className="text-sm text-gray-600">Confira todas as informações antes de criar a obra</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-gray-900 mb-3">Dados da Obra</h4>
          <div><span className="text-gray-600">Nome:</span> <span className="font-medium">{dados.nome}</span></div>
          <div><span className="text-gray-600">Tipo:</span> <span className="font-medium">{dados.tipo === 'privada' ? 'Privada' : 'Pública'}</span></div>
          <div><span className="text-gray-600">Status:</span> <span className="font-medium">{dados.status}</span></div>
          <div><span className="text-gray-600">Centro de Custo:</span> <span className="font-medium">{dados.centro_custo}</span></div>
        </div>

        <div className="border rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-gray-900 mb-3">Cliente/Contratante</h4>
          <div><span className="text-gray-600">Nome:</span> <span className="font-medium">{dadosCliente.cliente_nome || dadosCliente.orgao || 'Não informado'}</span></div>
        </div>

        <div className="border rounded-lg p-4 space-y-2 md:col-span-2">
          <h4 className="font-semibold text-gray-900 mb-3">Materiais</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{materiais.length}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{materiais.filter(m => m.resolved).length}</p>
              <p className="text-sm text-gray-600">Resolvidos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">
                R$ {session?.dados_extraidos?.totalGeral?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
              </p>
              <p className="text-sm text-gray-600">Valor Total</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ETAPA 5 - Sucesso
function Etapa5Sucesso({ obraId }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Obra Criada com Sucesso!</h3>
      <p className="text-gray-600 mb-6">
        A importação foi concluída e a obra está pronta para uso
      </p>
      <p className="text-sm text-gray-500">
        Redirecionando para a obra em alguns segundos...
      </p>
    </div>
  );
}