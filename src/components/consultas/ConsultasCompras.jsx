import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FiltrosConsulta from './FiltrosConsulta';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConsultasCompras({ obraId }) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState({
    status: '',
    dataDe: '',
    dataAte: '',
    fornecedor: '',
    valorMin: '',
    valorMax: ''
  });

  const itensPorPagina = 10;

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const ocs = await base44.entities.OrdemCompra.filter({ obra_id: obraId });
      let filtered = ocs || [];

      if (filtros.status) {
        filtered = filtered.filter(oc => oc.status === filtros.status);
      }
      if (filtros.fornecedor) {
        filtered = filtered.filter(oc =>
          oc.fornecedor_nome?.toLowerCase().includes(filtros.fornecedor.toLowerCase())
        );
      }
      if (filtros.valorMin) {
        filtered = filtered.filter(oc => oc.valor_total >= parseFloat(filtros.valorMin));
      }
      if (filtros.valorMax) {
        filtered = filtered.filter(oc => oc.valor_total <= parseFloat(filtros.valorMax));
      }

      setDados(filtered);
      setPagina(0);
    } finally {
      setCarregando(false);
    }
  };

  const limparFiltros = () => {
    setFiltros({
      status: '',
      dataDe: '',
      dataAte: '',
      fornecedor: '',
      valorMin: '',
      valorMax: ''
    });
    setPagina(0);
  };

  const paginado = dados.slice(pagina * itensPorPagina, (pagina + 1) * itensPorPagina);
  const totalPaginas = Math.ceil(dados.length / itensPorPagina);

  return (
    <div className="space-y-4">
      <FiltrosConsulta
        filtros={filtros}
        onMudanca={(campo, valor) => setFiltros({ ...filtros, [campo]: valor })}
        onLimpar={limparFiltros}
      />

      <div className="text-sm text-gray-600">
        Mostrando {dados.length} ordem(ns) de compra
      </div>

      {carregando ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <>
          <div className="space-y-2">
            {paginado.map(oc => (
              <Card key={oc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Número</p>
                      <p className="font-semibold">{oc.numero}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Fornecedor</p>
                      <p className="font-semibold">{oc.fornecedor_nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Valor</p>
                      <p className="font-semibold">R$ {oc.valor_total?.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <p className={`font-semibold text-sm ${
                        oc.status === 'aprovada' ? 'text-green-600' :
                        oc.status === 'recebida' ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>
                        {oc.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Entrega</p>
                      <p className="font-semibold">{oc.status_entrega}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.max(0, p - 1))}
                disabled={pagina === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <span className="text-sm text-gray-600">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={pagina === totalPaginas - 1}
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}