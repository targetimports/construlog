import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const RECURSOS = [
  { id: 'obras', label: 'Obras' },
  { id: 'orcamentos', label: 'Orçamentos' },
  { id: 'medicoes', label: 'Medições' },
  { id: 'compras', label: 'Compras' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'colaboradores', label: 'Colaboradores' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'configuracoes', label: 'Configurações' }
];

const ACOES = ['criar', 'ler', 'editar', 'deletar', 'aprovar'];

export default function PerfilForm({ perfil, onClose }) {
  const { empresaId } = useEmpresa();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(perfil || {
    nome: '',
    descricao: '',
    nivel_acesso: 'user',
    permissoes: [],
    pode_compartilhar: false,
    pode_auditar: false
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, empresa_id: empresaId };
      if (perfil?.id) {
        return base44.entities.Perfil.update(perfil.id, payload);
      }
      return base44.entities.Perfil.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis'] });
      onClose();
    }
  });

  const toggleRecurso = (recursoId) => {
    const permissoes = [...(formData.permissoes || [])];
    const idx = permissoes.findIndex(p => p.recurso === recursoId);
    
    if (idx >= 0) {
      permissoes.splice(idx, 1);
    } else {
      permissoes.push({ recurso: recursoId, acoes: ['ler'] });
    }
    
    setFormData({ ...formData, permissoes });
  };

  const toggleAcao = (recursoId, acao) => {
    const permissoes = formData.permissoes.map(p => {
      if (p.recurso !== recursoId) return p;
      
      const acoes = p.acoes || [];
      const idx = acoes.indexOf(acao);
      
      if (idx >= 0) {
        acoes.splice(idx, 1);
      } else {
        acoes.push(acao);
      }
      
      return { ...p, acoes };
    });
    
    setFormData({ ...formData, permissoes });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Nome do Perfil</Label>
        <Input
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Ex: Gerente de Obra"
        />
      </div>

      <div>
        <Label>Descrição</Label>
        <Input
          value={formData.descricao || ''}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          placeholder="Descrição do perfil"
        />
      </div>

      <div>
        <Label>Nível de Acesso</Label>
        <Select value={formData.nivel_acesso} onValueChange={(nivel) => setFormData({ ...formData, nivel_acesso: nivel })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="gerente">Gerente</SelectItem>
            <SelectItem value="tecnico">Técnico</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
            <SelectItem value="visualizador">Visualizador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Permissões */}
      <div className="border-t pt-4">
        <h4 className="font-semibold mb-4">Permissões por Recurso</h4>
        <div className="space-y-4">
          {RECURSOS.map((recurso) => {
            const permissao = formData.permissoes?.find(p => p.recurso === recurso.id);
            return (
              <div key={recurso.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    checked={!!permissao}
                    onCheckedChange={() => toggleRecurso(recurso.id)}
                    id={`recurso-${recurso.id}`}
                  />
                  <label htmlFor={`recurso-${recurso.id}`} className="font-medium cursor-pointer">
                    {recurso.label}
                  </label>
                </div>

                {permissao && (
                  <div className="grid grid-cols-2 gap-2 pl-7">
                    {ACOES.map((acao) => (
                      <div key={acao} className="flex items-center gap-2">
                        <Checkbox
                          checked={permissao.acoes?.includes(acao) || false}
                          onCheckedChange={() => toggleAcao(recurso.id, acao)}
                          id={`acao-${recurso.id}-${acao}`}
                        />
                        <label htmlFor={`acao-${recurso.id}-${acao}`} className="text-sm capitalize cursor-pointer">
                          {acao}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Opções avançadas */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={formData.pode_compartilhar || false}
            onCheckedChange={(checked) => setFormData({ ...formData, pode_compartilhar: checked })}
            id="pode-compartilhar"
          />
          <label htmlFor="pode-compartilhar" className="text-sm cursor-pointer">
            Pode compartilhar dados com outros usuários
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={formData.pode_auditar || false}
            onCheckedChange={(checked) => setFormData({ ...formData, pode_auditar: checked })}
            id="pode-auditar"
          />
          <label htmlFor="pode-auditar" className="text-sm cursor-pointer">
            Pode acessar logs de auditoria
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate(formData)}
          disabled={mutation.isPending || !formData.nome}
        >
          {mutation.isPending ? 'Salvando...' : 'Salvar Perfil'}
        </Button>
      </div>
    </div>
  );
}