import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Loader } from 'lucide-react';
import { format, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import UploadMidiaMovimentacao from './UploadMidiaMovimentacao';

export default function FormMovimentacaoFechamento({
  movimentacao,
  veiculo,
  obraOrigem,
  obraDestino,
  onCancelada,
  onSucesso
}) {
  const [formData, setFormData] = useState({
    retorno_hora: new Date().toISOString().slice(0, 16),
    km_final: ''
  });
  const [midias, setMidias] = useState([]);

  const queryClient = useQueryClient();

  // Fechar movimentação
  const closeMutation = useMutation({
    mutationFn: async (data) => {
      const kmFinal = parseFloat(data.km_final);
      const kmInicial = parseFloat(movimentacao.km_inicial);

      if (kmFinal < kmInicial) {
        throw new Error('KM final não pode ser menor que KM inicial');
      }

      // 1. Atualizar movimentação
      await base44.entities.MovimentacaoVeiculo.update(movimentacao.id, {
        retorno_hora: new Date(data.retorno_hora).toISOString(),
        km_final: kmFinal,
        status: 'FECHADA'
      });

      // 2. Criar mídia se houver
      for (const midia of midias) {
        if (midia.arquivo_url) {
          await base44.entities.MovimentacaoVeiculoMidia.create({
            movimentacao_id: movimentacao.id,
            tipo: midia.tipo,
            arquivo_url: midia.arquivo_url,
            legenda: midia.legenda
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      toast.success('Movimentação fechada!');
      onSucesso?.();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleFechamento = () => {
    if (!formData.km_final) {
      toast.error('KM final obrigatório');
      return;
    }

    closeMutation.mutate(formData);
  };

  // Cálculos
  const saidaHora = parseISO(movimentacao.saida_hora);
  const retornoHora = new Date(formData.retorno_hora);
  const duracao = differenceInHours(retornoHora, saidaHora) * 60 +
    differenceInMinutes(retornoHora, saidaHora);
  const kmRodado = formData.km_final ? 
    (parseFloat(formData.km_final) - parseFloat(movimentacao.km_inicial)).toFixed(2) : 
    '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button onClick={onCancelada} variant="ghost" size="icon" className="text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Fechar Movimentação</h1>
          <p className="text-gray-400 text-sm">{veiculo?.placa}</p>
        </div>
      </div>

      {/* Resumo da Saída */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Resumo da Saída</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Saída</p>
            <p className="text-white font-semibold mt-1">
              {format(saidaHora, 'dd MMM HH:mm', { locale: ptBR })}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">KM Inicial</p>
            <p className="text-white font-semibold mt-1">{movimentacao.km_inicial}</p>
          </div>
          {obraOrigem && (
            <div>
              <p className="text-gray-400 text-xs">Origem</p>
              <p className="text-white font-semibold mt-1 text-xs">{obraOrigem.nome}</p>
            </div>
          )}
          {obraDestino && (
            <div>
              <p className="text-gray-400 text-xs">Destino</p>
              <p className="text-white font-semibold mt-1 text-xs">{obraDestino.nome}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulário de Fechamento */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Fechamento</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Retorno Hora */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Hora de Retorno *</Label>
            <Input
              type="datetime-local"
              value={formData.retorno_hora}
              onChange={(e) => setFormData({ ...formData, retorno_hora: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white mt-1"
            />
          </div>

          {/* KM Final */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">KM Final *</Label>
            <Input
              type="number"
              value={formData.km_final}
              onChange={(e) => setFormData({ ...formData, km_final: e.target.value })}
              placeholder={movimentacao.km_inicial}
              className="bg-gray-700 border-gray-600 text-white mt-1"
            />
          </div>

          {/* Resumo de KM e Duração */}
          <div className="bg-gray-700/20 rounded p-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">KM Rodado</p>
              <p className="text-white font-semibold mt-1">{kmRodado} km</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Duração</p>
              <p className="text-white font-semibold mt-1">
                {Math.floor(duracao / 60)}h {duracao % 60}m
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload de Mídia */}
      <UploadMidiaMovimentacao midias={midias} onMidiasChange={setMidias} />

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        <Button onClick={onCancelada} variant="outline" className="border-gray-600 text-gray-300">
          Cancelar
        </Button>
        <Button
          onClick={handleFechamento}
          className="bg-green-600 hover:bg-green-700 gap-2"
          disabled={closeMutation.isPending}
        >
          {closeMutation.isPending && <Loader className="w-4 h-4 animate-spin" />}
          Fechar Movimentação
        </Button>
      </div>
    </div>
  );
}