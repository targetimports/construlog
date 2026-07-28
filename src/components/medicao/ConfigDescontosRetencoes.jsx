import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Save, AlertCircle } from 'lucide-react';

export default function ConfigDescontosRetencoes({ obra_id, contrato_versao_id }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState({});

  useEffect(() => {
    loadConfig();
  }, [obra_id, contrato_versao_id]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configs = await base44.entities.ConfiguracaoMedicao.filter({
        obra_id,
        ...(contrato_versao_id && { contrato_versao_id })
      });

      const existingConfig = configs?.[0];
      if (existingConfig) {
        setConfig(existingConfig);
      } else {
        setConfig({
          obra_id,
          contrato_versao_id: contrato_versao_id || null,
          percentual_retencao: 0,
          percentual_desconto: 0,
          tolerancia_percentual: 0,
          gerar_conta_receber_automaticamente: true,
          ativo: true
        });
      }
    } catch (error) {
      toast.error(`Erro ao carregar configuração: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setUnsavedChanges(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        await base44.entities.ConfiguracaoMedicao.update(config.id, unsavedChanges);
      } else {
        await base44.entities.ConfiguracaoMedicao.create(config);
      }
      toast.success('Configuração salva');
      setUnsavedChanges({});
      await loadConfig();
    } catch (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 bg-gray-100 rounded animate-pulse" />;
  }

  if (!config) {
    return <div className="text-center text-gray-500">Sem configuração</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Descontos, Retenções e Financeiro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Alertas */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Info:</strong> Estas configurações serão aplicadas automaticamente ao aprovar BMs desta obra.
          </div>
        </div>

        {/* Descontos e Retenções */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="desconto">Desconto (%)</Label>
            <Input
              id="desconto"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={config.percentual_desconto}
              onChange={(e) => handleChange('percentual_desconto', parseFloat(e.target.value) || 0)}
              className="text-sm"
            />
            <p className="text-xs text-gray-600">Aplicado sobre o valor bruto</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="retencao">Retenção (%)</Label>
            <Input
              id="retencao"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={config.percentual_retencao}
              onChange={(e) => handleChange('percentual_retencao', parseFloat(e.target.value) || 0)}
              className="text-sm"
            />
            <p className="text-xs text-gray-600">Aplicada após desconto</p>
          </div>
        </div>

        {/* Tolerância de medição */}
        <div className="space-y-2">
          <Label htmlFor="tolerancia">Tolerância de Medição (%)</Label>
          <Input
            id="tolerancia"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={config.tolerancia_percentual ?? 0}
            onChange={(e) => handleChange('tolerancia_percentual', parseFloat(e.target.value) || 0)}
            className="text-sm max-w-xs"
          />
          <p className="text-xs text-gray-600">Permite medir acima do contratado até este percentual por item (0 = bloqueia qualquer excesso).</p>
        </div>

        {/* Geração Automática */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Gerar ContaReceber Automaticamente</Label>
              <p className="text-xs text-gray-600">Ao aprovar BM, cria entrada de receita</p>
            </div>
            <Switch
              checked={config.gerar_conta_receber_automaticamente}
              onCheckedChange={(value) => handleChange('gerar_conta_receber_automaticamente', value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Ativo</Label>
              <p className="text-xs text-gray-600">Desativar para parar de aplicar desconto/retenção</p>
            </div>
            <Switch
              checked={config.ativo}
              onCheckedChange={(value) => handleChange('ativo', value)}
            />
          </div>
        </div>

        {/* Botão Salvar */}
        {Object.keys(unsavedChanges).length > 0 && (
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            Salvar Configuração
          </Button>
        )}
      </CardContent>
    </Card>
  );
}