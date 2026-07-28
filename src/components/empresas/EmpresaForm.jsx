import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EmpresaForm({ empresa, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(empresa || {
    nome: '',
    cnpj: '',
    razao_social: '',
    endereco: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    endereco_cep: '',
    telefone: '',
    email: '',
    ativa: true
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Calcular endereço completo
      const endereco_completo = [
        data.endereco_rua,
        data.endereco_numero,
        data.endereco_bairro,
        data.endereco_cidade,
        data.endereco_estado,
        data.endereco_cep
      ].filter(Boolean).length > 0
        ? `${data.endereco_rua || ''}, ${data.endereco_numero || ''} - ${data.endereco_bairro || ''} - ${data.endereco_cidade || ''}/${data.endereco_estado || ''} - ${data.endereco_cep || ''}`.trim()
        : '';

      const payload = { ...data, endereco_completo };

      if (empresa?.id) {
        return base44.entities.Empresa.update(empresa.id, payload);
      }
      return base44.entities.Empresa.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresa-ativa'] });
      onClose();
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Nome</Label>
        <Input
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Nome da empresa"
        />
      </div>

      <div>
        <Label>CNPJ</Label>
        <Input
          mask="cnpj"
          value={formData.cnpj}
          onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
          placeholder="00.000.000/0000-00"
        />
      </div>

      <div>
        <Label>Razão Social</Label>
        <Input
          value={formData.razao_social}
          onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
          placeholder="Razão social"
        />
      </div>

      <div>
        <Label>Email</Label>
        <Input
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="email@empresa.com"
        />
      </div>

      <div>
        <Label>Telefone</Label>
        <Input
          mask="telefone"
          value={formData.telefone}
          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
          placeholder="(00) 00000-0000"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Rua/Avenida</Label>
          <Input
            value={formData.endereco_rua}
            onChange={(e) => setFormData({ ...formData, endereco_rua: e.target.value })}
            placeholder="Rua"
          />
        </div>
        <div>
          <Label>Número</Label>
          <Input
            value={formData.endereco_numero}
            onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
            placeholder="123"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Bairro</Label>
          <Input
            value={formData.endereco_bairro}
            onChange={(e) => setFormData({ ...formData, endereco_bairro: e.target.value })}
            placeholder="Bairro"
          />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input
            value={formData.endereco_cidade}
            onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })}
            placeholder="Cidade"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Estado</Label>
          <Input
            value={formData.endereco_estado}
            onChange={(e) => setFormData({ ...formData, endereco_estado: e.target.value })}
            placeholder="UF"
            maxLength={2}
          />
        </div>
        <div>
          <Label>CEP</Label>
          <Input
            mask="cep"
            value={formData.endereco_cep}
            onChange={(e) => setFormData({ ...formData, endereco_cep: e.target.value })}
            placeholder="00000-000"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate(formData)}
          disabled={mutation.isPending || !formData.nome || !formData.cnpj}
        >
          {mutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}