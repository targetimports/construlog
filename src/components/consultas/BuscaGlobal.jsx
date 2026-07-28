import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BuscaGlobal({ obraId, onResultado }) {
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (termo.length >= 2) {
        buscar();
      } else {
        setResultados(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [termo]);

  const buscar = async () => {
    try {
      setCarregando(true);
      setErro('');
      const { data } = await base44.functions.invoke('searchGlobal', {
        obra_id: obraId,
        termo
      });
      setResultados(data);
      onResultado?.(data);
    } catch (error) {
      setErro('Erro na busca');
      setResultados(null);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar OC, NF, Medição, Movimento..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          className="pl-10"
          autoFocus
        />
        {carregando && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-blue-600" />}
      </div>

      {erro && <div className="text-sm text-red-600">{erro}</div>}

      {resultados && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Ordens de Compra */}
          {resultados.resultados.ordens_compra?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ordens de Compra ({resultados.resultados.ordens_compra.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultados.resultados.ordens_compra.map(oc => (
                  <div key={oc.id} className="p-2 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer">
                    <p className="font-semibold text-sm">{oc.numero}</p>
                    <p className="text-xs text-gray-600">{oc.fornecedor_nome}</p>
                    <p className="text-xs text-gray-500">R$ {oc.valor_total?.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notas Fiscais */}
          {resultados.resultados.notas_fiscais?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notas Fiscais ({resultados.resultados.notas_fiscais.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultados.resultados.notas_fiscais.map(nf => (
                  <div key={nf.id} className="p-2 bg-gray-50 rounded hover:bg-green-50 cursor-pointer">
                    <p className="font-semibold text-sm">{nf.numero_nf}</p>
                    <p className="text-xs text-gray-600">{nf.descricao}</p>
                    <p className="text-xs text-gray-500">R$ {nf.valor_bruto?.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Medições */}
          {resultados.resultados.medicoes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Medições ({resultados.resultados.medicoes.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultados.resultados.medicoes.map(med => (
                  <div key={med.id} className="p-2 bg-gray-50 rounded hover:bg-purple-50 cursor-pointer">
                    <p className="font-semibold text-sm">{med.numero}</p>
                    <p className="text-xs text-gray-600">{med.status}</p>
                    <p className="text-xs text-gray-500">R$ {med.valor_total_realizado?.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Contas */}
          {resultados.resultados.contas?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contas ({resultados.resultados.contas.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultados.resultados.contas.map(conta => (
                  <div key={conta.id} className="p-2 bg-gray-50 rounded hover:bg-yellow-50 cursor-pointer">
                    <p className="font-semibold text-sm">{conta.descricao?.substring(0, 30)}</p>
                    <p className="text-xs text-gray-600">{conta.status}</p>
                    <p className="text-xs text-gray-500">R$ {conta.valor?.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Movimentações */}
          {resultados.resultados.movimentacoes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Movimentações ({resultados.resultados.movimentacoes.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultados.resultados.movimentacoes.map(mov => (
                  <div key={mov.id} className="p-2 bg-gray-50 rounded hover:bg-orange-50 cursor-pointer">
                    <p className="font-semibold text-sm">{mov.descricao_insumo?.substring(0, 25)}</p>
                    <p className="text-xs text-gray-600">{mov.tipo}</p>
                    <p className="text-xs text-gray-500">Qtd: {mov.quantidade}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Receitas */}
          {resultados.resultados.receitas?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Receitas ({resultados.resultados.receitas.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultados.resultados.receitas.map(rec => (
                  <div key={rec.id} className="p-2 bg-gray-50 rounded hover:bg-pink-50 cursor-pointer">
                    <p className="font-semibold text-sm">{rec.descricao?.substring(0, 30)}</p>
                    <p className="text-xs text-gray-600">{rec.status}</p>
                    <p className="text-xs text-gray-500">R$ {rec.valor_liquido?.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {resultados && resultados.total === 0 && termo.length >= 2 && (
        <div className="text-center text-gray-500 py-8">
          Nenhum resultado encontrado para "{termo}"
        </div>
      )}
    </div>
  );
}