import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function LicitacaoForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const licitacaoId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    numero_edital: '',
    modalidade: 'pregao',
    tipo: 'menor_preco',
    orgao: '',
    objeto: '',
    valor_estimado: '',
    data_publicacao: '',
    data_abertura: '',
    data_resultado: '',
    prazo_execucao: '',
    status: 'em_analise',
    nossa_proposta: '',
    resultado: 'aguardando',
    vencedor_nome: '',
    vencedor_valor: '',
    observacoes: '',
    link_edital: ''
  });

  const { data: licitacaoData } = useQuery({
    queryKey: ['licitacao', licitacaoId],
    queryFn: () => base44.entities.Licitacao.filter({ id: licitacaoId }),
    enabled: !!licitacaoId
  });

  useEffect(() => {
    if (licitacaoData && licitacaoData[0]) {
      setFormData(licitacaoData[0]);
    }
  }, [licitacaoData]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Licitacao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitacoes'] });
      toast.success('Licitação cadastrada!');
      window.location.href = createPageUrl('Licitacoes');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Licitacao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitacoes'] });
      toast.success('Licitação atualizada!');
      window.location.href = createPageUrl('Licitacoes');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      ...formData,
      valor_estimado: formData.valor_estimado ? parseFloat(formData.valor_estimado) : null,
      nossa_proposta: formData.nossa_proposta ? parseFloat(formData.nossa_proposta) : null,
      vencedor_valor: formData.vencedor_valor ? parseFloat(formData.vencedor_valor) : null,
      prazo_execucao: formData.prazo_execucao ? parseInt(formData.prazo_execucao) : null
    };

    if (licitacaoId) {
      updateMutation.mutate({ id: licitacaoId, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-white">
          {licitacaoId ? 'Editar Licitação' : 'Nova Licitação'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-400">Número do Edital *</Label>
              <Input
                value={formData.numero_edital}
                onChange={(e) => setFormData({ ...formData, numero_edital: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Modalidade *</Label>
              <Select value={formData.modalidade} onValueChange={(v) => setFormData({ ...formData, modalidade: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="pregao">Pregão</SelectItem>
                  <SelectItem value="concorrencia">Concorrência</SelectItem>
                  <SelectItem value="tomada_preco">Tomada de Preço</SelectItem>
                  <SelectItem value="convite">Convite</SelectItem>
                  <SelectItem value="rdc">RDC</SelectItem>
                  <SelectItem value="dispensa">Dispensa</SelectItem>
                  <SelectItem value="inexigibilidade">Inexigibilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="menor_preco">Menor Preço</SelectItem>
                  <SelectItem value="tecnica_preco">Técnica e Preço</SelectItem>
                  <SelectItem value="melhor_tecnica">Melhor Técnica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Órgão Licitante *</Label>
              <Input
                value={formData.orgao}
                onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-gray-400">Objeto *</Label>
              <Textarea
                value={formData.objeto}
                onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Valores e Prazos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Valores e Prazos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-400">Valor Estimado</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_estimado}
                onChange={(e) => setFormData({ ...formData, valor_estimado: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Prazo de Execução (dias)</Label>
              <Input
                type="number"
                value={formData.prazo_execucao}
                onChange={(e) => setFormData({ ...formData, prazo_execucao: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Data Publicação</Label>
              <Input
                type="date"
                value={formData.data_publicacao}
                onChange={(e) => setFormData({ ...formData, data_publicacao: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Data Abertura</Label>
              <Input
                type="date"
                value={formData.data_abertura}
                onChange={(e) => setFormData({ ...formData, data_abertura: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Data Resultado</Label>
              <Input
                type="date"
                value={formData.data_resultado}
                onChange={(e) => setFormData({ ...formData, data_resultado: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* Nossa Participação */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Nossa Participação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-400">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="habilitado">Habilitado</SelectItem>
                  <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                  <SelectItem value="vencedor">Vencedor</SelectItem>
                  <SelectItem value="perdedor">Perdedor</SelectItem>
                  <SelectItem value="desistencia">Desistência</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Nossa Proposta</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.nossa_proposta}
                onChange={(e) => setFormData({ ...formData, nossa_proposta: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Vencedor</Label>
              <Input
                value={formData.vencedor_nome}
                onChange={(e) => setFormData({ ...formData, vencedor_nome: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Valor Vencedor</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.vencedor_valor}
                onChange={(e) => setFormData({ ...formData, vencedor_valor: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Link do Edital</Label>
              <Input
                type="url"
                value={formData.link_edital}
                onChange={(e) => setFormData({ ...formData, link_edital: e.target.value })}
                placeholder="https://..."
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Observações</h3>
          <Textarea
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white"
            rows={4}
          />
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Licitacoes')}
            className="border-gray-700 text-gray-400"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Save className="w-4 h-4 mr-2" />
            {licitacaoId ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </div>
  );
}