import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FiltrosConsulta from './FiltrosConsulta';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConsultasMedicoes({ obraId }) {
  const [medicoes, setMedicoes] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [aba, setAba] = useState('medicoes');
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState({
    status: '',
    dataDe: '',
    dataAte: '',
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
      const [meds, recs] = await Promise.all([
        base44.entities.Medicao.filter({ obra_id: obraId }),
        base44.entities.ReceitaObra.filter({ obra_id: obraId })
      ]);

      let meds_filtered = meds || [];
      let recs_filtered = recs || [];

      if (filtros.status) {
        meds_filtered = meds_filtered.filter(m => m.status === filtros.status);
        recs_filtered = recs_filtered.filter(r => r.status === filtros.status);
      }

      setMedicoes(meds_filtered);
      setReceitas(recs_filtered);
      setPagina(0);
    } finally {
      setCarregando(false);
    }
  };

  const dados = aba === 'medicoes' ? medicoes : receitas;
  const paginado = dados.slice(pagina * itensPorPagina, (pagina + 1) * itensPorPagina);
  const totalPaginas = Math.ceil(dados.length / itensPorPagina);

  return (
    <div className="space-y-4">
      <FiltrosConsulta
        filtros={filtros}
        onMudanca={(campo, valor) => setFiltros({ ...filtros, [campo]: valor })}
        onLimpar={() => {
          setFiltros({ status: '', dataDe: '', dataAte: '', valorMin: '', valorMax: '' });
          setPagina(0);
        }}
      />

      <div className="flex gap-2">
        <Button
          variant={aba === 'medicoes' ? 'default' : 'outline'}
          onClick={() => { setAba('medicoes'); setPagina(0); }}
        >
          Medições ({medicoes.length})
        </Button>
        <Button
          variant={aba === 'receitas' ? 'default' : 'outline'}
          onClick={() => { setAba('receitas'); setPagina(0); }}
        >
          Receitas ({receitas.length})
        </Button>
      </div>

      {carregando ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <>
          <div className="space-y-2">
            {paginado.map(item => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">{aba === 'medicoes' ? 'Número Med.' : 'Descrição'}</p>
                      <p className="font-semibold">{item.numero || item.descricao}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tipo</p>
                      <p className="font-semibold">{item.tipo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Valor</p>
                      <p className="font-semibold">
                        R$ {(item.valor_total_realizado || item.valor_liquido)?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <p className={`font-semibold text-sm ${
                        item.status === 'faturada' || item.status === 'recebido' ? 'text-green-600' :
                        item.status === 'aprovada' ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>
                        {item.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Data</p>
                      <p className="font-semibold">{new Date(item.data_medicao || item.data_emissao).toLocaleDateString('pt-BR')}</p>
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