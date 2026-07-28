import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function HistoricoMovimentacoes({ dados }) {
  if (!dados?.movimentacoes) {
    return <div className="text-gray-500">Sem dados de movimentação</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Movimentações</CardTitle>
        <p className="text-sm text-gray-600">Total: {dados.total} movimentações</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.movimentacoes.map((mov, idx) => (
              <TableRow key={idx}>
                <TableCell>{format(new Date(mov.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                <TableCell>
                  <Badge className={mov.tipo === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {mov.tipo === 'entrada' ? <ArrowDown className="w-3 h-3 mr-1" /> : <ArrowUp className="w-3 h-3 mr-1" />}
                    {mov.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{mov.quantidade}</TableCell>
                <TableCell className="text-sm text-gray-600">{mov.descricao}</TableCell>
                <TableCell className="text-sm text-gray-500">{mov.usuario}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}