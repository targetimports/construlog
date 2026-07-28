import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '../../utils';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  Package,
  ClipboardList,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LinkModulos({ tipo, dados }) {
  const renderLinks = () => {
    switch (tipo) {
      case 'obra':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to={createPageUrl(`OrcamentoDetalhes?id=${dados.orcamento_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 gap-2">
                <FileText className="w-4 h-4" />
                Ver Orçamento
              </Button>
            </Link>
            <Link to={createPageUrl(`Medicoes?obra_id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-emerald-500 hover:text-emerald-600 gap-2">
                <TrendingUp className="w-4 h-4" />
                Medições
              </Button>
            </Link>
            <Link to={createPageUrl(`Financeiro?obra_id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-amber-500 hover:text-amber-600 gap-2">
                <DollarSign className="w-4 h-4" />
                Financeiro
              </Button>
            </Link>
            <Link to={createPageUrl(`GestaoObraDetalhada?obra_id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-purple-500 hover:text-purple-600 gap-2">
                <BarChart3 className="w-4 h-4" />
                Gestão
              </Button>
            </Link>
          </div>
        );

      case 'solicitacao':
        return (
          <div className="grid grid-cols-1 gap-3">
            <Link to={createPageUrl(`Compras`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-amber-500 hover:text-amber-600 gap-2">
                <ShoppingCart className="w-4 h-4" />
                Ordens de Compra
              </Button>
            </Link>
          </div>
        );

      case 'medicao':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link to={createPageUrl(`ObraDetalhes?id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 gap-2">
                Ver Obra
              </Button>
            </Link>
            <Link to={createPageUrl(`MapaMedicoes?obra_id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-emerald-500 hover:text-emerald-600 gap-2">
                Mapa de Medições
              </Button>
            </Link>
            {dados.conta_financeira_id && (
              <Link to={createPageUrl(`Financeiro?conta_id=${dados.conta_financeira_id}`)}>
                <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-amber-500 hover:text-amber-600 gap-2">
                  <DollarSign className="w-4 h-4" />
                  Ver Faturamento
                </Button>
              </Link>
            )}
          </div>
        );

      case 'orcamento':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to={createPageUrl(`ComprasForm?obra_id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 gap-2">
                <ShoppingCart className="w-4 h-4" />
                Nova Requisição
              </Button>
            </Link>
            <Link to={createPageUrl(`ObraDetalhes?id=${dados.obra_id}&secao=medicoes`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-emerald-500 hover:text-emerald-600 gap-2">
                <TrendingUp className="w-4 h-4" />
                Nova Medição
              </Button>
            </Link>
            <Link to={createPageUrl(`ObraDetalhes?id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-purple-500 hover:text-purple-600 gap-2">
                <BarChart3 className="w-4 h-4" />
                Ver Obra
              </Button>
            </Link>
            <Link to={createPageUrl(`DiarioObra?obra_id=${dados.obra_id}`)}>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:border-amber-500 hover:text-amber-600 gap-2">
                <ClipboardList className="w-4 h-4" />
                Diário
              </Button>
            </Link>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="w-4 h-4 text-blue-600" />
          <span className="text-blue-600 text-sm font-medium">Ações Rápidas</span>
        </div>
        {renderLinks()}
      </CardContent>
    </Card>
  );
}