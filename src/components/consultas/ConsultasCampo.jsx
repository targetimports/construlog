import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FiltrosConsulta from './FiltrosConsulta';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConsultasCampo({ obraId }) {
  const [diarios, setDiarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState({
    dataDe: '',
    dataAte: '',
    status: ''
  });

  const itensPorPagina = 10;

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const diarios_data = await base44.entities.DiarioObra.filter({ obra_id: obraId });
      let filtered = diarios_data || [];

      if (filtros.status) {
        filtered = filtered.filter(d => d.status === filtros.status);
      }

      setDiarios(filtered.sort((a, b) => new Date(b.data) - new Date(a.data)));
      setPagina(0);
    } finally {
      setCarregando(false);
    }
  };

  const paginado = diarios.slice(pagina * itensPorPagina, (pagina + 1) * itensPorPagina);
  const totalPaginas = Math.ceil(diarios.length / itensPorPagina);

  return (
    <div className="space-y-4">
      <FiltrosConsulta
        filtros={{ status: filtros.status, dataDe: filtros.dataDe, dataAte: filtros.dataAte }}
        onMudanca={(campo, valor) => setFiltros({ ...filtros, [campo]: valor })}
        onLimpar={() => {
          setFiltros({ dataDe: '', dataAte: '', status: '' });
          setPagina(0);
        }}
      />

      <div className="text-sm text-gray-600">
        Mostrando {diarios.length} diário(s) de obra
      </div>

      {carregando ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <>
          <div className="space-y-2">
            {paginado.map(diario => (
              <Card key={diario.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Data</p>
                      <p className="font-semibold">{new Date(diario.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Clima</p>
                      <p className="font-semibold capitalize">{diario.clima || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Funcionários</p>
                      <p className="font-semibold">{diario.qtd_funcionarios || '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <p className={`font-semibold text-sm ${
                        diario.status === 'finalizado' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {diario.status}
                      </p>
                    </div>
                  </div>
                  {diario.observacoes && (
                    <p className="text-sm text-gray-600 mt-3 border-t pt-3">
                      {diario.observacoes.substring(0, 100)}...
                    </p>
                  )}
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