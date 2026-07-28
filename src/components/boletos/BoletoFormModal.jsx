import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { maskLinhaDigitavel } from '@/lib/masks';

export default function BoletoFormModal({ open, onClose, boleto, onSuccess }) {
  const queryClient = useQueryClient();
  const isEdit = !!boleto;
  const isPago = boleto?.status === 'PAGO';

  const [form, setForm] = useState({
    fornecedor_id: '', fornecedor_nome: '', obra_id: '', obra_nome: '',
    descricao: '', valor: '', data_emissao: '', data_vencimento: '',
    linha_digitavel: '', codigo_barras: '', status: 'ABERTO',
    forma_pagamento: 'boleto', responsavel_user_id: '', responsavel_nome: '',
    recorrente: false, observacoes: '', anexo_boleto_url: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (boleto) {
      setForm({
        fornecedor_id: boleto.fornecedor_id || '',
        fornecedor_nome: boleto.fornecedor_nome || '',
        obra_id: boleto.obra_id || '',
        obra_nome: boleto.obra_nome || '',
        descricao: boleto.descricao || '',
        valor: boleto.valor || '',
        data_emissao: boleto.data_emissao || '',
        data_vencimento: boleto.data_vencimento || '',
        linha_digitavel: boleto.linha_digitavel || '',
        codigo_barras: boleto.codigo_barras || '',
        status: boleto.status || 'ABERTO',
        forma_pagamento: boleto.forma_pagamento || 'boleto',
        responsavel_user_id: boleto.responsavel_user_id || '',
        responsavel_nome: boleto.responsavel_nome || '',
        recorrente: boleto.recorrente || false,
        observacoes: boleto.observacoes || '',
        anexo_boleto_url: boleto.anexo_boleto_url || ''
      });
    } else {
      setForm({
        fornecedor_id: '', fornecedor_nome: '', obra_id: '', obra_nome: '',
        descricao: '', valor: '', data_emissao: '', data_vencimento: '',
        linha_digitavel: '', codigo_barras: '', status: 'ABERTO',
        forma_pagamento: 'boleto', responsavel_user_id: '', responsavel_nome: '',
        recorrente: false, observacoes: '', anexo_boleto_url: ''
      });
    }
  }, [boleto, open]);

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores-boleto'],
    queryFn: () => base44.entities.Fornecedor.list(),
    enabled: open
  });

  const { data: obras } = useQuery({
    queryKey: ['obras-boleto'],
    queryFn: () => base44.entities.Obra.list(),
    enabled: open
  });

  const { data: users } = useQuery({
    queryKey: ['users-boleto'],
    queryFn: () => base44.entities.User.list(),
    enabled: open
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Boleto É uma Conta a Pagar (ContaFinanceira) com forma_pagamento 'boleto'.
      // Assim aparece na lista principal de Contas a Pagar e é pago pelo fluxo
      // normal (que baixa caixa + verba). Sem modelo paralelo.
      const payload = {
        tipo: 'pagar',
        forma_pagamento: 'boleto',
        categoria: form.categoria || 'Boleto',
        descricao: form.descricao || '',
        valor: parseFloat(form.valor) || 0,
        data_emissao: form.data_emissao || null,
        data_vencimento: form.data_vencimento || null,
        fornecedor_id: form.fornecedor_id || null,
        fornecedor_cliente: form.fornecedor_nome || null,
        obra_id: form.obra_id || null,
        obra_nome: form.obra_nome || '',
        // Campos específicos do boleto (guardados na própria conta).
        codigo_barras: form.codigo_barras || null,
        linha_digitavel: form.linha_digitavel || null,
        anexo_boleto_url: form.anexo_boleto_url || null,
        responsavel_user_id: form.responsavel_user_id || null,
        responsavel_nome: form.responsavel_nome || null,
      };
      if (isEdit) {
        return base44.entities.ContaFinanceira.update(boleto.id, payload);
      }
      return base44.entities.ContaFinanceira.create({ ...payload, status: 'pendente' });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Boleto atualizado' : 'Boleto lançado em Contas a Pagar');
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['boletos-pagar'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message)
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, anexo_boleto_url: file_url }));
    toast.success('Arquivo anexado. Extraindo dados com IA...');

    // Auto-preencher via IA
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise este boleto/documento de cobrança e extraia os dados. Se não encontrar algum campo, retorne string vazia. Retorne APENAS o JSON.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            descricao: { type: "string", description: "Descrição ou beneficiário do boleto" },
            valor: { type: "number", description: "Valor do boleto em reais (ex: 1500.50)" },
            data_vencimento: { type: "string", description: "Data de vencimento no formato YYYY-MM-DD" },
            data_emissao: { type: "string", description: "Data de emissão no formato YYYY-MM-DD" },
            linha_digitavel: { type: "string", description: "Linha digitável do boleto" },
            codigo_barras: { type: "string", description: "Código de barras do boleto" },
            fornecedor_nome: { type: "string", description: "Nome do cedente/beneficiário/fornecedor" }
          }
        }
      });

      if (result) {
        setForm(f => ({
          ...f,
          descricao: result.descricao && !f.descricao ? result.descricao : f.descricao,
          valor: result.valor && !f.valor ? result.valor : f.valor,
          data_vencimento: result.data_vencimento && !f.data_vencimento ? result.data_vencimento : f.data_vencimento,
          data_emissao: result.data_emissao && !f.data_emissao ? result.data_emissao : f.data_emissao,
          linha_digitavel: result.linha_digitavel && !f.linha_digitavel ? maskLinhaDigitavel(result.linha_digitavel) : f.linha_digitavel,
          codigo_barras: result.codigo_barras && !f.codigo_barras ? result.codigo_barras : f.codigo_barras,
          fornecedor_nome: result.fornecedor_nome && !f.fornecedor_nome ? result.fornecedor_nome : f.fornecedor_nome
        }));
        toast.success('Dados extraídos com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao extrair dados do boleto:', err);
      toast.error('Não foi possível extrair dados automaticamente');
    }

    setUploading(false);
  };

  const handleFornecedorChange = (id) => {
    if (id === '__none__') {
      setForm(prev => ({ ...prev, fornecedor_id: '', fornecedor_nome: '' }));
      return;
    }
    const f = fornecedores?.find(x => x.id === id);
    setForm(prev => ({ ...prev, fornecedor_id: id, fornecedor_nome: f?.razao_social || f?.nome || '' }));
  };

  const handleObraChange = (id) => {
    const o = obras?.find(x => x.id === id);
    setForm(prev => ({ ...prev, obra_id: id, obra_nome: o?.nome || '' }));
  };

  const handleResponsavelChange = (id) => {
    const u = users?.find(x => x.id === id);
    setForm(prev => ({ ...prev, responsavel_user_id: id, responsavel_nome: u?.full_name || u?.email || '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Boleto' : 'Novo Boleto a Pagar'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Descrição *</Label>
            <Input className="h-11" value={form.descricao} onChange={e => setForm(f => ({...f, descricao: e.target.value}))} disabled={isPago} />
          </div>
          <div>
            <Label className="mb-1 block">Fornecedor</Label>
            <ComboboxBusca
              options={[{ value: '__none__', label: 'Sem fornecedor' }, ...(fornecedores || []).map(f => ({ value: f.id, label: f.razao_social || f.nome }))]}
              value={form.fornecedor_id || ''}
              onSelect={handleFornecedorChange}
              placeholder="Selecione"
              searchPlaceholder="Buscar fornecedor..."
              emptyMessage="Nenhum fornecedor."
            />
          </div>
          <div>
            <Label className="mb-1 block">Obra</Label>
            <ComboboxBusca
              options={(obras || []).map(o => ({ value: o.id, label: o.nome }))}
              value={form.obra_id || ''}
              onSelect={handleObraChange}
              placeholder="Selecione"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra."
            />
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input className="h-11" type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} disabled={isPago} />
          </div>
          <div>
            <Label>Data Vencimento *</Label>
            <Input className="h-11" type="date" value={form.data_vencimento} onChange={e => setForm(f => ({...f, data_vencimento: e.target.value}))} disabled={isPago} />
          </div>
          <div>
            <Label>Data Emissão</Label>
            <Input className="h-11" type="date" value={form.data_emissao} onChange={e => setForm(f => ({...f, data_emissao: e.target.value}))} disabled={isPago} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))} disabled={isPago}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                <SelectItem value="ABERTO">Aberto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Forma Pagamento</Label>
            <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({...f, forma_pagamento: v}))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="debito_automatico">Débito Automático</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <ComboboxBusca
              options={(users || []).map(u => ({ value: u.id, label: u.full_name || u.email }))}
              value={form.responsavel_user_id || ''}
              onSelect={handleResponsavelChange}
              placeholder="Selecione"
              searchPlaceholder="Buscar responsável..."
              emptyMessage="Nenhum usuário."
            />
          </div>
          <div className="md:col-span-2">
            <Label>Linha Digitável</Label>
            <Input className="h-11" inputMode="numeric" value={form.linha_digitavel} onChange={e => setForm(f => ({...f, linha_digitavel: maskLinhaDigitavel(e.target.value)}))} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))} rows={2} />
          </div>
          <div className="md:col-span-2">
            <Label>Anexo PDF do Boleto</Label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm border">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Analisando com IA...' : 'Upload PDF / Word'}
                <input type="file" accept=".pdf,.jpg,.png,.doc,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              {form.anexo_boleto_url && (
                <a href={form.anexo_boleto_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">
                  Ver anexo
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.descricao || !form.valor || !form.data_vencimento}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar Boleto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}