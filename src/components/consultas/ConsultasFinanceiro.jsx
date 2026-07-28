import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FiltrosConsulta from './FiltrosConsulta';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConsultasFinanceiro({ obraId }) {
  const [nfs, setNfs] = useState([]);
  const [contas, setContas] = useState([]);
  const [aba, setAba] = useState('nfs');
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
      const [nfs_data, contas_data] = await Promise.all([
        base44.entities.NotaFiscal.filter({ obra_id: obraId }),
        base44.entities.ContaFinanceira.filter({ obra_id: obraId })
      ]);

      let nfs_filtered = nfs_data || [];
      let contas_filtered = contas_data || [];

      if (filtros.status) {
        nfs_filtered = nfs_filtered.filter(nf => nf.status === filtros.status);
        contas_filtered = contas_filtered.filter(c => c.status === filtros.status);
      }
      if (filtros.fornecedor) {
        nfs_filtered = nfs_filtered.filter(nf =>
          nf.descricao?.toLowerCase().includes(filtros.fornecedor.toLowerCase())
        );
      }

      setNfs(nfs_filtered);
      setContas(contas_filtered);
      setPagina(0);
    } finally {
      setCarregando(false);
    }
  };

  const dados = aba === 'nfs' ? nfs : contas;
  const paginado = dados.slice(pagina * itensPorPagina, (pagina + 1) * itensPorPagina);
  const totalPaginas = Math.ceil(dados.length / itensPorPagina);

  return (
    <div className="space-y-4">
      <FiltrosConsulta
        filtros={filtros}
        onMudanca={(campo, valor) => setFiltros({ ...filtros, [campo]: valor })}
        onLimpar={() => {
          setFiltros({
            status: '', dataDe: '', dataAte: '', fornecedor: '', valorMin: '', valorMax: ''
          });
          setPagina(0);
        }}
      />

      <div className="flex gap-2">
        <Button
          variant={aba === 'nfs' ? 'default' : 'outline'}
          onClick={() => { setAba('nfs'); setPagina(0); }}
        >
          Notas Fiscais ({nfs.length})
        </Button>
        <Button
          variant={aba === 'contas' ? 'default' : 'outline'}
          onClick={() => { setAba('contas'); setPagina(0); }}
        >
          Contas ({contas.length})
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
                      <p className="text-xs text-gray-600">{aba === 'nfs' ? 'Número NF' : 'Descrição'}</p>
                      <p className="font-semibold truncate">{item.numero_nf || item.descricao}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Fornecedor</p>
                      <p className="font-semibold text-sm truncate">{item.descricao || item.fornecedor_cliente}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Valor</p>
                      <p className="font-semibold">R$ {(item.valor_bruto || item.valor)?.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <p className={`font-semibold text-sm ${
                        item.status === 'pago' || item.status === 'recebido' ? 'text-green-600' :
                        item.status === 'pendente' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {item.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Data</p>
                      <p className="font-semibold">{new Date(item.data || item.data_vencimento).toLocaleDateString('pt-BR')}</p>
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