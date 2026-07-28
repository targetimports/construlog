import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import GastosOperacionaisLucro from './GastosOperacionaisLucro';

export default function DescontosRetencoes() {
  const [descontos, setDescontos] = useState([
    { id: 1, nome: 'ISS', percentual: 5, tipo: 'retencao' },
    { id: 2, nome: 'IR Pessoa Física', percentual: 7.5, tipo: 'retencao' },
    { id: 3, nome: 'INSS', percentual: 11, tipo: 'retencao' },
    { id: 4, nome: 'Desconto Comercial', percentual: 10, tipo: 'desconto' }
  ]);

  // Período padrão (últimos 30 dias)
  const getPeriodo = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      periodoInicio: start.toISOString().split('T')[0],
      periodoFim: end.toISOString().split('T')[0]
    };
  };

  const periodo = getPeriodo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({ nome: '', percentual: 0, tipo: 'retencao' });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const resumoDescontos = useMemo(() => {
    const receber = contas.filter(c => c.tipo === 'receber' && c.status === 'pago').reduce((a, c) => a + (c.valor || 0), 0);
    
    const aplicados = descontos.map(d => ({
      ...d,
      valor: receber * (d.percentual / 100)
    }));

    const totalRetencoes = aplicados.filter(a => a.tipo === 'retencao').reduce((a, c) => a + c.valor, 0);
    const totalDescontos = aplicados.filter(a => a.tipo === 'desconto').reduce((a, c) => a + c.valor, 0);

    return {
      bruto: receber,
      retencoes: totalRetencoes,
      descontos: totalDescontos,
      liquido: receber - totalRetencoes - totalDescontos,
      aplicados
    };
  }, [contas, descontos]);

  const handleAbrirForm = (desconto = null) => {
    if (desconto) {
      setEditando(desconto);
      setFormData(desconto);
    } else {
      setEditando(null);
      setFormData({ nome: '', percentual: 0, tipo: 'retencao' });
    }
    setDialogOpen(true);
  };

  const handleSalvar = () => {
    if (!formData.nome || formData.percentual < 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    if (editando) {
      setDescontos(descontos.map(d => d.id === editando.id ? { ...formData, id: d.id } : d));
      toast.success('Desconto/Retenção atualizado!');
    } else {
      setDescontos([...descontos, { ...formData, id: Date.now() }]);
      toast.success('Desconto/Retenção criado!');
    }
    setDialogOpen(false);
  };

  const handleDeletar = (id) => {
    setDescontos(descontos.filter(d => d.id !== id));
    toast.success('Desconto/Retenção removido!');
  };

  return (
    <div className="space-y-6">
      {/* Nova seção: Gastos Operacionais e Lucro */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">
            Período: {periodo.periodoInicio} a {periodo.periodoFim}
          </span>
        </div>
        <GastosOperacionaisLucro 
          periodoInicio={periodo.periodoInicio}
          periodoFim={periodo.periodoFim}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Regras de Desconto e Retenção</CardTitle>
          <Button onClick={() => handleAbrirForm()} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Regra
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {descontos.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold">{d.nome}</p>
                  <p className="text-sm text-gray-600">{d.tipo === 'retencao' ? 'Retenção' : 'Desconto'} - {d.percentual}%</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleAbrirForm(d)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeletar(d.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulação de Descontos (Recebimentos Pagos)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Valor Bruto</p>
              <p className="text-2xl font-bold text-blue-600">{resumoDescontos.bruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Retenções</p>
              <p className="text-2xl font-bold text-red-600">{resumoDescontos.retencoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Descontos</p>
              <p className="text-2xl font-bold text-amber-600">{resumoDescontos.descontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-gray-600">Valor Líquido</p>
              <p className="text-2xl font-bold text-emerald-600">{resumoDescontos.liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <h4 className="font-semibold text-gray-900">Detalhamento</h4>
            {resumoDescontos.aplicados.map(a => (
              <div key={a.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <p className="text-sm">{a.nome} ({a.percentual}%)</p>
                <p className="font-semibold text-red-600">{a.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar' : 'Nova'} Regra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Regra</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.percentual}
                onChange={(e) => setFormData({ ...formData, percentual: parseFloat(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="retencao">Retenção</option>
                <option value="desconto">Desconto</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvar}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}