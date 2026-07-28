import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

export default function ClienteForm({ cliente, onSave, onCancel, isLoading }) {
  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    cnpj_cpf: cliente?.cnpj_cpf || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    endereco: cliente?.endereco || '',
    bairro: cliente?.bairro || '',
    cep: cliente?.cep || '',
    cidade: cliente?.cidade || '',
    estado: cliente?.estado || '',
    observacoes: cliente?.observacoes || '',
    status: cliente?.status || 'ativo',
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const soDigitos = (v) => String(v || '').replace(/\D/g, '');

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Nome é obrigatório';

    // Campos opcionais, mas se preenchidos têm de estar completos — cadastro
    // pela metade vira cobrança/NF com dado inválido lá na frente.
    const doc = soDigitos(form.cnpj_cpf);
    if (doc && doc.length !== 11 && doc.length !== 14) e.cnpj_cpf = 'CPF (11 dígitos) ou CNPJ (14 dígitos)';

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido';

    const tel = soDigitos(form.telefone);
    if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone incompleto';

    const cep = soDigitos(form.cep);
    if (cep && cep.length !== 8) e.cep = 'CEP deve ter 8 dígitos';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    setSaving(true);
    try {
      if (cliente?.id) {
        await base44.entities.Cliente.update(cliente.id, form);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await base44.entities.Cliente.create(form);
        toast.success('Cliente criado com sucesso!');
      }
      onSave();
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome *</Label>
        <Input
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
          placeholder="Nome do cliente"
          disabled={saving || isLoading}
          className={errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}
        />
        {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>CNPJ/CPF</Label>
          <Input
            mask="cpfcnpj"
            value={form.cnpj_cpf}
            onChange={(e) => set('cnpj_cpf', e.target.value)}
            placeholder="CPF ou CNPJ"
            disabled={saving || isLoading}
            className={errors.cnpj_cpf ? 'border-red-400 focus-visible:ring-red-400' : ''}
          />
          {errors.cnpj_cpf && <p className="text-xs text-red-500 mt-1">{errors.cnpj_cpf}</p>}
        </div>
        <div>
          <Label>Telefone</Label>
          <Input
            mask="telefone"
            value={form.telefone}
            onChange={(e) => set('telefone', e.target.value)}
            placeholder="(00) 00000-0000"
            disabled={saving || isLoading}
            className={errors.telefone ? 'border-red-400 focus-visible:ring-red-400' : ''}
          />
          {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
        </div>
      </div>

      <div>
        <Label>E-mail</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="contato@exemplo.com"
          disabled={saving || isLoading}
          className={errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>

      <div>
        <Label>Logradouro</Label>
        <Input
          value={form.endereco}
          onChange={(e) => set('endereco', e.target.value)}
          placeholder="Rua, avenida, etc."
          disabled={saving || isLoading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label>Bairro</Label>
          <Input
            value={form.bairro || ''}
            onChange={(e) => set('bairro', e.target.value)}
            placeholder="Centro, Vila Maria, etc."
            disabled={saving || isLoading}
          />
        </div>
        <div>
          <Label>CEP</Label>
          <Input
            mask="cep"
            value={form.cep || ''}
            onChange={(e) => set('cep', e.target.value)}
            placeholder="00000-000"
            disabled={saving || isLoading}
            className={errors.cep ? 'border-red-400 focus-visible:ring-red-400' : ''}
          />
          {errors.cep && <p className="text-xs text-red-500 mt-1">{errors.cep}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Cidade</Label>
          <Input
            value={form.cidade}
            onChange={(e) => set('cidade', e.target.value)}
            placeholder="São Paulo"
            disabled={saving || isLoading}
          />
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={form.estado} onValueChange={(v) => set('estado', v)} disabled={saving || isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar UF" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map(uf => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => set('status', v)} disabled={saving || isLoading}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea
          value={form.observacoes}
          onChange={(e) => set('observacoes', e.target.value)}
          placeholder="Adicione observações sobre o cliente..."
          rows={3}
          disabled={saving || isLoading}
        />
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" disabled={saving || isLoading} className="flex-1">
          {saving ? 'Salvando...' : cliente?.id ? 'Atualizar' : 'Criar Cliente'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving || isLoading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}