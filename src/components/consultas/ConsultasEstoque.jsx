import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FiltrosConsulta from './FiltrosConsulta';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConsultasEstoque({ obraId }) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState({
    dataDe: '',
    dataAte: '',
    categoria: '',
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
      const movs = await base44.entities.MovimentacaoEstoque.filter({ obra_id: obraId });
      let filtered = movs || [];

      if (filtros.categoria) {
        filtered = filtered.filter(mov => mov.categoria === filtros.categoria);
      }

      setDados(filtered.sort((a, b) => new Date(b.data) - new Date(a.data)));
      setPagina(0);
    } finally {
      setCarregando(false);
    }
  };

  const limparFiltros = () => {
    setFiltros({
      dataDe: '',
      dataAte: '',
      categoria: '',
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
        Mostrando {dados.length} movimentação(ões)
      </div>

      {carregando ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <>
          <div className="space-y-2">
            {paginado.map(mov => (
              <Card key={mov.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Insumo</p>
                      <p className="font-semibold truncate">{mov.descricao_insumo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tipo</p>
                      <p className="font-semibold uppercase text-sm">{mov.tipo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Quantidade</p>
                      <p className="font-semibold">{mov.quantidade} {mov.unidade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Valor Total</p>
                      <p className="font-semibold">R$ {mov.valor_total?.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Data</p>
                      <p className="font-semibold">{new Date(mov.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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