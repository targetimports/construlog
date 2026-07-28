import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export default function RequisicaoForm({ obraId, onSuccess, origem }) {
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [itens, setItens] = useState([]);
  const [notificarAdminEmail, setNotificarAdminEmail] = useState(false);
  const [solicitante_email, setSolicitante_email] = useState('');
  const [solicitante_nome, setSolicitante_nome] = useState('');
  const [novoItem, setNovoItem] = useState({ 
    insumo_id: '', 
    descricao: '', 
    quantidade: 1,
    valor_estimado: 0
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Auto-preencher solicitante ao carregar usuário
  React.useEffect(() => {
    if (user && !solicitante_email) {
      setSolicitante_email(user.email);
      setSolicitante_nome(user.full_name);
    }
  }, [user, solicitante_email]);

  const { data: insumosRaw = [] } = useQuery({
    queryKey: ['insumos-obra', obraId],
    queryFn: async () => {
      try {
        // Primeiro busca itens do orçamento da obra
        const itensOrcamento = await base44.entities.ItemOrcamento.filter({ 
          obra_id: obraId 
        }, '-updated_date', 100);
        
        if (itensOrcamento && itensOrcamento.length > 0) {
          // Mapeia os itens do orçamento para formato de insumo
          return itensOrcamento.map(item => ({
            id: item.insumo_id || item.id,
            nome: item.descricao || item.nome,
            grupo: item.categoria || '',
            unidade: item.unidade || 'un'
          }));
        }
        
        // Fallback: carrega insumos gerais se não houver orçamento
        return await base44.entities.Insumo.list('-updated_date', 50);
      } catch (error) {
        console.error('Erro ao carregar insumos:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!obraId
  });

  // Filtrar e normalizar insumos com nome válido
  const insumos = useMemo(() => {
    return (Array.isArray(insumosRaw) ? insumosRaw : [])
      .filter(i => i.id && i.nome && String(i.nome).trim());
  }, [insumosRaw]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Validar obra_id ANTES de tentar salvar
      if (!obraId || !String(obraId).trim()) {
        throw new Error('OBRA_REQUIRED');
      }

      if (!solicitante_email) {
        throw new Error('SOLICITANTE_REQUIRED');
      }

      if (itens.length === 0) {
        throw new Error('ITEMS_REQUIRED');
      }
      
      const valor_total = itens.reduce((sum, item) => sum + (item.valor_estimado || 0), 0);
      const titulo_padrao = `Solicitação de ${solicitante_nome}`;
      
      const requisicao = await base44.entities.RequisicaoCompra.create({
        titulo: titulo_padrao,
        descricao_resumo: descricao,
        obra_id: obraId,
        data_solicitacao: new Date().toISOString(),
        prioridade,
        status: 'aguardando_aprovacao',
        status_aprovacao: 'em_analise',
        solicitante: solicitante_email,
        solicitante_nome: solicitante_nome,
        solicitante_email: solicitante_email,
        origem: origem || null,
        itens: itens.map(item => ({
          insumo_id: item.insumo_id,
          descricao: item.descricao,
          unidade: 'un',
          quantidade_solicitada: item.quantidade,
          valor_estimado: item.valor_estimado,
          status: 'em_aberto'
        })),
        valor_total_estimado: valor_total,
        qtd_itens: itens.length
      });

      // Iniciar workflow de aprovação multinível
      try {
        await base44.functions.invoke('iniciarWorkflowAprovacao', {
          entidade_tipo: 'RequisicaoCompra',
          entidade_id: requisicao.id,
          requisicao_data: {
            titulo,
            valor_total_estimado: valor_total,
            prioridade,
            obra_id: obraId,
            itens
          }
        });
      } catch (workflowError) {
        console.error('Erro ao iniciar workflow:', workflowError);
        // Continua mesmo se workflow falhar - requisição já foi criada
      }

      return requisicao;
    },
    onSuccess: async (data) => {
      // Enviar notificação ao admin se habilitado
      if (notificarAdminEmail) {
        try {
          await base44.functions.invoke('notificarNovaRequisicaoAdmin', {
            requisicao_id: data.id,
            requisicao_titulo: `Solicitação de ${solicitante_nome}`,
            empresa_id: obraId,
            criador_nome: solicitante_nome
          });
        } catch (error) {
          console.error('Erro ao notificar admin:', error);
        }
      }
      
      toast.success('Requisição criada com sucesso!');
      setDescricao('');
      setPrioridade('normal');
      setItens([]);
      setNotificarAdminEmail(false);
      onSuccess?.(data);
    },
    onError: (error) => {
      if (error.message === 'OBRA_REQUIRED') {
        toast.error('Selecione uma obra para prosseguir');
      } else if (error.message === 'SOLICITANTE_REQUIRED') {
        toast.error('Solicitante obrigatório');
      } else if (error.message === 'ITEMS_REQUIRED') {
        toast.error('Adicione pelo menos um item');
      } else {
        toast.error('Erro ao criar requisição: ' + error.message);
      }
    }
  });

  const adicionarItem = () => {
    if (!novoItem.descricao || novoItem.quantidade <= 0) {
      toast.error('Preencha descrição e quantidade');
      return;
    }
    setItens([...itens, { ...novoItem }]);
    setNovoItem({ insumo_id: '', descricao: '', quantidade: 1, valor_estimado: 0 });
  };

  const removerItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const totalEstimado = itens.reduce((sum, item) => sum + (item.valor_estimado || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Requisição de Compra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Solicitante - Obrigatório e Leitura Automática */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <label className="block text-sm font-medium mb-1">Solicitante *</label>
            <input
              type="email"
              value={solicitante_email}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={solicitante_nome}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600"
            />
          </div>
        </div>

        {/* Título será gerado automaticamente */}
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
          <p className="font-medium">Título automático: Solicitação de {solicitante_nome || '...'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Descrição</label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Detalhes sobre a solicitação"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Prioridade</label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>

        </div>

        {/* Notificar Admin */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Checkbox
            id="notificar-admin"
            checked={notificarAdminEmail}
            onCheckedChange={setNotificarAdminEmail}
          />
          <label htmlFor="notificar-admin" className="flex items-center gap-2 cursor-pointer flex-1">
            <Mail className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-700">Notificar administrador da empresa por e-mail</span>
          </label>
        </div>

        {/* Adicionar Itens */}
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4">Itens da Requisição</h4>
          
          <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">Insumo</label>
              <Select value={novoItem.insumo_id} onValueChange={(value) => {
                const insumo = insumos.find(i => i.id === value);
                setNovoItem({
                  ...novoItem,
                  insumo_id: value,
                  descricao: insumo?.nome || ''
                });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={insumos.length === 0 ? "Nenhum insumo disponível" : "Selecione um insumo"} />
                </SelectTrigger>
                <SelectContent>
                  {insumos.map(insumo => (
                    <SelectItem key={insumo.id} value={insumo.id}>
                      {insumo.nome} {insumo.grupo ? `(${insumo.grupo})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <Input
                  value={novoItem.descricao}
                  onChange={(e) => setNovoItem({ ...novoItem, descricao: e.target.value })}
                  placeholder="Descrição do item"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Qtd</label>
                <Input
                  type="number"
                  value={novoItem.quantidade}
                  onChange={(e) => setNovoItem({ ...novoItem, quantidade: parseFloat(e.target.value) || 0 })}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor Est.</label>
                <Input
                  type="number"
                  value={novoItem.valor_estimado}
                  onChange={(e) => setNovoItem({ ...novoItem, valor_estimado: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={adicionarItem}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </div>

          {/* Lista de Itens */}
          {itens.length > 0 && (
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.descricao}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantidade} x R$ {item.valor_estimado?.toFixed(2) || '0.00'} = R$ {(item.quantidade * (item.valor_estimado || 0)).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => removerItem(idx)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo */}
        {itens.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between mb-4">
              <span className="font-semibold">Total Estimado:</span>
              <span className="text-xl font-bold text-blue-600">
                R$ {totalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button variant="outline" onClick={() => {
            setTitulo('');
            setDescricao('');
            setItens([]);
          }}>
            Limpar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!solicitante_email || itens.length === 0 || createMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Requisição'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}