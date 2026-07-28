import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const CONFIG_DEFAULT = {
  incluirMaoObra: true,
  incluirEquipamentos: true,
  incluirOcorrencias: true,
  incluirFotos: false,
  ordenarPor: 'data' // 'data' | 'obra'
};

export default function ConfiguracaoModeloRelatorio({ open, onClose }) {
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Carregar configuração (entidade ConfiguracaoSistema ou localStorage fallback)
  useEffect(() => {
    if (!open || !user?.email) return;

    const carregarConfig = async () => {
      try {
        // TENTAR: entidade ConfiguracaoSistema do sistema
        const configs = await base44.entities.ConfiguracaoSistema.filter({
          modulo: 'diario_obra',
          chave: 'modelo_relatorio',
          user_email: user.email
        });

        if (configs && configs.length > 0 && configs[0].valor) {
          setConfig(JSON.parse(configs[0].valor));
          return;
        }
      } catch (err) {
        console.warn('[CONFIG] Entidade ConfiguracaoSistema não disponível:', err.message);
      }

      // FALLBACK: localStorage com chave robusta
      const chaveLS = `app:diarioRelatorioConfig:${user.email}`;
      const configLS = localStorage.getItem(chaveLS);
      if (configLS) {
        try {
          setConfig(JSON.parse(configLS));
        } catch (err) {
          console.warn('[CONFIG] Erro ao parsear localStorage:', err);
        }
      }
    };

    carregarConfig();
  }, [open, user?.email]);

  const salvarMutation = useMutation({
    mutationFn: async (novaConfig) => {
      const valorJson = JSON.stringify(novaConfig);

      // TENTAR: salvar na entidade ConfiguracaoSistema
      try {
        const existentes = await base44.entities.ConfiguracaoSistema.filter({
          modulo: 'diario_obra',
          chave: 'modelo_relatorio',
          user_email: user.email
        });

        if (existentes && existentes.length > 0) {
          await base44.entities.ConfiguracaoSistema.update(existentes[0].id, { valor: valorJson });
        } else {
          await base44.entities.ConfiguracaoSistema.create({
            modulo: 'diario_obra',
            chave: 'modelo_relatorio',
            user_email: user.email,
            valor: valorJson,
            descricao: 'Configuração do modelo de relatório do Diário de Obra'
          });
        }
        return { tipo: 'entidade' };
      } catch (err) {
        console.warn('[CONFIG] Entidade não disponível, usando localStorage:', err.message);
        
        // FALLBACK: localStorage com chave robusta
        const chaveLS = `app:diarioRelatorioConfig:${user.email}`;
        localStorage.setItem(chaveLS, valorJson);
        return { tipo: 'localStorage' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['config-diario-relatorio'] });
      toast.success(
        result.tipo === 'entidade' 
          ? 'Configuração salva no sistema' 
          : 'Configuração salva localmente'
      );
      onClose?.();
    },
    onError: (err) => toast.error('Erro ao salvar: ' + err.message)
  });

  const handleSalvar = () => {
    salvarMutation.mutate(config);
  };

  const handleResetar = () => {
    setConfig(CONFIG_DEFAULT);
    toast.info('Configuração resetada para padrão');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurar Modelo de Relatório
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium mb-3">Seções a Incluir:</p>

              <div className="flex items-center justify-between">
                <label htmlFor="mao-obra" className="text-sm cursor-pointer">
                  Mão de Obra
                </label>
                <Switch
                  id="mao-obra"
                  checked={config.incluirMaoObra}
                  onCheckedChange={(checked) => setConfig({ ...config, incluirMaoObra: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="equipamentos" className="text-sm cursor-pointer">
                  Equipamentos
                </label>
                <Switch
                  id="equipamentos"
                  checked={config.incluirEquipamentos}
                  onCheckedChange={(checked) => setConfig({ ...config, incluirEquipamentos: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="ocorrencias" className="text-sm cursor-pointer">
                  Ocorrências
                </label>
                <Switch
                  id="ocorrencias"
                  checked={config.incluirOcorrencias}
                  onCheckedChange={(checked) => setConfig({ ...config, incluirOcorrencias: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="fotos" className="text-sm cursor-pointer">
                  Fotos (se disponíveis)
                </label>
                <Switch
                  id="fotos"
                  checked={config.incluirFotos}
                  onCheckedChange={(checked) => setConfig({ ...config, incluirFotos: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-3">Ordenação:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ordenacao"
                    checked={config.ordenarPor === 'data'}
                    onChange={() => setConfig({ ...config, ordenarPor: 'data' })}
                  />
                  <span className="text-sm">Por Data (mais recente primeiro)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ordenacao"
                    checked={config.ordenarPor === 'obra'}
                    onChange={() => setConfig({ ...config, ordenarPor: 'obra' })}
                  />
                  <span className="text-sm">Por Obra (agrupado)</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-500">
            Preferências salvas {user?.email ? 'no sistema' : 'localmente'} e persistem após refresh
          </p>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleResetar} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Resetar Padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvarMutation.isPending} className="gap-2">
              <Save className="w-4 h-4" />
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}