import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function FormMedicaoObra({ onSalvo, obraIdPre }) {
  const [obraId, setObraId] = useState(obraIdPre || '');
  const [numero, setNumero] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [valorMedido, setValorMedido] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  const handleSalvar = async () => {
    setErro('');
    if (!obraId) {
      setErro('Obra é obrigatória');
      return;
    }
    if (!periodoInicio || !periodoFim) {
      setErro('Período é obrigatório');
      return;
    }

    setCarregando(true);
    try {
      const { data } = await base44.functions.invoke('criarMedicaoObra', {
        obra_id: obraId,
        numero: numero || undefined,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        valor_total_medido: parseFloat(valorMedido) || 0,
        observacoes
      });

      if (onSalvo) onSalvo(data.medicao);
      // Limpar formulário
      setObraId('');
      setNumero('');
      setPeriodoInicio('');
      setPeriodoFim('');
      setValorMedido('');
      setObservacoes('');
    } catch (err) {
      setErro(err.message || 'Erro ao criar medição');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Medição de Obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {erro && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-1 block">Obra *</label>
          <select
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Selecionar obra...</option>
            {obras.map(obra => (
              <option key={obra.id} value={obra.id}>{obra.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Número da Medição</label>
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: MED-001"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Período Início *</label>
            <Input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Período Fim *</label>
            <Input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Valor Medido (R$)</label>
          <Input
            type="number"
            value={valorMedido}
            onChange={(e) => setValorMedido(e.target.value)}
            placeholder="0.00"
            step="0.01"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows="3"
            placeholder="Observações adicionais..."
          />
        </div>

        <Button
          onClick={handleSalvar}
          disabled={carregando}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {carregando ? 'Salvando...' : 'Salvar Medição'}
        </Button>
      </CardContent>
    </Card>
  );
}