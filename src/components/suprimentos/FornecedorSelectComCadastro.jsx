import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function FornecedorSelectComCadastro({
  value,
  onChange,
  disabled = false,
  error = null,
  showLabel = true,
  label = 'Fornecedor *',
}) {
  const qc = useQueryClient();
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [novoCadastro, setNovoCadastro] = useState({
    razao_social: '',
    cnpj: '',
    contato_nome: '',
    contato_tel: '',
    contato_email: '',
  });

  // Lista os fornecedores. Tolera registros sem o campo `ativo` (dados antigos/seed
  // não o tinham) — só oculta os explicitamente inativados (ativo === false).
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-select'],
    queryFn: () => base44.entities.Fornecedor.list('razao_social', 2000).catch(() => []),
    select: (lista) => (lista || []).filter((f) => f.ativo !== false),
  });

  const options = useMemo(
    () => fornecedores.map((f) => ({
      value: f.id,
      label: f.cnpj ? `${f.razao_social} — ${f.cnpj}` : (f.razao_social || 'Fornecedor'),
    })),
    [fornecedores],
  );

  // Mutation: criar novo fornecedor
  const criarFornecedorMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.entities.Fornecedor.create({
        razao_social: data.razao_social.trim(),
        cnpj: data.cnpj?.trim() || null,
        contato_nome: data.contato_nome?.trim() || null,
        contato_tel: data.contato_tel?.trim() || null,
        contato_email: data.contato_email?.trim() || null,
        ativo: true,
      });
      return response;
    },
    onSuccess: (novoFornecedor) => {
      qc.invalidateQueries({ queryKey: ['fornecedores-select'] });
      // Selecionar automaticamente
      onChange(novoFornecedor.id);
      toast.success(`Fornecedor "${novoFornecedor.razao_social}" cadastrado e selecionado`);
      setCadastroOpen(false);
      setNovoCadastro({ razao_social: '', cnpj: '', contato_nome: '', contato_tel: '', contato_email: '' });
    },
    onError: (err) => {
      toast.error('Erro ao cadastrar fornecedor: ' + err.message);
    },
  });

  const handleCadastroSubmit = () => {
    if (!novoCadastro.razao_social.trim()) {
      toast.error('Razão social é obrigatória');
      return;
    }
    criarFornecedorMutation.mutate(novoCadastro);
  };

  return (
    <>
      <div>
        {showLabel && <Label>{label}</Label>}

        <div className="mt-1">
          <ComboboxBusca
            options={options}
            value={value || ''}
            onSelect={(v) => onChange(v || '')}
            placeholder="Buscar fornecedor..."
            searchPlaceholder="Buscar por nome ou CNPJ..."
            emptyMessage="Nenhum fornecedor encontrado."
            disabled={disabled}
            className={error ? 'border-red-400' : ''}
          />
        </div>

        <button
          type="button"
          onClick={() => setCadastroOpen(true)}
          disabled={disabled}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3 h-3" /> Cadastrar novo fornecedor
        </button>

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      {/* Modal de Cadastro Rápido */}
      <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Cadastro Rápido de Fornecedor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-sm">Razão Social / Nome *</Label>
              <Input
                placeholder="Ex: Empresa LTDA"
                value={novoCadastro.razao_social}
                onChange={e => setNovoCadastro(p => ({ ...p, razao_social: e.target.value }))}
                disabled={criarFornecedorMutation.isPending}
              />
            </div>

            <div>
              <Label className="text-sm">CNPJ (opcional)</Label>
              <Input
                mask="cnpj"
                placeholder="XX.XXX.XXX/0000-XX"
                value={novoCadastro.cnpj}
                onChange={e => setNovoCadastro(p => ({ ...p, cnpj: e.target.value }))}
                disabled={criarFornecedorMutation.isPending}
              />
            </div>

            <div>
              <Label className="text-sm">Contato (opcional)</Label>
              <Input
                placeholder="Nome do contato"
                value={novoCadastro.contato_nome}
                onChange={e => setNovoCadastro(p => ({ ...p, contato_nome: e.target.value }))}
                disabled={criarFornecedorMutation.isPending}
              />
            </div>

            <div>
              <Label className="text-sm">Telefone/WhatsApp (opcional)</Label>
              <Input
                mask="telefone"
                placeholder="(11) 98765-4321"
                value={novoCadastro.contato_tel}
                onChange={e => setNovoCadastro(p => ({ ...p, contato_tel: e.target.value }))}
                disabled={criarFornecedorMutation.isPending}
              />
            </div>

            <div>
              <Label className="text-sm">E-mail (opcional)</Label>
              <Input
                type="email"
                placeholder="contato@empresa.com"
                value={novoCadastro.contato_email}
                onChange={e => setNovoCadastro(p => ({ ...p, contato_email: e.target.value }))}
                disabled={criarFornecedorMutation.isPending}
              />
            </div>

            <div className="flex gap-2 pt-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={criarFornecedorMutation.isPending}
                onClick={handleCadastroSubmit}
              >
                {criarFornecedorMutation.isPending ? 'Cadastrando...' : 'Cadastrar e Selecionar'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={criarFornecedorMutation.isPending}
                onClick={() => setCadastroOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}