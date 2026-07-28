import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function PermissoesModalRBACv2({ open, onClose, user }) {
  const [rolePermissions, setRolePermissions] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [overrideEnabled, setOverrideEnabled] = useState(user?.permissionsOverrideEnabled || false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(user?.perfil_acesso || user?.perfil_sistema || 'campo');

  useEffect(() => {
    if (open && user) {
      loadRolePermissions();
      loadOverrides();
    }
  }, [open, user, role]);

  const loadRolePermissions = async () => {
    try {
      const perms = await base44.entities.RolePermission.filter({ role });
      const grouped = {};
      perms.forEach(p => {
        if (!grouped[p.group || 'Geral']) {
          grouped[p.group || 'Geral'] = [];
        }
        grouped[p.group || 'Geral'].push(p);
      });
      setRolePermissions(grouped);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const loadOverrides = async () => {
    try {
      const ovr = await base44.entities.UserPermissionOverride.filter({
        user_id: user.email
      });
      const ovrMap = {};
      ovr.forEach(o => {
        ovrMap[o.menu_id] = o.allowed;
      });
      setOverrides(ovrMap);
    } catch (error) {
      console.error('Erro ao carregar overrides:', error);
    }
  };

  const getMenuStatus = (menuId) => {
    // Se override habilitado, verificar overrides
    if (overrideEnabled) {
      if (menuId in overrides) {
        return overrides[menuId];
      }
    }
    // Caso contrário, retornar permissão padrão do role
    for (const group of Object.values(rolePermissions)) {
      const perm = group.find(p => p.menu_id === menuId);
      if (perm) {
        return perm.allowed;
      }
    }
    return false;
  };

  const handleCheckChange = async (menuId, checked) => {
    if (!overrideEnabled) return; // Não permitir se override desabilitado

    const newOverrides = { ...overrides };
    
    // Verificar permissão padrão
    let defaultAllowed = false;
    for (const group of Object.values(rolePermissions)) {
      const perm = group.find(p => p.menu_id === menuId);
      if (perm) {
        defaultAllowed = perm.allowed;
        break;
      }
    }

    // Se voltou ao padrão, remover override
    if (checked === defaultAllowed) {
      delete newOverrides[menuId];
      // Deletar do banco se existe
      const existing = await base44.entities.UserPermissionOverride.filter({
        user_id: user.email,
        menu_id: menuId
      });
      if (existing.length > 0) {
        await base44.entities.UserPermissionOverride.delete(existing[0].id);
      }
    } else {
      // Criar/atualizar override
      newOverrides[menuId] = checked;
      const existing = await base44.entities.UserPermissionOverride.filter({
        user_id: user.email,
        menu_id: menuId
      });
      if (existing.length > 0) {
        await base44.entities.UserPermissionOverride.update(existing[0].id, {
          allowed: checked
        });
      } else {
        await base44.entities.UserPermissionOverride.create({
          user_id: user.email,
          menu_id: menuId,
          allowed: checked,
          reason: 'Custom override'
        });
      }
    }

    setOverrides(newOverrides);
  };

  const handleResetToDefault = async () => {
    try {
      setLoading(true);
      // Deletar todos os overrides
      const existing = await base44.entities.UserPermissionOverride.filter({
        user_id: user.email
      });
      for (const override of existing) {
        await base44.entities.UserPermissionOverride.delete(override.id);
      }
      setOverrides({});
      setOverrideEnabled(false);
    } catch (error) {
      console.error('Erro ao resetar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverrideToggle = async () => {
    try {
      setLoading(true);
      // Salvar override_enabled no usuário
      // Nota: você precisará ter um backend que atualize isso
      // await base44.users.updateMe({ permissionsOverrideEnabled: overrideEnabled });
      console.log('Override enabled:', overrideEnabled);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões - {user?.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Rol Atual */}
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <p className="text-sm font-semibold">Perfil: <span className="text-blue-700">{role}</span></p>
            <p className="text-xs text-gray-600 mt-1">
              {overrideEnabled ? 'Personalizações habilitadas' : 'Herdando 100% do perfil'}
            </p>
          </div>

          {/* Toggle Override */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="override-toggle"
              checked={overrideEnabled}
              onCheckedChange={(checked) => {
                setOverrideEnabled(checked);
                handleSaveOverrideToggle();
              }}
              disabled={loading}
            />
            <Label htmlFor="override-toggle" className="text-sm font-medium cursor-pointer">
              Personalizar permissões (override)
            </Label>
          </div>

          {/* Aviso se override OFF */}
          {!overrideEnabled && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                As permissões estão em modo padrão. O usuário herda 100% do perfil "{role}".
                Marque "Personalizar permissões" para fazer alterações manuais.
              </AlertDescription>
            </Alert>
          )}

          {/* Checklist de Permissões */}
          <div className="space-y-4">
            {Object.entries(rolePermissions).map(([group, perms]) => (
              <div key={group}>
                <h3 className="font-semibold text-sm mb-3 text-gray-700">{group}</h3>
                <div className="space-y-2 ml-2">
                  {perms.map(perm => (
                    <div key={perm.menu_id} className="flex items-center gap-3">
                      <Checkbox
                        id={perm.menu_id}
                        checked={getMenuStatus(perm.menu_id)}
                        onCheckedChange={(checked) => handleCheckChange(perm.menu_id, checked)}
                        disabled={!overrideEnabled || loading}
                      />
                      <Label
                        htmlFor={perm.menu_id}
                        className={`text-sm cursor-pointer ${!overrideEnabled ? 'text-gray-500' : ''}`}
                      >
                        {perm.menu_label}
                        {!overrideEnabled && <span className="text-xs text-gray-400 ml-2">(padrão)</span>}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Botão Reset */}
          {overrideEnabled && Object.keys(overrides).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              disabled={loading}
              className="w-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Resetar para padrão do perfil
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={onClose}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}