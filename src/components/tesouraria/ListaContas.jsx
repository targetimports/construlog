import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, Eye, Pencil, Wallet } from 'lucide-react';
import { fmtCompactBRLfiel } from '@/lib/fmtCompact';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_LABELS = {
  caixa: 'Caixa', banco_corrente: 'Banco C/C', banco_poupanca: 'Banco Poupança',
  banco_investimento: 'Investimento', conta_obra: 'Conta Obra', conta_garantia: 'Garantia',
  aplicacao: 'Aplicação', outro: 'Outro',
};
const TIPO_COLORS = {
  caixa: 'bg-green-100 text-green-800', banco_corrente: 'bg-blue-100 text-blue-800',
  banco_poupanca: 'bg-purple-100 text-purple-800', banco_investimento: 'bg-indigo-100 text-indigo-800',
  conta_obra: 'bg-amber-100 text-amber-800', conta_garantia: 'bg-red-100 text-red-800',
  aplicacao: 'bg-teal-100 text-teal-800', outro: 'bg-gray-100 text-gray-800',
};

export default function ListaContas({ contas = [], onSelectConta, onBloquearSaldo, onEditar }) {
  if (contas.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="py-16 text-center">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.</p>
        </CardContent>
      </Card>
    );
  }

  const Acoes = ({ conta }) => (
    <div className="flex gap-1 justify-end">
      {!conta.saldo_inicial_bloqueado && (
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Bloquear saldo inicial" onClick={() => onBloquearSaldo?.(conta)}>
          <Unlock className="w-4 h-4 text-amber-500" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" title="Editar conta" onClick={() => onEditar?.(conta)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="outline" size="sm" className="gap-1 h-8 border-gray-300 text-gray-700" onClick={() => onSelectConta?.(conta)}>
        <Eye className="w-3.5 h-3.5" /> Extrato
      </Button>
    </div>
  );

  return (
    <Card className="bg-white border-gray-200">
      <CardContent className="p-0">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-gray-500">Conta</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-500">Tipo</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-500">Saldo Inicial</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-500">Entradas</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-500">Saídas</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-500">Saldo Atual</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contas.map((conta) => (
                <tr key={conta.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{conta.nome}</span>
                      {conta.status === 'inativa' && <Badge variant="outline" className="text-gray-400">Inativa</Badge>}
                      {conta.saldo_inicial_bloqueado && <Lock className="w-3.5 h-3.5 text-gray-400" title="Saldo inicial bloqueado" />}
                    </div>
                    {(conta.banco || conta.agencia || conta.numero_conta) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[conta.banco, conta.agencia && `Ag ${conta.agencia}`, conta.numero_conta && `CC ${conta.numero_conta}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge className={`border-0 ${TIPO_COLORS[conta.tipo] || TIPO_COLORS.outro}`}>{TIPO_LABELS[conta.tipo] || conta.tipo}</Badge>
                  </td>
                  <td className="p-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{fmt(conta.saldo_inicial)}</td>
                  <td className="p-3 text-right tabular-nums text-green-600 whitespace-nowrap">{fmt(conta.total_entradas)}</td>
                  <td className="p-3 text-right tabular-nums text-red-600 whitespace-nowrap">{fmt(conta.total_saidas)}</td>
                  <td className={`p-3 text-right tabular-nums font-bold whitespace-nowrap ${(conta.saldo_atual || 0) < 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmt(conta.saldo_atual)}</td>
                  <td className="p-3"><Acoes conta={conta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-gray-100">
          {contas.map((conta) => (
            <div key={conta.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 truncate">{conta.nome}</span>
                    {conta.saldo_inicial_bloqueado && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                  <Badge className={`border-0 mt-1 ${TIPO_COLORS[conta.tipo] || TIPO_COLORS.outro}`}>{TIPO_LABELS[conta.tipo] || conta.tipo}</Badge>
                </div>
                <p className={`text-lg font-bold tabular-nums shrink-0 ${(conta.saldo_atual || 0) < 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmtCompactBRLfiel(conta.saldo_atual)}</p>
              </div>
              <div className="flex items-center gap-x-4 text-xs text-gray-500">
                <span className="text-green-600">↑ {fmtCompactBRLfiel(conta.total_entradas)}</span>
                <span className="text-red-600">↓ {fmtCompactBRLfiel(conta.total_saidas)}</span>
              </div>
              <div className="pt-1"><Acoes conta={conta} /></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
