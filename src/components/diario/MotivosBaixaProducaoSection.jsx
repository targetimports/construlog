import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MotivosBaixaProducaoSection({ diarioId, disabled = false }) {
  const [motivosSelecionados, setMotivosSelecionados] = useState({});
  const [observacoesMotivoLocal, setObservacoesMotivoLocal] = useState({});
  const queryClient = useQueryClient();

  // Buscar catálogo de motivos
  const { data: motivosCatalogo = [] } = useQuery({
    queryKey: ['motivos-catalogo'],
    queryFn: () => base44.entities.MotivoCatalogo.filter({ ativo: true }, 'ordem', 50)
  });

  // Buscar motivos do diário atual
  const { data: motivosDiario = [] } = useQuery({
    queryKey: ['diario-motivos', diarioId],
    queryFn: () => base44.entities.DiarioObraMotivo.filter({ diario_id: diarioId }),
    enabled: !!diarioId
  });

  // Sincronizar estado local com dados carregados
  React.useEffect(() => {
    if (motivosDiario.length > 0) {
      const selecionados = {};
      const observacoes = {};
      motivosDiario.forEach(m => {
        selecionados[m.motivo_id] = true;
        if (m.observacao) observacoes[m.motivo_id] = m.observacao;
      });
      setMotivosSelecionados(selecionados);
      setObservacoesMotivoLocal(observacoes);
    }
  }, [motivosDiario]);

  // Mutation para salvar/deletar motivos
  const salvarMotivosMutation = useMutation({
    mutationFn: async () => {
      // Deletar motivos desmarcados
      const paraDeleter = motivosDiario
        .filter(m => !motivosSelecionados[m.motivo_id])
        .map(m => m.id);

      for (const id of paraDeleter) {
        await base44.entities.DiarioObraMotivo.delete(id);
      }

      // Criar/atualizar motivos marcados
      for (const [motivoId, selecionado] of Object.entries(motivosSelecionados)) {
        if (selecionado) {
          const jaExiste = motivosDiario.find(m => m.motivo_id === motivoId);
          const observacao = observacoesMotivoLocal[motivoId] || null;

          if (jaExiste) {
            // Atualizar observação se mudou
            if (jaExiste.observacao !== observacao) {
              await base44.entities.DiarioObraMotivo.update(jaExiste.id, { observacao });
            }
          } else {
            // Criar novo registro
            await base44.entities.DiarioObraMotivo.create({
              diario_id: diarioId,
              motivo_id: motivoId,
              observacao: observacao
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diario-motivos', diarioId] });
      toast.success('Motivos salvos');
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar motivos')
  });

  const handleToggleMotivo = (motivoId) => {
    setMotivosSelecionados(prev => ({
      ...prev,
      [motivoId]: !prev[motivoId]
    }));
  };

  const handleObservacaoChange = (motivoId, valor) => {
    setObservacoesMotivoLocal(prev => ({
      ...prev,
      [motivoId]: valor
    }));
  };

  // Validação: OUTROS exige observação
  const motivoOutros = motivosCatalogo.find(m => m.nome === 'OUTROS');
  const outrosMarc = motivoOutros && motivosSelecionados[motivoOutros.id];
  const outrosObsPreenchida = observacoesMotivoLocal[motivoOutros?.id];
  const podeAprovar = !outrosMarc || outrosObsPreenchida; // OK se OUTROS não marcado, ou se tem obs

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900">Motivos de Baixa Produção</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {motivosCatalogo.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum motivo cadastrado. Solicite ao administrador.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {motivosCatalogo.map(motivo => (
              <div key={motivo.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`motivo-${motivo.id}`}
                    checked={motivosSelecionados[motivo.id] || false}
                    onCheckedChange={() => handleToggleMotivo(motivo.id)}
                    disabled={disabled}
                    className="border-gray-300"
                  />
                  <label htmlFor={`motivo-${motivo.id}`} className="text-gray-700 cursor-pointer text-sm">
                    {motivo.nome}
                  </label>
                </div>

                {/* Campo de observação se selecionado */}
                {motivosSelecionados[motivo.id] && (
                  <div className="ml-7 space-y-1">
                    <Input
                      type="text"
                      placeholder={motivo.nome === 'OUTROS' ? 'Descreva o motivo (obrigatório)' : 'Observação adicional (opcional)'}
                      value={observacoesMotivoLocal[motivo.id] || ''}
                      onChange={(e) => handleObservacaoChange(motivo.id, e.target.value)}
                      disabled={disabled}
                      className="bg-white border-gray-300 text-gray-900 text-sm h-8"
                      required={motivo.nome === 'OUTROS'}
                    />
                    {motivo.nome === 'OUTROS' && !observacoesMotivoLocal[motivo.id] && (
                      <p className="text-xs text-red-600">Obrigatório</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Validação OUTROS */}
        {outrosMarc && !outrosObsPreenchida && (
          <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-xs">Descrevendo "OUTROS" é obrigatório</p>
          </div>
        )}

        {!disabled && (
          <button
            onClick={() => salvarMotivosMutation.mutate()}
            disabled={!podeAprovar || salvarMotivosMutation.isPending}
            className="w-full mt-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium"
          >
            {salvarMotivosMutation.isPending ? 'Salvando...' : 'Salvar Motivos'}
          </button>
        )}
      </CardContent>
    </Card>
  );
}