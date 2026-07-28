import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Etapa2Materiais({ dadosImport, setDadosImport }) {
  const [formulario, setFormulario] = useState({
    descricao: '',
    quantidade: '',
    unidade: 'un',
    valorUnitario: ''
  });

  // Parse materiais do arquivo (aqui seria a integração com parser real)
  useEffect(() => {
    if (dadosImport.fileUrl && dadosImport.materiais.length === 0) {
      // Placeholder: em produção, parser Excel/CSV real
      const materiaisMock = [
        { id: 1, descricao: 'Cimento Portland CP-V', quantidade: 50, unidade: 'sc', valorUnitario: 45 },
        { id: 2, descricao: 'Areia média', quantidade: 10, unidade: 'm3', valorUnitario: 120 },
        { id: 3, descricao: 'Brita nº1', quantidade: 5, unidade: 'm3', valorUnitario: 150 }
      ];
      setDadosImport({
        ...dadosImport,
        materiais: materiaisMock,
        materiaisSelecionados: materiaisMock
      });
    }
  }, [dadosImport.fileUrl]);

  const handleToggleMaterial = (id) => {
    setDadosImport({
      ...dadosImport,
      materiaisSelecionados: dadosImport.materiaisSelecionados.some(m => m.id === id)
        ? dadosImport.materiaisSelecionados.filter(m => m.id !== id)
        : [...dadosImport.materiaisSelecionados, dadosImport.materiais.find(m => m.id === id)]
    });
  };

  const handleSelecionarTodos = () => {
    setDadosImport({
      ...dadosImport,
      materiaisSelecionados: [...dadosImport.materiais]
    });
  };

  const handleDesmarcarTodos = () => {
    setDadosImport({
      ...dadosImport,
      materiaisSelecionados: []
    });
  };

  const handleAdicionarMaterial = () => {
    if (!formulario.descricao || !formulario.quantidade) {
      toast.error('Preencha descrição e quantidade');
      return;
    }

    const novoMaterial = {
      id: Date.now(),
      descricao: formulario.descricao,
      quantidade: parseFloat(formulario.quantidade),
      unidade: formulario.unidade,
      valorUnitario: parseFloat(formulario.valorUnitario) || 0
    };

    setDadosImport({
      ...dadosImport,
      materiais: [...dadosImport.materiais, novoMaterial],
      materiaisSelecionados: [...dadosImport.materiaisSelecionados, novoMaterial]
    });

    setFormulario({ descricao: '', quantidade: '', unidade: 'un', valorUnitario: '' });
    toast.success('Material adicionado');
  };

  const handleRemoverMaterial = (id) => {
    setDadosImport({
      ...dadosImport,
      materiais: dadosImport.materiais.filter(m => m.id !== id),
      materiaisSelecionados: dadosImport.materiaisSelecionados.filter(m => m.id !== id)
    });
  };

  const totalValor = dadosImport.materiaisSelecionados.reduce(
    (sum, m) => sum + (m.quantidade * (m.valorUnitario || 0)),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 2: Orçamento - Revisar e Selecionar Materiais</CardTitle>
        <p className="text-sm text-gray-600 mt-2">Todos os materiais selecionados serão criados como necessidades permanentes da obra</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Botões de seleção rápida */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSelecionarTodos}>
            ✓ Selecionar Todos
          </Button>
          <Button variant="outline" size="sm" onClick={handleDesmarcarTodos}>
            ✗ Desmarcar Todos
          </Button>
        </div>

        {/* Lista de materiais */}
        <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
          {dadosImport.materiais.map(material => (
            <div key={material.id} className="flex items-center gap-3 p-3 bg-white rounded border">
              <Checkbox
                checked={dadosImport.materiaisSelecionados.some(m => m.id === material.id)}
                onCheckedChange={() => handleToggleMaterial(material.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{material.descricao}</p>
                <p className="text-xs text-gray-600">
                  {material.quantidade} {material.unidade} × R$ {material.valorUnitario?.toFixed(2)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoverMaterial(material.id)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>

        {/* Formulário adicionar material */}
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <p className="font-medium text-sm">Adicionar Material Manualmente</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Descrição"
              value={formulario.descricao}
              onChange={(e) => setFormulario({ ...formulario, descricao: e.target.value })}
            />
            <Input
              placeholder="Quantidade"
              type="number"
              value={formulario.quantidade}
              onChange={(e) => setFormulario({ ...formulario, quantidade: e.target.value })}
            />
            <select
              className="px-3 py-2 border rounded text-sm"
              value={formulario.unidade}
              onChange={(e) => setFormulario({ ...formulario, unidade: e.target.value })}
            >
              <option value="un">Unidade (un)</option>
              <option value="kg">Quilograma (kg)</option>
              <option value="m">Metro (m)</option>
              <option value="m2">Metro Quadrado (m²)</option>
              <option value="m3">Metro Cúbico (m³)</option>
              <option value="l">Litro (l)</option>
              <option value="sc">Saco (sc)</option>
            </select>
            <Input
              placeholder="Valor Unitário (opcional)"
              type="number"
              value={formulario.valorUnitario}
              onChange={(e) => setFormulario({ ...formulario, valorUnitario: e.target.value })}
            />
          </div>
          <Button onClick={handleAdicionarMaterial} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Material
          </Button>
        </div>

        {/* Resumo */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{dadosImport.materiaisSelecionados.length}</strong> material(is) selecionado(s) | 
            Valor Total: <strong>R$ {totalValor.toFixed(2)}</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}