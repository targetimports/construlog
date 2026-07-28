import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GarantiaSection({ garantia_tipo = 'anos', garantia_valor = 5, onChange }) {
  const handleTipoChange = (tipo) => {
    onChange({ tipo, valor: garantia_valor });
  };

  const handleValorChange = (e) => {
    const valor = Number(e.target.value) || 0;
    onChange({ tipo: garantia_tipo, valor });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Período de Garantia</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="garantia-tipo">Tipo de Garantia</Label>
            <Select value={garantia_tipo} onValueChange={handleTipoChange}>
              <SelectTrigger id="garantia-tipo" className="mt-2">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anos">Anos</SelectItem>
                <SelectItem value="meses">Meses</SelectItem>
                <SelectItem value="nenhuma">Sem Garantia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {garantia_tipo !== 'nenhuma' && (
            <div>
              <Label htmlFor="garantia-valor">Valor ({garantia_tipo === 'anos' ? 'anos' : 'meses'})</Label>
              <Input
                id="garantia-valor"
                type="number"
                min="1"
                value={garantia_valor}
                onChange={handleValorChange}
                className="mt-2"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}