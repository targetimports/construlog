import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

export default function RateioAdministrativo() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    periodo_de: '',
    periodo_ate: '',
    itens: []
  });
  const [itemInput, setItemInput] = useState({ obra_id: '', percentual: 0 });
  const queryClient = useQueryClient();

  const { data: rateios = [] } = useQuery({
    queryKey: ['rateios-administrativos'],
    queryFn: () => base44.entities.RateioAdministrativo.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const criar = useMutation({
    mutationFn: (data) => base44.entities.RateioAdministrativo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateios-administrativos'] });
      setFormData({ nome: '', periodo_de: '', periodo_ate: '', itens: [] });
      setShowForm(false);
    }
  });

  const deletar = useMutation({
    mutationFn: (id) => base44.entities.RateioAdministrativo.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rateios-administrativos'] })
  });

  const adicionarItem = () => {
    if (!itemInput.obra_id || itemInput.percentual <= 0) return;
    
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, { ...itemInput, percentual: parseFloat(itemInput.percentual) }]
    }));
    setItemInput({ obra_id: '', percentual: 0 });
  };

  const removerItem = (idx) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== idx)
    }));
  };

  const somaPercentuais = formData.itens.reduce((sum, item) => sum + item.percentual, 0);
  const somaOk = Math.abs(somaPercentuais - 100) < 0.01;

  const handleSubmit = () => {
    if (!formData.nome.trim() || !formData.periodo_de || !formData.periodo_ate || !somaOk) {
      alert('Preencha todos os campos e a soma dos percentuais deve ser 100%');
      return;
    }

    criar.mutate({
      nome: formData.nome,
      periodo_de: formData.periodo_de,
      periodo_ate: formData.periodo_ate,
      metodo: 'percentual',
      itens: formData.itens,
      ativo: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Rateio Administrativo</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova Regra de Rateio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome da Regra</label>
                <Input 
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Rateio 2026"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Período De</label>
                  <Input 
                    type="date"
                    value={formData.periodo_de}
                    onChange={(e) => setFormData({ ...formData, periodo_de: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Período Até</label>
                  <Input 
                    type="date"
                    value={formData.periodo_ate}
                    onChange={(e) => setFormData({ ...formData, periodo_ate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Itens de Rateio</label>
                  <span className={`text-sm font-semibold ${somaOk ? 'text-green-600' : 'text-red-600'}`}>
                    Soma: {somaPercentuais.toFixed(2)}%
                  </span>
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  {formData.itens.map((item, idx) => {
                    const obra = obras.find(o => o.id === item.obra_id);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                        <span>{obra?.nome} - {item.percentual}%</span>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => removerItem(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 p-3 border rounded-lg bg-blue-50">
                  <div className="grid gap-2">
                    <div>
                      <label className="text-sm">Obra</label>
                      <select 
                        value={itemInput.obra_id}
                        onChange={(e) => setItemInput({ ...itemInput, obra_id: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="">Selecione obra</option>
                        {obras.map(o => (
                          <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm">Percentual</label>
                      <Input 
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={itemInput.percentual}
                        onChange={(e) => setItemInput({ ...itemInput, percentual: parseFloat(e.target.value) })}
                        placeholder="0.00"
                      />
                    </div>
                    <Button 
                      onClick={adicionarItem}
                      variant="outline"
                      className="w-full"
                    >
                      Adicionar Item
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                Criar Regra
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {rateios.map((rateio) => (
          <Card key={rateio.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{rateio.nome}</CardTitle>
                  <p className="text-sm text-gray-600">
                    {rateio.periodo_de} a {rateio.periodo_ate}
                  </p>
                </div>
                <div className="flex gap-2">
                  {rateio.ativo && <Badge className="bg-green-100 text-green-800">Ativo</Badge>}
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => deletar.mutate(rateio.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rateio.itens.map((item, idx) => {
                  const obra = obras.find(o => o.id === item.obra_id);
                  return (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{obra?.nome}</span>
                      <span className="font-semibold">{item.percentual}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}