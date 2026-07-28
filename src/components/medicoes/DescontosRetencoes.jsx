import React, { useState } from 'react';
import { Plus, X, AlertTriangle, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const TIPOS_DESCONTO = [
  { value: 'adiantamento', label: 'Adiantamento de Pagamento' },
  { value: 'faturamento_direto', label: 'Faturamento Direto' },
  { value: 'compra_materiais', label: 'Compra de Materiais' }
];

const TIPOS_RETENCAO = [
  { value: 'retencao_tecnica', label: 'Retenção Técnica' },
  { value: 'inss', label: 'INSS' },
  { value: 'iss', label: 'ISS' },
  { value: 'csll', label: 'CSLL' },
  { value: 'ir', label: 'IR' },
  { value: 'cofins', label: 'COFINS' },
  { value: 'pis', label: 'PIS' }
];

const LIMITES = {
  retencao_tecnica: { min: 5, max: 30 },
  inss: { min: 0, max: 20 },
  iss: { min: 0, max: 15 },
  csll: { min: 0, max: 10 },
  ir: { min: 0, max: 27.5 },
  cofins: { min: 0, max: 10 },
  pis: { min: 0, max: 2.5 }
};

export default function DescontosRetencoes({ medicaoId, valorMedido, descontos = [], retencoes = [], onUpdate }) {
  const [openDesconto, setOpenDesconto] = useState(false);
  const [openRetencao, setOpenRetencao] = useState(false);
  const [formDesconto, setFormDesconto] = useState({ tipo: '', valor: 0, percentual: 0, observacoes: '' });
  const [formRetencao, setFormRetencao] = useState({ tipo: '', valor: 0, percentual: 0, observacoes: '' });

  const handleDescontoChange = (field, value) => {
    const updatedForm = { ...formDesconto, [field]: value };
    
    if (field === 'valor' && value > 0) {
      updatedForm.percentual = parseFloat((((value / valorMedido) * 100) || 0).toFixed(2));
    } else if (field === 'percentual' && value > 0) {
      updatedForm.valor = parseFloat(((valorMedido * (value / 100)) || 0).toFixed(2));
    }
    
    setFormDesconto(updatedForm);
  };

  const handleRetencaoChange = (field, value) => {
    const updatedForm = { ...formRetencao, [field]: value };
    
    if (field === 'tipo') {
      updatedForm.valor = 0;
      updatedForm.percentual = 0;
    }
    
    if (field === 'valor' && value > 0) {
      updatedForm.percentual = parseFloat((((value / valorMedido) * 100) || 0).toFixed(2));
    } else if (field === 'percentual' && value > 0) {
      updatedForm.valor = parseFloat(((valorMedido * (value / 100)) || 0).toFixed(2));
    }

    // Validar limites
    const tipo = updatedForm.tipo || formRetencao.tipo;
    const limites = LIMITES[tipo];
    if (limites && updatedForm.percentual > limites.max) {
      toast.error(`${tipo}: máximo ${limites.max}%`);
      updatedForm.percentual = limites.max;
      updatedForm.valor = parseFloat(((valorMedido * (limites.max / 100)) || 0).toFixed(2));
    }
    
    setFormRetencao(updatedForm);
  };

  const adicionarDesconto = () => {
    if (!formDesconto.tipo) {
      toast.error('Selecione um tipo de desconto');
      return;
    }
    if (formDesconto.valor <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    const totalDescontos = descontos.reduce((acc, d) => acc + d.valor, 0) + formDesconto.valor;
    if (totalDescontos > valorMedido * 0.5) {
      toast.warning('Descontos > 50% do valor medido. Verifique!');
    }

    const novoDesconto = {
      id: Date.now(),
      ...formDesconto,
      data_criacao: new Date().toISOString()
    };

    onUpdate([...descontos, novoDesconto], retencoes);
    setFormDesconto({ tipo: '', valor: 0, percentual: 0, observacoes: '' });
    setOpenDesconto(false);
    toast.success('Desconto adicionado');
  };

  const adicionarRetencao = () => {
    if (!formRetencao.tipo) {
      toast.error('Selecione um tipo de retenção');
      return;
    }
    if (formRetencao.valor <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    const limites = LIMITES[formRetencao.tipo];
    if (formRetencao.percentual > limites.max) {
      toast.error(`Máximo permitido para ${formRetencao.tipo}: ${limites.max}%`);
      return;
    }

    const novaRetencao = {
      id: Date.now(),
      ...formRetencao,
      data_criacao: new Date().toISOString()
    };

    onUpdate(descontos, [...retencoes, novaRetencao]);
    setFormRetencao({ tipo: '', valor: 0, percentual: 0, observacoes: '' });
    setOpenRetencao(false);
    toast.success('Retenção adicionada');
  };

  const removerDesconto = (id) => {
    onUpdate(descontos.filter(d => d.id !== id), retencoes);
  };

  const removerRetencao = (id) => {
    onUpdate(descontos, retencoes.filter(r => r.id !== id));
  };

  const totalDescontos = descontos.reduce((acc, d) => acc + d.valor, 0);
  const totalRetencoes = retencoes.reduce((acc, r) => acc + r.valor, 0);
  const valorLiquido = valorMedido - totalDescontos - totalRetencoes;
  const temRetencaoTecnica = retencoes.some(r => r.tipo === 'retencao_tecnica');

  return (
    <div className="space-y-6">
      {/* Descontos */}
      <Card className="border-blue-200">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-blue-900">Descontos</CardTitle>
            <Button onClick={() => setOpenDesconto(true)} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {descontos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum desconto adicionado</p>
          ) : (
            <div className="space-y-2">
              {descontos.map(desc => (
                <div key={desc.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{TIPOS_DESCONTO.find(t => t.value === desc.tipo)?.label}</p>
                    <p className="text-xs text-gray-600">{desc.observacoes}</p>
                  </div>
                  <div className="text-right mr-3">
                    <p className="font-semibold text-blue-600">R$ {desc.valor.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">{desc.percentual.toFixed(2)}%</p>
                  </div>
                  <button onClick={() => removerDesconto(desc.id)} className="p-1 hover:bg-red-100 rounded">
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-blue-200 font-semibold text-right">
                Total: R$ {totalDescontos.toFixed(2)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retenções */}
      <Card className="border-orange-200">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-orange-900">Retenções</CardTitle>
            <Button onClick={() => setOpenRetencao(true)} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {retencoes.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma retenção adicionada</p>
          ) : (
            <div className="space-y-2">
              {retencoes.map(ret => (
                <div key={ret.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{TIPOS_RETENCAO.find(t => t.value === ret.tipo)?.label}</p>
                      {ret.tipo === 'retencao_tecnica' && <Badge className="bg-red-500">2 Parcelas</Badge>}
                    </div>
                    <p className="text-xs text-gray-600">{ret.observacoes}</p>
                  </div>
                  <div className="text-right mr-3">
                    <p className="font-semibold text-orange-600">R$ {ret.valor.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">{ret.percentual.toFixed(2)}%</p>
                  </div>
                  <button onClick={() => removerRetencao(ret.id)} className="p-1 hover:bg-red-100 rounded">
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-orange-200 font-semibold text-right">
                Total: R$ {totalRetencoes.toFixed(2)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="py-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Valor Medido:</span>
            <span>R$ {valorMedido.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-blue-600">
            <span>(-) Descontos:</span>
            <span>R$ {totalDescontos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-orange-600">
            <span>(-) Retenções:</span>
            <span>R$ {totalRetencoes.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2 text-green-700">
            <span>= Valor Líquido:</span>
            <span>R$ {Math.max(0, valorLiquido).toFixed(2)}</span>
          </div>
          {temRetencaoTecnica && (
            <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-lg text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Retenção Técnica detectada: Faturamento será parcelado em 2x
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Desconto */}
      <Dialog open={openDesconto} onOpenChange={setOpenDesconto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Desconto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Desconto *</Label>
              <Select value={formDesconto.tipo} onValueChange={(v) => handleDescontoChange('tipo', v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DESCONTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={formDesconto.valor}
                  onChange={(e) => handleDescontoChange('valor', parseFloat(e.target.value) || 0)}
                  className="mt-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  value={formDesconto.percentual}
                  onChange={(e) => handleDescontoChange('percentual', parseFloat(e.target.value) || 0)}
                  className="mt-2"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input
                value={formDesconto.observacoes}
                onChange={(e) => setFormDesconto({...formDesconto, observacoes: e.target.value})}
                className="mt-2"
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDesconto(false)}>Cancelar</Button>
            <Button onClick={adicionarDesconto} className="bg-blue-600">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Retenção */}
      <Dialog open={openRetencao} onOpenChange={setOpenRetencao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Retenção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Retenção *</Label>
              <Select value={formRetencao.tipo} onValueChange={(v) => handleRetencaoChange('tipo', v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_RETENCAO.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} (até {LIMITES[t.value].max}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={formRetencao.valor}
                  onChange={(e) => handleRetencaoChange('valor', parseFloat(e.target.value) || 0)}
                  className="mt-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  value={formRetencao.percentual}
                  onChange={(e) => handleRetencaoChange('percentual', parseFloat(e.target.value) || 0)}
                  className="mt-2"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input
                value={formRetencao.observacoes}
                onChange={(e) => setFormRetencao({...formRetencao, observacoes: e.target.value})}
                className="mt-2"
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRetencao(false)}>Cancelar</Button>
            <Button onClick={adicionarRetencao} className="bg-orange-600">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}