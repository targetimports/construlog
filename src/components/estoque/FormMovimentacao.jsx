import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowDown, ArrowUp, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function FormMovimentacao({ tipo, depositoId, obraId, onSuccess }) {
  const [materialId, setMaterialId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState('');
  const queryClient = useQueryClient();

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material?.list?.() || []
  });

  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas'],
    queryFn: () => base44.entities.ItemOrcamento?.list?.() || []
  });

  const materialSelecionado = materiais.find(m => m.id === materialId);

  const fazerMovimentacaoMutation = useMutation({
    mutationFn: async () => {
      setErro('');
      
      // Validar movimentação
      const validacao = await base44.functions.invoke('validarMovimentacaoEstoque', {
        material_id: materialId,
        obra_id: obraId,
        quantidade: parseFloat(quantidade),
        tipo,
        deposito_id: depositoId
      });
      
      if (!validacao.valido) {
        setErro(validacao.motivo);
        throw new Error(validacao.motivo);
      }
      
      // Prosseguir com a movimentação
      return base44.functions.invoke('gerenciadorEstoque', {
        acao: tipo,
        depositoId,
        materialId,
        quantidade: parseFloat(quantidade),
        etapaId: tipo === 'saida' ? etapaId : null,
        observacoes
      });
    },
    onSuccess: (data) => {
      setErro('');
      if (data.data.alerta_reposicao) {
        toast.warning('Estoque abaixo do mínimo! Reposição recomendada.');
      } else {
        toast.success('Movimentação realizada com sucesso');
      }
      queryClient.invalidateQueries({ queryKey: ['materiais'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
      setMaterialId('');
      setQuantidade('');
      setEtapaId('');
      setObservacoes('');
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const isValido = materialId && quantidade && parseFloat(quantidade) > 0 && (tipo !== 'saida' || etapaId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {tipo === 'entrada' ? (
            <><ArrowDown className="w-4 h-4 text-green-600" /> Entrada</>
          ) : (
            <><ArrowUp className="w-4 h-4 text-red-600" /> Saída</>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
         {/* Erro */}
         {erro && (
           <Alert className="bg-red-50 border-red-200">
             <p className="text-xs text-red-600">{erro}</p>
           </Alert>
         )}

         {/* Alerta */}
         {tipo === 'saida' && materialSelecionado && (
           <Alert className={`${materialSelecionado.estoque_atual < parseFloat(quantidade || 0) ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
             <p className="text-xs">
               Disponível: <span className="font-bold">{materialSelecionado.estoque_atual}</span>
               {materialSelecionado.estoque_atual < parseFloat(quantidade || 0) && (
                 <span className="text-red-600 ml-2">Insuficiente!</span>
               )}
             </p>
           </Alert>
         )}

        {/* Seleção de Material */}
        <div>
          <label className="text-sm font-medium">Material</label>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="w-full p-2 border rounded text-sm mt-1"
          >
            <option value="">Selecione um material</option>
            {materiais.map(m => (
              <option key={m.id} value={m.id}>
                {m.nome} ({m.estoque_atual} {m.unidade})
              </option>
            ))}
          </select>
        </div>

        {/* Quantidade */}
        <div>
          <label className="text-sm font-medium">Quantidade</label>
          <Input
            type="number"
            step="0.01"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="0"
            className="text-sm h-8 mt-1"
          />
        </div>

        {/* Etapa (apenas para saída) */}
        {tipo === 'saida' && (
          <div>
            <label className="text-sm font-medium">Etapa/Item (Obrigatório)</label>
            <select
              value={etapaId}
              onChange={(e) => setEtapaId(e.target.value)}
              className="w-full p-2 border rounded text-sm mt-1"
            >
              <option value="">Selecione uma etapa</option>
              {etapas.map(e => (
                <option key={e.id} value={e.id}>
                  {e.descricao}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Observações */}
        <div>
          <label className="text-sm font-medium">Observações</label>
          <Input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Recebido em boas condições, consumo normal..."
            className="text-sm h-8 mt-1"
          />
        </div>

        {/* Botão */}
        <Button
          onClick={() => fazerMovimentacaoMutation.mutate()}
          disabled={!isValido || fazerMovimentacaoMutation.isPending}
          className="w-full gap-2"
        >
          {fazerMovimentacaoMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Confirmar {tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </Button>
      </CardContent>
    </Card>
  );
}