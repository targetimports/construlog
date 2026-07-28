import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Shield, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function ControleAcessoObras() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [novaPermissao, setNovaPermissao] = useState({
    usuario_email: '',
    obra_id: '',
    nivel_acesso: 'visualizacao',
    pode_criar_medicao: false,
    pode_aprovar_medicao: false,
    pode_gerenciar_equipe: false,
    pode_movimentar_estoque: false,
    pode_solicitar_compra: false
  });
  const queryClient = useQueryClient();

  const { data: permissoes = [] } = useQuery({
    queryKey: ['permissoes-obra'],
    queryFn: () => base44.entities.PermissaoObra.list('-created_date', 200)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.PermissaoObra.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['permissoes-obra']);
      toast.success('Permissão criada!');
      setDialogAberto(false);
      setNovaPermissao({
        usuario_email: '',
        obra_id: '',
        nivel_acesso: 'visualizacao',
        pode_criar_medicao: false,
        pode_aprovar_medicao: false,
        pode_gerenciar_equipe: false,
        pode_movimentar_estoque: false,
        pode_solicitar_compra: false
      });
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.PermissaoObra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['permissoes-obra']);
      toast.success('Permissão removida!');
    }
  });

  const permissoesFiltradas = permissoes.filter(p =>
    p.usuario_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obras.find(o => o.id === p.obra_id)?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const nivelConfig = {
    visualizacao: { label: 'Visualização', color: 'bg-slate-600' },
    edicao: { label: 'Edição', color: 'bg-blue-600' },
    gerente: { label: 'Gerente', color: 'bg-purple-600' },
    total: { label: 'Total', color: 'bg-emerald-600' }
  };

  return (
    <div className="space-y-6 bg-[var(--bg)] min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Controle de Acesso às Obras</h1>
          <p className="text-[var(--muted)] mt-1">Gerencie permissões de usuários por obra</p>
        </div>
        <Button 
          onClick={() => setDialogAberto(true)}
          className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl px-4 py-2.5 gap-2 shadow-sm focus:outline-none focus:ring-3 focus:ring-[var(--primary)]/35"
        >
          <UserPlus className="w-4 h-4" />
          Nova Permissão
        </Button>
      </div>

      <Card className="bg-[var(--surface-2)] border-[var(--border)] rounded-[14px] shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--text)] text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <Input
              placeholder="Buscar por usuário ou obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-3 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {permissoesFiltradas.map(perm => {
          const obra = obras.find(o => o.id === perm.obra_id);
          const nivel = nivelConfig[perm.nivel_acesso];

          return (
            <Card key={perm.id} className="bg-[var(--surface)] border-[var(--border)] rounded-[14px] shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="w-5 h-5 text-[var(--primary)]" />
                      <h3 className="text-lg font-semibold text-[var(--text)]">{perm.usuario_email}</h3>
                      <span className="bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20 rounded-full px-3 py-1 text-xs font-bold">
                        {nivel.label}
                      </span>
                    </div>
                    <p className="text-[var(--muted)] mb-3">{obra?.nome || 'Obra não encontrada'}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {perm.pode_criar_medicao && (
                        <span className="bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/25 rounded-full px-3 py-1 text-xs font-medium">
                          Criar Medição
                        </span>
                      )}
                      {perm.pode_aprovar_medicao && (
                        <span className="bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/25 rounded-full px-3 py-1 text-xs font-medium">
                          Aprovar Medição
                        </span>
                      )}
                      {perm.pode_gerenciar_equipe && (
                        <span className="bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/25 rounded-full px-3 py-1 text-xs font-medium">
                          Gerenciar Equipe
                        </span>
                      )}
                      {perm.pode_movimentar_estoque && (
                        <span className="bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/25 rounded-full px-3 py-1 text-xs font-medium">
                          Movimentar Estoque
                        </span>
                      )}
                      {perm.pode_solicitar_compra && (
                        <span className="bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/25 rounded-full px-3 py-1 text-xs font-medium">
                          Solicitar Compra
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deletarMutation.mutate(perm.id)}
                    className="bg-[var(--danger-soft)] text-[var(--danger)] border border-red-300 rounded-[10px] hover:bg-red-200 focus:outline-none focus:ring-3 focus:ring-[var(--danger)]/25"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-[var(--surface)] border-[var(--border)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">Nova Permissão</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-[var(--muted)] mb-2 block text-sm">Usuário</Label>
              <Select
                value={novaPermissao.usuario_email}
                onValueChange={(v) => setNovaPermissao({ ...novaPermissao, usuario_email: v })}
              >
                <SelectTrigger className="bg-white border-[var(--border)] text-[var(--text)]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map(u => (
                    <SelectItem key={u.email} value={u.email}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[var(--muted)] mb-2 block text-sm">Obra</Label>
              <Select
                value={novaPermissao.obra_id}
                onValueChange={(v) => setNovaPermissao({ ...novaPermissao, obra_id: v })}
              >
                <SelectTrigger className="bg-white border-[var(--border)] text-[var(--text)]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[var(--muted)] mb-2 block text-sm">Nível de Acesso</Label>
              <Select
                value={novaPermissao.nivel_acesso}
                onValueChange={(v) => setNovaPermissao({ ...novaPermissao, nivel_acesso: v })}
              >
                <SelectTrigger className="bg-white border-[var(--border)] text-[var(--text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(nivelConfig).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--border)]">
              <Label className="text-[var(--text)] font-medium">Permissões Específicas</Label>
              
              {[
                { key: 'pode_criar_medicao', label: 'Criar Medição' },
                { key: 'pode_aprovar_medicao', label: 'Aprovar Medição' },
                { key: 'pode_gerenciar_equipe', label: 'Gerenciar Equipe' },
                { key: 'pode_movimentar_estoque', label: 'Movimentar Estoque' },
                { key: 'pode_solicitar_compra', label: 'Solicitar Compra' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between bg-[var(--surface-2)] p-3 rounded-lg border border-[var(--border)]">
                  <Label className="text-[var(--text)]">{label}</Label>
                  <Switch
                    checked={novaPermissao[key]}
                    onCheckedChange={(v) => setNovaPermissao({ ...novaPermissao, [key]: v })}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogAberto(false)}
                className="flex-1 border-[var(--border)] text-[var(--muted)]"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => criarMutation.mutate(novaPermissao)}
                disabled={!novaPermissao.usuario_email || !novaPermissao.obra_id}
                className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white focus:outline-none focus:ring-3 focus:ring-[var(--primary)]/35"
              >
                Criar Permissão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}