import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save, Camera, XCircle } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function RecebimentoForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const ordemId = urlParams.get('ordem_id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    ordem_compra_id: ordemId || '',
    material_id: '',
    descricao: '',
    quantidade_recebida: '',
    unidade: '',
    data_recebimento: new Date().toISOString().split('T')[0],
    nota_fiscal: '',
    valor_nota: '',
    qualidade: 'aprovado',
    conferido_por: '',
    observacoes: ''
  });

  const [fotos, setFotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: ordemData } = useQuery({
    queryKey: ['ordem-compra', ordemId],
    queryFn: () => base44.entities.OrdemCompra.filter({ id: ordemId }),
    enabled: !!ordemId
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  useEffect(() => {
    if (ordemData && ordemData[0]) {
      const ordem = ordemData[0];
      const primeiroItem = ordem.itens?.[0];
      setFormData(prev => ({
        ...prev,
        descricao: primeiroItem?.descricao || ordem.descricao,
        quantidade_recebida: primeiroItem?.quantidade || 0,
        unidade: primeiroItem?.unidade || ''
      }));
    }
  }, [ordemData]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingPhoto(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      setFotos([...fotos, ...uploadedUrls]);
      toast.success(`${files.length} foto(s) adicionada(s)`);
    } catch (error) {
      toast.error('Erro ao fazer upload das fotos');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.material_id) {
        throw new Error('Selecione um material do estoque');
      }

      const recebimento = await base44.entities.RecebimentoMaterial.create({
        ...data,
        quantidade_recebida: Number(data.quantidade_recebida),
        valor_nota: data.valor_nota ? Number(data.valor_nota) : null,
        fotos
      });

      // Atualizar status da ordem de compra
      if (ordemId) {
        const ordem = ordemData[0];
        await base44.entities.OrdemCompra.update(ordemId, { status: 'recebida' });

        // Criar movimentação de entrada no estoque
        if (recebimento.qualidade === 'aprovado' || recebimento.qualidade === 'parcial') {
          const material = materiais.find(m => m.id === data.material_id);
          
          if (material) {
            // Atualizar estoque
            await base44.entities.Material.update(material.id, {
              estoque_atual: (material.estoque_atual || 0) + Number(data.quantidade_recebida)
            });

            // Registrar movimentação
            await base44.entities.MovimentacaoEstoque.create({
              material_id: material.id,
              tipo: 'entrada',
              quantidade: Number(data.quantidade_recebida),
              obra_destino_id: ordem.obra_id,
              ordem_compra_id: ordemId,
              valor_unitario: data.valor_nota ? Number(data.valor_nota) / Number(data.quantidade_recebida) : 0,
              valor_total: Number(data.valor_nota || 0),
              nota_fiscal: data.nota_fiscal,
              data_movimentacao: data.data_recebimento,
              responsavel: data.conferido_por,
              observacoes: `Recebimento OC #${ordem.numero} - NF: ${data.nota_fiscal || 'N/A'}`
            });

            // Criar conta financeira a pagar
            if (data.valor_nota && Number(data.valor_nota) > 0) {
              await base44.entities.ContaFinanceira.create({
                tipo: 'pagar',
                descricao: `Pagamento OC #${ordem.numero} - ${data.descricao}`,
                valor: Number(data.valor_nota),
                data_vencimento: new Date(new Date(data.data_recebimento).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'pendente',
                obra_id: ordem.obra_id,
                categoria: 'material',
                fornecedor_cliente: ordem.fornecedor_nome,
                nota_fiscal: data.nota_fiscal,
                observacao: `Ref: OC #${ordem.numero}`
              });
            }
          }
        }
      }

      return recebimento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recebimentos'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      toast.success('Recebimento registrado!');
      window.location.href = createPageUrl('Compras');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.href = createPageUrl('Compras')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Registrar Recebimento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Dados do Recebimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-gray-400">Material do Estoque *</Label>
                <Select 
                  value={formData.material_id} 
                  onValueChange={(v) => {
                    const mat = materiais.find(m => m.id === v);
                    setFormData({ 
                      ...formData, 
                      material_id: v,
                      descricao: mat?.nome || '',
                      unidade: mat?.unidade || ''
                    });
                  }}
                >
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione o material..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {materiais.map(mat => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.nome} ({mat.unidade}) - Estoque: {mat.estoque_atual || 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400">Descrição</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  disabled
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Quantidade Recebida *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantidade_recebida}
                  onChange={(e) => setFormData({ ...formData, quantidade_recebida: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Unidade</Label>
                <Input
                  value={formData.unidade}
                  onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Data Recebimento *</Label>
                <Input
                  type="date"
                  value={formData.data_recebimento}
                  onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Nota Fiscal</Label>
                <Input
                  value={formData.nota_fiscal}
                  onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                  placeholder="Número da NF"
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Valor Nota Fiscal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_nota}
                  onChange={(e) => setFormData({ ...formData, valor_nota: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Qualidade</Label>
                <Select value={formData.qualidade} onValueChange={(v) => setFormData({ ...formData, qualidade: v })}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Conferido Por</Label>
                <Input
                  value={formData.conferido_por}
                  onChange={(e) => setFormData({ ...formData, conferido_por: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400">Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                  rows={3}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Fotos do Recebimento
                </Label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                  disabled={uploadingPhoto}
                />
                <label
                  htmlFor="photo-upload"
                  className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-amber-500/50 transition-colors mt-2"
                >
                  {uploadingPhoto ? (
                    <span className="text-gray-400">Carregando...</span>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-400">Clique para adicionar fotos</span>
                    </>
                  )}
                </label>
                {fotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {fotos.map((foto, idx) => (
                      <div key={idx} className="relative group">
                        <img 
                          src={foto} 
                          alt="Preview"
                          className="w-full h-24 object-cover rounded-lg border border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => setFotos(fotos.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Compras')}
            className="border-gray-700 text-gray-400"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900 gap-2"
          >
            <Save className="w-4 h-4" />
            Registrar Recebimento
          </Button>
        </div>
      </form>
    </div>
  );
}