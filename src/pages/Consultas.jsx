import React, { useState } from 'react';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  FileText,
  Package,
  DollarSign,
  ClipboardList,
  Zap,
  Search
} from 'lucide-react';
import BuscaGlobal from '@/components/consultas/BuscaGlobal';
import ConsultasCompras from '@/components/consultas/ConsultasCompras';
import ConsultasEstoque from '@/components/consultas/ConsultasEstoque';
import ConsultasFinanceiro from '@/components/consultas/ConsultasFinanceiro';
import ConsultasMedicoes from '@/components/consultas/ConsultasMedicoes';
import ConsultasCampo from '@/components/consultas/ConsultasCampo';

const MODULOS = [
  { id: 'global', nome: 'Busca Global', icon: Search },
  { id: 'compras', nome: 'Compras', icon: ShoppingCart },
  { id: 'estoque', nome: 'Estoque', icon: Package },
  { id: 'financeiro', nome: 'Financeiro', icon: DollarSign },
  { id: 'medicoes', nome: 'Medições & Receitas', icon: ClipboardList },
  { id: 'campo', nome: 'Campo', icon: Zap }
];

export default function Consultas() {
  const { obraAtual } = useGlobalContext();
  const [moduloAtivo, setModuloAtivo] = useState('global');

  if (!obraAtual?.id) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecione uma obra para acessar as consultas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Consultas</h1>
        <p className="text-gray-600 mt-1">Busque informações por obra</p>
      </div>

      {/* Menu de Módulos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {MODULOS.map(mod => {
          const Icon = mod.icon;
          return (
            <Button
              key={mod.id}
              variant={moduloAtivo === mod.id ? 'default' : 'outline'}
              onClick={() => setModuloAtivo(mod.id)}
              className="flex flex-col items-center gap-2 h-auto py-3"
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs text-center">{mod.nome}</span>
            </Button>
          );
        })}
      </div>

      {/* Conteúdo por Módulo */}
      <div className="space-y-4">
        {moduloAtivo === 'global' && <BuscaGlobal obraId={obraAtual.id} />}
        {moduloAtivo === 'compras' && <ConsultasCompras obraId={obraAtual.id} />}
        {moduloAtivo === 'estoque' && <ConsultasEstoque obraId={obraAtual.id} />}
        {moduloAtivo === 'financeiro' && <ConsultasFinanceiro obraId={obraAtual.id} />}
        {moduloAtivo === 'medicoes' && <ConsultasMedicoes obraId={obraAtual.id} />}
        {moduloAtivo === 'campo' && <ConsultasCampo obraId={obraAtual.id} />}
      </div>
    </div>
  );
}