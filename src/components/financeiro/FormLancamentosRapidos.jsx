import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';

export default function FormLancamentosRapidos({ onSuccess }) {
  const [aba, setAba] = useState('material');
  const [dados, setDados] = useState({});

  const createMutation = useMutation({
    mutationFn: async () => {
      const entidade = {
        material: 'Material',
        mao_de_obra: 'MaoDeObra',
        nf: 'NotaFiscal',
        alimentacao: 'Alimentacao',
        aluguel: 'AluguelEquipamento',
        imposto: 'Imposto',
        frete: 'Frete',
        estadia: 'Estadia',
        retirada: 'Retirada',
        empreita: 'Empreita',
        generico: 'LancamentoGenerico'
      }[aba];

      if (!entidade) throw new Error('Aba inválida');
      return base44.entities[entidade].create(dados);
    },
    onSuccess: () => {
      setDados({});
      onSuccess?.();
    }
  });

  const renderForm = () => {
    switch (aba) {
      case 'material':
        return (
          <div className="space-y-3">
            <input
              type="date"
              value={dados.data || ''}
              onChange={(e) => setDados({ ...dados, data: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <input
              type="text"
              placeholder="Fornecedor"
              value={dados.fornecedor_id || ''}
              onChange={(e) => setDados({ ...dados, fornecedor_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Material"
              value={dados.descricao_material || ''}
              onChange={(e) => setDados({ ...dados, descricao_material: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <input
              type="number"
              placeholder="Valor Total"
              value={dados.valor_total || ''}
              onChange={(e) => setDados({ ...dados, valor_total: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>
        );
      case 'mao_de_obra':
        return (
          <div className="space-y-3">
            <input
              type="date"
              value={dados.data || ''}
              onChange={(e) => setDados({ ...dados, data: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <input
              type="text"
              placeholder="Pessoa"
              value={dados.pessoa_id || ''}
              onChange={(e) => setDados({ ...dados, pessoa_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <select
              value={dados.tipo || ''}
              onChange={(e) => setDados({ ...dados, tipo: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            >
              <option value="">Tipo</option>
              <option value="diaria">Diária</option>
              <option value="empreita">Empreita</option>
              <option value="salario">Salário</option>
              <option value="avulso">Avulso</option>
            </select>
            <input
              type="number"
              placeholder="Valor"
              value={dados.valor || ''}
              onChange={(e) => setDados({ ...dados, valor: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>
        );
      case 'alimentacao':
        return (
          <div className="space-y-3">
            <input
              type="date"
              value={dados.data || ''}
              onChange={(e) => setDados({ ...dados, data: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
            <input
              type="text"
              placeholder="Fornecedor"
              value={dados.fornecedor_id || ''}
              onChange={(e) => setDados({ ...dados, fornecedor_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <select
              value={dados.categoria || ''}
              onChange={(e) => setDados({ ...dados, categoria: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            >
              <option value="">Categoria</option>
              <option value="refeicao">Refeição</option>
              <option value="cafe">Café</option>
              <option value="mercado">Mercado</option>
              <option value="internet">Internet</option>
              <option value="telefone">Telefone</option>
            </select>
            <input
              type="number"
              placeholder="Valor"
              value={dados.valor || ''}
              onChange={(e) => setDados({ ...dados, valor: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>
        );
      default:
        return <div className="text-gray-500 text-sm">Formulário em desenvolvimento</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Lançamento Rápido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 text-sm overflow-x-auto">
          {['material', 'mao_de_obra', 'alimentacao', 'aluguel', 'imposto', 'frete', 'estadia', 'retirada', 'empreita', 'nf', 'generico'].map(tab => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              className={`px-2 py-1 rounded whitespace-nowrap ${
                aba === tab ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {tab.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {renderForm()}

        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {createMutation.isPending ? 'Salvando...' : 'Registrar'}
        </Button>
      </CardContent>
    </Card>
  );
}