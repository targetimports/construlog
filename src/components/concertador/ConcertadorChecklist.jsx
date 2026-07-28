import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DEFAULT_ITEMS = [
  { id: 1, nome: 'Autenticação & Login', status: 'ok', obs: '' },
  { id: 2, nome: 'Carregamento de Dados (Entities)', status: 'ok', obs: '' },
  { id: 3, nome: 'Formulários & Validações', status: 'ok', obs: '' },
  { id: 4, nome: 'Layout & Responsividade', status: 'warning', obs: '' },
  { id: 5, nome: 'Performance & Lazy Loading', status: 'pending', obs: '' },
  { id: 6, nome: 'Tratamento de Erros', status: 'ok', obs: '' },
  { id: 7, nome: 'Testes Unitários', status: 'bug', obs: '' },
  { id: 8, nome: 'Documentação do Código', status: 'warning', obs: '' }
];

export default function ConcertadorChecklist({ onSave, initialData }) {
  const [items, setItems] = useState(initialData?.items || DEFAULT_ITEMS);
  const [novoItem, setNovoItem] = useState('');
  const [autoLoading, setAutoLoading] = useState(false);

  const statusOptions = [
    { value: 'ok', label: 'OK', color: 'bg-green-100' },
    { value: 'warning', label: 'Aviso', color: 'bg-yellow-100' },
    { value: 'bug', label: 'Bug', color: 'bg-red-100' },
    { value: 'pending', label: 'Pendente', color: 'bg-gray-100' }
  ];

  const updateItem = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? {...item, [field]: value} : item
    ));
  };

  const addItem = () => {
    if (!novoItem.trim()) return;
    setItems([
      ...items,
      {
        id: Math.max(...items.map(i => i.id), 0) + 1,
        nome: novoItem,
        status: 'pending',
        obs: ''
      }
    ]);
    setNovoItem('');
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAutoAnalise = async () => {
    setAutoLoading(true);
    try {
      const prompt = `
Você é um auditor de software experiente. Analise este checklist de funcionalidades:

${items.map(i => `- ${i.nome}: ${i.status} ${i.obs ? `(${i.obs})` : ''}`).join('\n')}

Para cada item, determine:
1. Se está OK, com Warning, com Bug ou Pendente
2. Adicione observações técnicas relevantes

Retorne um JSON array com:
[
  {
    "nome": "nome do item",
    "status": "ok|warning|bug|pending",
    "obs": "observação técnica detalhada sobre o estado atual"
  }
]
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  status: { type: "string" },
                  obs: { type: "string" }
                }
              }
            }
          }
        }
      });

      setItems(response.items.map((item, idx) => ({ ...item, id: idx + 1 })));
    } catch (error) {
      console.error('Erro ao analisar:', error);
    } finally {
      setAutoLoading(false);
    }
  };

  const handleSave = () => {
    onSave({ items });
  };

  const stats = {
    total: items.length,
    ok: items.filter(i => i.status === 'ok').length,
    warning: items.filter(i => i.status === 'warning').length,
    bug: items.filter(i => i.status === 'bug').length,
    pending: items.filter(i => i.status === 'pending').length
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">Checklist de Funcionalidades</span>
          <Button 
            onClick={handleAutoAnalise}
            disabled={autoLoading}
            variant="outline"
            className="gap-2"
          >
            {autoLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                IA Analisar Automaticamente
              </>
            )}
          </Button>
        </CardTitle>
        <div className="grid grid-cols-5 gap-2 mt-4 text-sm">
          <div className="text-center">
            <p className="font-bold text-lg">{stats.total}</p>
            <p className="text-gray-600">Total</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-green-600">{stats.ok}</p>
            <p className="text-gray-600"></p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-yellow-600">{stats.warning}</p>
            <p className="text-gray-600"></p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-red-600">{stats.bug}</p>
            <p className="text-gray-600"></p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-gray-600">{stats.pending}</p>
            <p className="text-gray-600"></p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => {
            const statusOpt = statusOptions.find(s => s.value === item.status);
            return (
              <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${statusOpt?.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.nome}</h4>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateItem(item.id, 'status', e.target.value)}
                    className="px-2 py-1 rounded text-sm font-medium border bg-white"
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
                <Textarea
                  placeholder="Observações (ex: qual é o problema, passos para reproduzir)..."
                  value={item.obs}
                  onChange={(e) => updateItem(item.id, 'obs', e.target.value)}
                  className="text-sm"
                  rows={2}
                />
              </div>
            );
          })}
        </div>

        {/* Add Item */}
        <div className="flex gap-2">
          <Input
            placeholder="Adicionar nova funcionalidade para verificar..."
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
          />
          <Button onClick={addItem} variant="outline" size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <Button onClick={handleSave} className="w-full gap-2" size="lg">
          <CheckCircle2 className="w-5 h-5" />
          Salvar Checklist e Continuar
        </Button>
      </CardContent>
    </Card>
  );
}