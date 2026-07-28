import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle, AlertCircle, X, Loader2, Search, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Versão compacta p/ telas pequenas: R$ 5,4 mi
const fmtBRLcompact = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
  });

// ── Tabela dinâmica por período ──
function TabelaCronograma({ itens, periodosLabels }) {
  const [busca, setBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');

  const grupos = useMemo(() => itens.filter(i => i.is_grupo), [itens]);

  const itensFiltrados = useMemo(() => {
    return itens.filter(i => {
      if (filtroGrupo) {
        if (i.is_grupo  && i.item !== filtroGrupo) return false;
        if (!i.is_grupo && !i.item.startsWith(filtroGrupo + '.')) return false;
      }
      if (busca) {
        const b = busca.toLowerCase();
        return i.descricao.toLowerCase().includes(b) || i.item.toLowerCase().includes(b);
      }
      return true;
    });
  }, [itens, busca, filtroGrupo]);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar descrição..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-white w-full sm:w-auto sm:max-w-[16rem] truncate"
          value={filtroGrupo}
          onChange={e => setFiltroGrupo(e.target.value)}
        >
          <option value="">Todos os grupos</option>
          {grupos.map(g => (
            <option key={g.item} value={g.item}>{g.item} – {g.descricao.slice(0, 40)}</option>
          ))}
        </select>
        {(busca || filtroGrupo) && (
          <Button variant="ghost" size="sm" onClick={() => { setBusca(''); setFiltroGrupo(''); }}>
            <X className="w-4 h-4" /> Limpar
          </Button>
        )}
      </div>

      {/* Tabela com scroll horizontal */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm" style={{ minWidth: `${280 + periodosLabels.length * 130}px` }}>
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 md:px-3 py-2 text-left font-semibold w-20 sticky left-0 z-20 bg-gray-50 border-r border-gray-200">Item</th>
              <th className="px-2 md:px-3 py-2 text-left font-semibold min-w-[150px] md:min-w-[200px] sticky left-[80px] z-20 bg-gray-50 border-r border-gray-200">Descrição</th>
              {periodosLabels.map(label => (
                <th key={label} className="px-2 md:px-3 py-2 text-right font-semibold whitespace-nowrap text-xs">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map((item) => {
              const isGrupo = item.is_grupo;
              return (
                <tr
                  key={item.item + '-' + item.ordem}
                  className={isGrupo
                    ? 'bg-blue-50 font-semibold border-t-2 border-blue-200'
                    : 'hover:bg-gray-50 border-t border-gray-100'}
                >
                  <td className={`px-2 md:px-3 py-2 font-mono text-xs text-gray-500 sticky left-0 z-10 border-r border-gray-100 align-top ${isGrupo ? 'bg-blue-50' : 'bg-white'}`}>
                    {item.item}
                  </td>
                  <td
                    className={`px-2 md:px-3 py-2 sticky left-[80px] z-10 border-r border-gray-100 align-top ${isGrupo ? 'bg-blue-50 text-blue-800' : 'bg-white text-gray-800'}`}
                    style={{ paddingLeft: isGrupo ? undefined : `${(item.nivel - 1) * 12 + 12}px` }}
                  >
                    {item.descricao}
                  </td>
                  {periodosLabels.map(label => {
                    const p = item.periodos?.[label];
                    if (!p || (p.percent === 0 && p.valor === 0)) {
                      return <td key={label} className="px-2 md:px-3 py-2 text-right text-gray-200 text-xs align-top">—</td>;
                    }
                    return (
                      <td key={label} className="px-2 md:px-3 py-2 text-right align-top">
                        {p.percent > 0 && (
                          <div className="text-xs text-blue-600 font-semibold">
                            {p.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                          </div>
                        )}
                        {p.valor > 0 && (
                          <div className="text-xs text-gray-700">{fmtBRL(p.valor)}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {itensFiltrados.length === 0 && (
          <p className="text-center py-6 text-gray-500 text-sm">Nenhum item encontrado.</p>
        )}
      </div>
      <p className="text-xs text-gray-400">{itensFiltrados.length} linha(s) de {itens.length}</p>
    </div>
  );
}

// ── Resumo por período ──
function ResumoPeriodos({ meta, periodosLabels }) {
  const chartData = useMemo(() =>
    periodosLabels.map(label => ({
      periodo: label.replace(' DIAS', 'd').replace('° Período', 'P'),
      valor: meta?.total_por_periodo?.[label]?.valor || 0,
      label
    })), [meta, periodosLabels]);

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {periodosLabels.map(label => {
          const p = meta?.total_por_periodo?.[label] || {};
          return (
            <div key={label} className="bg-blue-50 border border-blue-100 rounded-lg p-3 min-w-0">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{label}</p>
              <p className="text-sm font-bold text-gray-800 mt-1 tabular-nums truncate">
                <span className="sm:hidden">{fmtBRLcompact(p.valor || 0)}</span>
                <span className="hidden sm:inline">{fmtBRL(p.valor || 0)}</span>
              </p>
              {p.percent > 0 && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {p.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Gráfico de barras */}
      {chartData.some(d => d.valor > 0) && (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Custo por período</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [fmtBRL(v), 'Valor']}
                labelFormatter={(_v, payload) => payload?.[0]?.payload?.label || ''}
              />
              <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──
export default function Etapa2CronogramaUpload({ onDadosCarregados, obraId, dadosIniciais }) {
  const [arquivo, setArquivo] = useState(dadosIniciais?.arquivo || null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(
    dadosIniciais?.itens
      ? { sucesso: true, itens: dadosIniciais.itens, periodos_labels: dadosIniciais.periodos_labels, meta: dadosIniciais.meta, resumo: dadosIniciais.resumo }
      : null,
  );
  const [erro, setErro] = useState(null);
  const [erroDebug, setErroDebug] = useState(null);

  const limpar = () => {
    setArquivo(null);
    setLoading(false);
    setResultado(null);
    setErro(null);
    setErroDebug(null);
  };

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Selecione um arquivo .xlsx ou .xls');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Limite: 10 MB.');
      return;
    }

    limpar();
    setArquivo(file.name);
    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
      setErro('Timeout: processamento demorou mais de 40s. Tente novamente.');
    }, 40000);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importarCronogramaFisFinan', {
        file_url,
        arquivo_nome: file.name,
        obra_id: obraId || null,
        salvar_banco: false   // preview apenas; salvar será feito na confirmação final
      });

      if (!res.data?.sucesso) {
        const errMsg = res.data?.error || 'Erro ao processar arquivo';
        throw new Error(errMsg);
      }

      setResultado(res.data);
      
      // Extrair atividades (itens não-grupo com pelo menos 1 período)
      // Para CFF do OrçaFascio, datas são aproximadas pelo índice do período
      const periodos = res.data.periodos_labels || [];
      const atividades = (res.data.itens || [])
        .filter(item => !item.is_grupo && item.descricao)
        .map(item => {
          // Encontrar primeiro e último período com valor > 0
          let primeiroIdx = periodos.length;
          let ultimoIdx = -1;
          periodos.forEach((label, idx) => {
            const p = item.periodos?.[label];
            if (p && (p.percent > 0 || p.valor > 0)) {
              if (idx < primeiroIdx) primeiroIdx = idx;
              if (idx > ultimoIdx) ultimoIdx = idx;
            }
          });
          if (ultimoIdx === -1) { primeiroIdx = 0; ultimoIdx = periodos.length > 0 ? periodos.length - 1 : 0; }

          // Datas sintéticas: usar item.data_inicio se existir, senão calcular por período
          const dataInicio = item.data_inicio || null;
          const dataFim = item.data_fim || null;

          return {
            nomeAtividade: item.descricao,
            dataInicioPlanejada: dataInicio,
            dataFimPlanejada: dataFim,
            quantidadePlanejada: item.total_valor > 0 ? item.total_valor : 1,
            und: item.und || 'vb',
            periodoInicio: periodos[primeiroIdx] || null,
            periodoFim: periodos[ultimoIdx] || null,
          };
        });

      console.log(`Cronograma parseado: ${atividades.length} atividades de ${res.data.itens?.length || 0} itens`);

      onDadosCarregados({
        arquivo: file.name,
        itens: res.data.itens,
        periodos_labels: res.data.periodos_labels,
        meta: res.data.meta,
        resumo: res.data.resumo,
        atividades,
        totalAtividadesParseadas: atividades.length
      });

      toast.success(
        `Cronograma: ${atividades.length} atividades detectadas`
      );
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Erro desconhecido';
      const statusCode = err?.response?.status;
      const fullMsg = statusCode ? `${serverMsg} (HTTP ${statusCode})` : serverMsg;
      setErro(fullMsg);
      setErroDebug(err?.response?.data?.debug || null);
      toast.error(fullMsg);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Etapa 2: Cronograma Físico-Financeiro</h2>
        <p className="text-sm text-gray-500 mb-4">
          Opcional — selecione a planilha do Cronograma Físico-Financeiro exportada do OrçaFascio.
          O sistema detecta automaticamente as colunas de período.
        </p>

        {!loading && !resultado && (
          <>
            <label
              htmlFor="cff-file"
              className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Calendar className="w-10 h-10 text-gray-400 mb-3" />
              <p className="font-medium text-gray-700">Clique para selecionar o arquivo</p>
              <p className="text-xs text-gray-400 mt-1">ou arraste aqui · .xlsx / .xls</p>
            </label>
            <input id="cff-file" type="file" accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleChange} />
            <p className="text-xs text-gray-400 mt-3 text-center">
              Você pode avançar sem importar o cronograma.
            </p>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-10 bg-blue-50 border border-blue-200 rounded-xl">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
            <p className="font-semibold text-blue-900">Processando {arquivo}…</p>
            <p className="text-xs text-blue-600 mt-1">Detectando cabeçalho e colunas de período</p>
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-5">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Erro ao processar planilha</p>
                <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{erro}</p>
                {erroDebug && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-700 underline cursor-pointer">Ver detalhes técnicos</summary>
                    <pre className="mt-2 text-xs bg-red-100 text-red-800 p-2 rounded overflow-x-auto">{JSON.stringify(erroDebug, null, 2)}</pre>
                  </details>
                )}
              </div>
            </div>
            <Button
              variant="outline" size="sm" className="mt-4 w-full"
              onClick={() => { limpar(); setTimeout(() => document.getElementById('cff-file')?.click(), 50); }}
            >
              Tentar novamente
            </Button>
            <input id="cff-file" type="file" accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleChange} />
          </div>
        )}
      </div>

      {resultado && (
        <>
          {/* Cabeçalho de sucesso */}
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-green-900 truncate">{arquivo}</p>
                <p className="text-xs text-green-700">
                  {resultado.resumo.linhas} linhas · {resultado.resumo.periodos} períodos
                  {resultado.meta?.total_geral > 0 && ` · ${fmtBRL(resultado.meta.total_geral)}`}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={() => {
              limpar();
              setTimeout(() => document.getElementById('cff-file')?.click(), 50);
            }}>
              <X className="w-4 h-4 mr-1" /> Trocar
            </Button>
            <input id="cff-file" type="file" accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleChange} />
          </div>

          {/* Resumo por período + gráfico */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <ResumoPeriodos
                meta={resultado.meta}
                periodosLabels={resultado.periodos_labels}
              />
            </CardContent>
          </Card>

          {/* Tabela completa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cronograma Completo</CardTitle>
            </CardHeader>
            <CardContent>
              <TabelaCronograma
                itens={resultado.itens}
                periodosLabels={resultado.periodos_labels}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}