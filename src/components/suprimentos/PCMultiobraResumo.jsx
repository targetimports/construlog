import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Building2, Package, FileText } from 'lucide-react';

export default function PCMultiobraResumo({
  obras = [],
  itens = [],
  consolidado = false,
  statusNF = null,
}) {
  const calcularRateioPorItem = (item) => {
    if (!item.rateio_obras || item.rateio_obras.length === 0) return 0;
    return item.rateio_obras.reduce((sum, r) => sum + (r.quantidade || 0), 0);
  };

  const itensComRateio = itens.filter(
    (it) => it.material_id && calcularRateioPorItem(it) > 0
  );

  const itensIncompletos = itens.filter((it) => {
    if (!it.material_id) return false;
    const totalRateado = calcularRateioPorItem(it);
    return Math.abs((it.quantidade_pedida || 0) - totalRateado) > 0.01;
  });

  const totalPedido = itens.reduce((sum, it) => sum + (it.total_item || 0), 0);
  const totalRateado = itensComRateio.reduce((sum, it) => {
    return sum + (it.rateio_obras?.reduce((s, r) => s + (r.quantidade * (it.preco_unitario || 0) || 0), 0) || 0);
  }, 0);

  const getBadgeStatusNF = () => {
    if (statusNF === 'CONFERIDO') {
      return <Badge className="bg-green-100 text-green-800">✓ Conferido com NF</Badge>;
    }
    if (statusNF === 'DIVERGENCIA') {
      return <Badge className="bg-orange-100 text-orange-800">Divergência com NF</Badge>;
    }
    if (statusNF === 'PENDENTE') {
      return <Badge className="bg-yellow-100 text-yellow-800">○ Pendente conferência</Badge>;
    }
    return null;
  };

  if (!consolidado) {
    return null; // Não exibir para pedido de obra única
  }

  return (
    <Card className="p-3 bg-blue-50 border-blue-200 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Resumo Multi-Obra
          </p>
        </div>
        {getBadgeStatusNF()}
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white p-2 rounded border border-blue-100">
          <p className="text-blue-700 font-medium">Obras</p>
          <p className="text-lg font-bold text-blue-900">{obras.length}</p>
        </div>
        <div className="bg-white p-2 rounded border border-blue-100">
          <p className="text-blue-700 font-medium">Itens</p>
          <p className="text-lg font-bold text-blue-900">{itens.filter(i => i.material_id).length}</p>
        </div>
        <div className="bg-white p-2 rounded border border-blue-100">
          <p className="text-blue-700 font-medium">Rateados</p>
          <p className="text-lg font-bold text-blue-900">{itensComRateio.length}</p>
        </div>
        <div className="bg-white p-2 rounded border border-blue-100">
          <p className="text-blue-700 font-medium">Total Rateado</p>
          <p className="text-sm font-bold text-blue-900">
            R$ {totalRateado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Verificação de rateio completo */}
      <div className="space-y-2">
        {Math.abs(totalPedido - totalRateado) < 0.01 ? (
          <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-200 p-2 rounded">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Rateio completo — todos os itens distribuídos corretamente</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 p-2 rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Divergência: R$ {Math.abs(totalPedido - totalRateado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} não rateado
            </span>
          </div>
        )}
      </div>

      {/* Itens incompletos */}
      {itensIncompletos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-orange-800">
            {itensIncompletos.length} item(ns) com rateio incompleto:
          </p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {itensIncompletos.map((item, idx) => {
              const rateado = calcularRateioPorItem(item);
              return (
                <div key={idx} className="text-xs bg-white p-1.5 rounded border border-orange-100 text-orange-900">
                  <span className="font-medium">
                    {item.descricao || item.material_nome || 'Sem nome'}
                  </span>
                  <br />
                  <span className="text-orange-700">
                    Total: {item.quantidade_pedida} | Rateado: {rateado.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Obras listadas */}
      {obras.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-blue-800">Obras incluídas:</p>
          <div className="flex flex-wrap gap-1">
            {obras.map((obra) => (
              <Badge key={obra.id} variant="outline" className="text-xs bg-white border-blue-300">
                <Building2 className="w-3 h-3 mr-1" />
                {obra.nome}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}