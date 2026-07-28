import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, FileText, X, User, Building2 } from 'lucide-react';

export default function NovoClienteModal({ open, onClose, onClienteCriado }) {
  const [form, setForm] = useState({
    nome: '',
    tipo_documento: 'cnpj',
    cnpj_cpf: '',
    email: '',
    telefone: '',
    cidade: '',
    estado: '',
    observacoes: '',
  });
  const [documentos, setDocumentos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setDocumentos(prev => [...prev, { nome: file.name, url: file_url }]);
      }
      toast.success('Documento(s) enviado(s)!');
    } catch (err) {
      toast.error('Erro ao enviar documento: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDoc = (idx) => {
    setDocumentos(prev => prev.filter((_, i) => i !== idx));
  };

  const soDigitos = (s) => String(s || '').replace(/\D/g, '');

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      // Verificação por DOCUMENTO: se já existe um cliente com o mesmo CNPJ/CPF,
      // vincula ao existente em vez de criar um duplicado.
      const docDigitos = soDigitos(form.cnpj_cpf);
      if (docDigitos.length >= 11) {
        const existentes = await base44.entities.Cliente.list().catch(() => []);
        const jaExiste = (existentes || []).find((c) => soDigitos(c.cnpj_cpf) === docDigitos);
        if (jaExiste) {
          toast.info(`Cliente já cadastrado com este documento: ${jaExiste.nome}. Vinculando ao existente.`);
          onClienteCriado(jaExiste);
          handleClose();
          return;
        }
      }

      const novoCliente = await base44.entities.Cliente.create({
        nome: form.nome,
        cnpj_cpf: form.cnpj_cpf || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        cidade: form.cidade || undefined,
        estado: form.estado || undefined,
        observacoes: form.observacoes || undefined,
        documentos: documentos.length > 0 ? documentos : undefined,
        status: 'ativo',
      });
      toast.success('Cliente criado com sucesso!');
      onClienteCriado(novoCliente);
      handleClose();
    } catch (err) {
      toast.error('Erro ao criar cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm({ nome: '', tipo_documento: 'cnpj', cnpj_cpf: '', email: '', telefone: '', cidade: '', estado: '', observacoes: '' });
    setDocumentos([]);
    onClose();
  };

  const maskDoc = (value, tipo) => {
    const nums = value.replace(/\D/g, '');
    if (tipo === 'cpf') {
      return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
    }
    return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').slice(0, 18);
  };

  const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Novo Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <Label>Nome do Cliente *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo ou razão social"
              autoFocus
            />
          </div>

          {/* Tipo de documento + número */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo_documento} onValueChange={(v) => setForm({ ...form, tipo_documento: v, cnpj_cpf: '' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cnpj">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> CNPJ</span>
                  </SelectItem>
                  <SelectItem value="cpf">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> CPF</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>{form.tipo_documento === 'cnpj' ? 'CNPJ' : 'CPF'}</Label>
              <Input
                mask="cpfcnpj"
                value={form.cnpj_cpf}
                onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })}
                placeholder={form.tipo_documento === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                maxLength={form.tipo_documento === 'cnpj' ? 18 : 14}
              />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                mask="telefone"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {/* Localização */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                placeholder="São Paulo"
              />
            </div>
            <div>
              <Label>UF</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o cliente..."
              rows={2}
            />
          </div>

          {/* Documentação */}
          <div>
            <Label>Documentação</Label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-2">Arraste ou clique para enviar documentos</p>
              <label className="cursor-pointer">
                <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md font-medium hover:bg-blue-100 transition">
                  {uploading ? 'Enviando...' : 'Selecionar arquivos'}
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {documentos.length > 0 && (
              <div className="mt-2 space-y-1">
                {documentos.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border">
                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex-1 truncate">
                      {doc.nome}
                    </a>
                    <button onClick={() => handleRemoveDoc(idx)} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-2 border-t">
            <Button onClick={handleSalvar} disabled={saving || uploading} className="flex-1">
              {saving ? 'Criando...' : 'Criar Cliente'}
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}