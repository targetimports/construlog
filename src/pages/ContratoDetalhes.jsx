import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, 
  Edit,
  Plus,
  FileText,
  Paperclip,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig = {
  vigente: { label: 'Vigente', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  suspenso: { label: 'Suspenso', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  encerrado: { label: 'Encerrado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  rescindido: { label: 'Rescindido', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

export default function ContratoDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const contratoId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [dialogAditivo, setDialogAditivo] = useState(false);
  const [dialogAnexo, setDialogAnexo] = useState(false);

  const [aditivoForm, setAditivoForm] = useState({
    numero: '',
    tipo: 'valor',
    descricao: '',
    valor_aditivo: '',
    prazo_adicional_dias: '',
    data_assinatura: '',
    justificativa: ''
  });

  const [anexoFile, setAnexoFile] = useState(null);
  const [anexoForm, setAnexoForm] = useState({ nome: '', tipo: 'contrato', descricao: '' });

  const { data: contratoData, isLoading } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: () => base44.entities.Contrato.filter({ id: contratoId }),
    enabled: !!contratoId
  });

  const { data: aditivos = [] } = useQuery({
    queryKey: ['aditivos', contratoId],
    queryFn: () => base44.entities.AditivoContrato.filter({ contrato_id: contratoId }),
    enabled: !!contratoId
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos-contrato', contratoId],
    queryFn: () => base44.entities.AnexoContrato.filter({ contrato_id: contratoId }),
    enabled: !!contratoId
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const createAditivoMutation = useMutation({
    mutationFn: async (data) => {
      const aditivo = await base44.entities.AditivoContrato.create({
        ...data,
        contrato_id: contratoId,
        valor_aditivo: Number(data.valor_aditivo || 0),
        prazo_adicional_dias: Number(data.prazo_adicional_dias || 0)
      });

      // Atualizar totais do contrato
      const contrato = contratoData[0];
      const novoValorAditivos = (contrato.valor_total_aditivos || 0) + Number(data.valor_aditivo || 0);
      await base44.entities.Contrato.update(contratoId, {
        valor_total_aditivos: novoValorAditivos,
        valor_total: contrato.valor_inicial + novoValorAditivos
      });

      return aditivo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aditivos', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contrato', contratoId] });
      toast.success('Aditivo criado!');
      setDialogAditivo(false);
      setAditivoForm({
        numero: '',
        tipo: 'valor',
        descricao: '',
        valor_aditivo: '',
        prazo_adicional_dias: '',
        data_assinatura: '',
        justificativa: ''
      });
    }
  });

  const createAnexoMutation = useMutation({
    mutationFn: async (data) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: anexoFile });
      const tamanhoKB = Math.round(anexoFile.size / 1024);
      return base44.entities.AnexoContrato.create({
        ...data,
        contrato_id: contratoId,
        arquivo_url: file_url,
        tamanho_kb: tamanhoKB
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anexos-contrato', contratoId] });
      toast.success('Anexo adicionado!');
      setDialogAnexo(false);
      setAnexoFile(null);
      setAnexoForm({ nome: '', tipo: 'contrato', descricao: '' });
    }
  });

  if (isLoading) {
    return <Skeleton className="h-64 bg-gray-800 rounded-2xl" />;
  }

  const contrato = contratoData?.[0];
  if (!contrato) {
    return <p className="text-gray-500 text-center py-12">Contrato não encontrado</p>;
  }

  const obra = obras.find(o => o.id === contrato.obra_id);
  const status = statusConfig[contrato.status];

  const diasRestantes = contrato.data_fim_prevista 
    ? Math.floor((new Date(contrato.data_fim_prevista) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Contrato {contrato.numero}</h1>
              <Badge className={cn("border", status.color)}>{status.label}</Badge>
            </div>
            <p className="text-gray-500">{contrato.contratado}</p>
          </div>
        </div>
        <Button
          onClick={() => window.location.href = createPageUrl(`ContratoForm?id=${contrato.id}`)}
          className="bg-amber-500 hover:bg-amber-600 text-gray-900 gap-2"
        >
          <Edit className="w-4 h-4" />
          Editar
        </Button>
      </div>

      {/* Alertas */}
      {diasRestantes !== null && diasRestantes <= 30 && diasRestantes >= 0 && (
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-amber-400 font-medium">
              Contrato vence em {diasRestantes} dias ({new Date(contrato.data_fim_prevista).toLocaleDateString('pt-BR')})
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-gray-400 text-sm">Contratante</p>
              <p className="text-white font-medium">{contrato.contratante}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Contratado</p>
              <p className="text-white font-medium">{contrato.contratado}</p>
            </div>
            {obra && (
              <div>
                <p className="text-gray-400 text-sm">Obra</p>
                <p className="text-white font-medium">{obra.nome}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-sm">Objeto</p>
              <p className="text-white">{contrato.objeto || 'Não especificado'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Valores e Prazos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Valor Inicial</p>
                <p className="text-white font-bold">
                  {contrato.valor_inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              {contrato.valor_total_aditivos > 0 && (
                <div>
                  <p className="text-gray-400 text-sm">Aditivos</p>
                  <p className="text-purple-400 font-bold">
                    +{contrato.valor_total_aditivos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-gray-800">
              <p className="text-gray-400 text-sm">Valor Total</p>
              <p className="text-amber-400 font-bold text-2xl">
                {(contrato.valor_total || contrato.valor_inicial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800">
              <div>
                <p className="text-gray-400 text-sm">Início</p>
                <p className="text-white">{new Date(contrato.data_inicio).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Fim Previsto</p>
                <p className="text-white">{new Date(contrato.data_fim_prevista).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aditivos */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Aditivos Contratuais
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogAditivo(true)}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Aditivo
          </Button>
        </CardHeader>
        <CardContent>
          {aditivos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum aditivo</p>
          ) : (
            <div className="space-y-3">
              {aditivos.map(aditivo => (
                <div key={aditivo.id} className="p-4 bg-gray-800/50 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-medium">Aditivo {aditivo.numero}</p>
                      <p className="text-gray-400 text-sm capitalize">{aditivo.tipo.replace('_', ' ')}</p>
                    </div>
                    <Badge variant="outline" className="border-gray-700 text-gray-400">
                      {new Date(aditivo.data_assinatura).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                  <p className="text-gray-300 text-sm">{aditivo.descricao}</p>
                  {aditivo.valor_aditivo > 0 && (
                    <p className="text-purple-400 font-semibold mt-2">
                      +{aditivo.valor_aditivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-amber-500" />
            Documentos Anexos
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogAnexo(true)}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {anexos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum anexo</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {anexos.map(anexo => (
                <a
                  key={anexo.id}
                  href={anexo.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <p className="text-white font-medium text-sm">{anexo.nome}</p>
                  <p className="text-gray-500 text-xs">{anexo.tipo} • {anexo.tamanho_kb} KB</p>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Aditivo */}
      <Dialog open={dialogAditivo} onOpenChange={setDialogAditivo}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Aditivo</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAditivoMutation.mutate(aditivoForm);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Número *</Label>
                <Input
                  value={aditivoForm.numero}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, numero: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Tipo *</Label>
                <Select value={aditivoForm.tipo} onValueChange={(v) => setAditivoForm({ ...aditivoForm, tipo: v })}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="valor">Valor</SelectItem>
                    <SelectItem value="prazo">Prazo</SelectItem>
                    <SelectItem value="escopo">Escopo</SelectItem>
                    <SelectItem value="misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400">Descrição *</Label>
                <Textarea
                  value={aditivoForm.descricao}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, descricao: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-gray-400">Valor Aditivo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={aditivoForm.valor_aditivo}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, valor_aditivo: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Prazo Adicional (dias)</Label>
                <Input
                  type="number"
                  value={aditivoForm.prazo_adicional_dias}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, prazo_adicional_dias: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400">Data Assinatura *</Label>
                <Input
                  type="date"
                  value={aditivoForm.data_assinatura}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, data_assinatura: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogAditivo(false)} className="border-gray-700 text-gray-400">
                Cancelar
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-gray-900">
                Adicionar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Anexo */}
      <Dialog open={dialogAnexo} onOpenChange={setDialogAnexo}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar Anexo</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!anexoFile) {
                toast.error('Selecione um arquivo');
                return;
              }
              createAnexoMutation.mutate(anexoForm);
            }}
            className="space-y-4"
          >
            <div>
              <Label className="text-gray-400">Arquivo *</Label>
              <input
                type="file"
                onChange={(e) => {
                  setAnexoFile(e.target.files[0]);
                  if (!anexoForm.nome && e.target.files[0]) {
                    setAnexoForm({ ...anexoForm, nome: e.target.files[0].name });
                  }
                }}
                className="mt-1.5 w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-gray-900 hover:file:bg-amber-600"
                required
              />
            </div>
            <div>
              <Label className="text-gray-400">Nome *</Label>
              <Input
                value={anexoForm.nome}
                onChange={(e) => setAnexoForm({ ...anexoForm, nome: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Tipo</Label>
              <Select value={anexoForm.tipo} onValueChange={(v) => setAnexoForm({ ...anexoForm, tipo: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="aditivo">Aditivo</SelectItem>
                  <SelectItem value="medicao">Medição</SelectItem>
                  <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogAnexo(false)} className="border-gray-700 text-gray-400">
                Cancelar
              </Button>
              <Button type="submit" disabled={createAnexoMutation.isPending} className="bg-amber-500 hover:bg-amber-600 text-gray-900">
                Adicionar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}