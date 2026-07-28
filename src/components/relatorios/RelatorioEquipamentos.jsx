import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function RelatorioEquipamentos() {
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroEquipamento, setFiltroEquipamento] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const { data: usos = [] } = useQuery({
    queryKey: ['todos-usos-equipamento'],
    queryFn: () => base44.entities.RegistroUsoEquipamento.list()
  });

  const filtered = usos.filter(u => 
    (!filtroObra || u.obra_id === filtroObra) &&
    (!filtroEquipamento || u.equipamento_id === filtroEquipamento)
  );

  // Custo por equipamento
  const custoEquipamento = equipamentos.map(e => {
    const usosEquip = filtered.filter(u => u.equipamento_id === e.id);
    return {
      nome: e.nome,
      custo: usosEquip.reduce((sum, u) => sum + (u.custo_total || 0), 0),
      horas: usosEquip.reduce((sum, u) => sum + (u.horas_trabalhadas || 0), 0)
    };
  }).filter(e => e.custo > 0);

  // Custo por obra
  const custoObra = obras.map(o => {
    const usosObra = filtered.filter(u => u.obra_id === o.id);
    return {
      nome: o.nome,
      custo: usosObra.reduce((sum, u) => sum + (u.custo_total || 0), 0)
    };
  }).filter(o => o.custo > 0);

  const totalCusto = filtered.reduce((sum, u) => sum + (u.custo_total || 0), 0);
  const totalHoras = filtered.reduce((sum, u) => sum + (u.horas_trabalhadas || 0), 0);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total de Custo</p>
            <p className="text-2xl font-bold text-blue-600">R$ {totalCusto.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total de Horas</p>
            <p className="text-2xl font-bold text-green-600">{totalHoras.toFixed(0)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Equipamentos</p>
            <p className="text-2xl font-bold">{equipamentos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Registros</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Filtrar por Obra</label>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todas as obras</SelectItem>
              {obras.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Filtrar por Equipamento</label>
          <Select value={filtroEquipamento} onValueChange={setFiltroEquipamento}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os equipamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos os equipamentos</SelectItem>
              {equipamentos.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custo por Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          {custoEquipamento.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={custoEquipamento}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="custo" fill="#3B82F6" name="Custo (R$)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-600">Sem dados</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custo por Obra</CardTitle>
        </CardHeader>
        <CardContent>
          {custoObra.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={custoObra} dataKey="custo" nameKey="nome" cx="50%" cy="50%" outerRadius={100} label>
                  {custoObra.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-600">Sem dados</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Equipamento</th>
                  <th className="text-left py-2">Obra</th>
                  <th className="text-right py-2">Horas</th>
                  <th className="text-right py-2">Custo</th>
                  <th className="text-left py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const equip = equipamentos.find(e => e.id === u.equipamento_id);
                  const obra = obras.find(o => o.id === u.obra_id);
                  return (
                    <tr key={u.id} className="border-b">
                      <td className="py-2">{equip?.nome}</td>
                      <td className="py-2">{obra?.nome}</td>
                      <td className="py-2 text-right">{u.horas_trabalhadas}</td>
                      <td className="py-2 text-right">R$ {u.custo_total?.toFixed(2)}</td>
                      <td className="py-2">{u.tipo_uso}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}