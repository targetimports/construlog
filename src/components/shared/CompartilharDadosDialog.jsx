import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Share2, Trash2 } from 'lucide-react';

export default function CompartilharDadosDialog({ 
  open, 
  onOpenChange, 
  entityName, 
  entityId,
  compartilhamentos = []
}) {
  const [emailUsuario, setEmailUsuario] = useState('');
  const [permissao, setPermissao] = useState('visualizar');
  const queryClient = useQueryClient();

  const compartilharMutation = useMutation({
    mutationFn: async () => {
      if (!emailUsuario) throw new Error('Email obrigatório');
      
      await base44.entities.CompartilhamentoDados.create({
        usuario_criador_email: (await base44.auth.me()).email,
        tipo_entidade: entityName,
        entidade_id: entityId,
        usuario_compartilhado_email: emailUsuario,
        permissao: permissao
      });

      setEmailUsuario('');
      setPermissao('visualizar');
      queryClient.invalidateQueries({ queryKey: ['compartilhamentos'] });
    }
  });

  const revogarMutation = useMutation({
    mutationFn: async (compartilhamentoId) => {
      await base44.entities.CompartilhamentoDados.update(compartilhamentoId, {
        revogado: true,
        data_revogacao: new Date().toISOString()
      });

      queryClient.invalidateQueries({ queryKey: ['compartilhamentos'] });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Compartilhar dados
          </DialogTitle>
          <DialogDescription>
            Conceda acesso a outros usuários
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Usuários com acesso */}
          {compartilhamentos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Acesso concedido a:</Label>
              <div className="space-y-2">
                {compartilhamentos.map((c) => (
                  <div 
                    key={c.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div>
                      <p className="font-medium">{c.usuario_compartilhado_email}</p>
                      <p className="text-xs text-gray-600 capitalize">{c.permissao}</p>
                    </div>
                    <button
                      onClick={() => revogarMutation.mutate(c.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="Revogar acesso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Novo compartilhamento */}
          <div className="border-t pt-4 space-y-3">
            <Label htmlFor="email" className="text-xs font-semibold">
              Compartilhar com novo usuário
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={emailUsuario}
              onChange={(e) => setEmailUsuario(e.target.value)}
            />

            <div>
              <Label htmlFor="permissao" className="text-xs font-semibold">
                Permissão
              </Label>
              <Select value={permissao} onValueChange={setPermissao}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visualizar">Apenas visualizar</SelectItem>
                  <SelectItem value="editar">Editar</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button 
            onClick={() => compartilharMutation.mutate()}
            disabled={!emailUsuario || compartilharMutation.isPending}
          >
            {compartilharMutation.isPending ? 'Compartilhando...' : 'Compartilhar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}