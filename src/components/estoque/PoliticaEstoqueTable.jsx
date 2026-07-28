import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function PoliticaEstoqueTable({ almoxarifado_id, politicas = [] }) {
  const [editando, setEditando] = useState({});
  const [salvar, setSalvar] = useState(false);

  const handleChange = (index, field, value) => {
    const chave = `${index}-${politicas[index].id}`;
    setEditando(prev => ({
      ...prev,
      [chave]: {
        ...(prev[chave] || politicas[index]),
        [field]: field.includes('minimo', 'maximo', 'ponto', 'lote') ? parseFloat(value) || 0 : value
      }
    }));
  };

  const handleSalvarTodos = async () => {
    setSalvar(true);
    try {
      for (const [chave, dados] of Object.entries(editando)) {
        await base44.functions.invoke('salvarPoliticaEstoque', {
          insumo_id: dados.insumo_id,
          almoxarifado_id: dados.almoxarifado_id,
          minimo: dados.minimo,
          maximo: dados.maximo,
          ponto_reposicao: dados.ponto_reposicao,
          lote_compra: dados.lote_compra,
          ativo: dados.ativo
        });
      }
      toast.success('Políticas salvas com sucesso');
      setEditando({});
    } catch (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSalvar(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Políticas de Estoque</CardTitle>
      </CardHeader>
      <CardContent>
        {politicas.length === 0 ? (
          <p className="text-gray-500">Nenhuma política configurada</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Insumo</th>
                    <th className="text-center p-2">Mínimo</th>
                    <th className="text-center p-2">Máximo</th>
                    <th className="text-center p-2">Ponto Reposição</th>
                    <th className="text-center p-2">Lote Compra</th>
                    <th className="text-center p-2">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {politicas.map((pol, idx) => {
                    const chave = `${idx}-${pol.id}`;
                    const dados = editando[chave] || pol;
                    return (
                      <tr key={pol.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{pol.data?.insumo_id || 'N/A'}</td>
                        <td className="text-center">
                          <Input
                            type="number"
                            value={dados.minimo || 0}
                            onChange={(e) => handleChange(idx, 'minimo', e.target.value)}
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="text-center">
                          <Input
                            type="number"
                            value={dados.maximo || 0}
                            onChange={(e) => handleChange(idx, 'maximo', e.target.value)}
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="text-center">
                          <Input
                            type="number"
                            value={dados.ponto_reposicao || 0}
                            onChange={(e) => handleChange(idx, 'ponto_reposicao', e.target.value)}
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="text-center">
                          <Input
                            type="number"
                            value={dados.lote_compra || 1}
                            onChange={(e) => handleChange(idx, 'lote_compra', e.target.value)}
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={dados.ativo !== false}
                            onChange={(e) => handleChange(idx, 'ativo', e.target.checked)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSalvarTodos} disabled={salvar || Object.keys(editando).length === 0}>
                <Save className="w-4 h-4 mr-2" />
                {salvar ? 'Salvando...' : 'Salvar Todas as Políticas'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}