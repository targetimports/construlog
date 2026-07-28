import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle, AlertCircle, X, Loader2, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

// ── Helpers ──
const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Versão compacta p/ telas pequenas: R$ 4,5 mi
const fmtBRLcompact = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
  });

// ── Card de resumo ──
function ResumoCard({ label, value, valueMobile, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-lg border p-3 sm:p-4 min-w-0 ${colors[color]}`}>
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide opacity-70 truncate">{label}</p>
      <p className="text-base sm:text-xl font-bold mt-1 tabular-nums leading-tight truncate">
        {valueMobile ? (
          <>
            <span className="sm:hidden">{valueMobile}</span>
            <span className="hidden sm:inline">{value}</span>
          </>
        ) : value}
      </p>
      {sub && <p className="text-[11px] sm:text-xs mt-1 opacity-60 truncate">{sub}</p>}
    </div>
  );
}

// ── Tabela de itens ──
function TabelaItens({ itens, meta }) {
  const [busca, setBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  // Grupos começam RECOLHIDOS: mostra só as etapas (linhas azuis); os itens
  // aparecem ao clicar no grupo. Deixa o orçamento navegável em vez de um paredão.
  const [expandidos, setExpandidos] = useState(() => new Set());

  const gruposRaiz = useMemo(() => itens.filter(i => i.is_grupo), [itens]);

  // Códigos de grupo e, para cada ITEM (folha), o grupo-pai (o grupo mais fundo
  // cujo código é prefixo do dele). Ex.: item "02.01.01.01" → grupo "02.01.01".
  const { grupoPaiDe, gruposComFilhos } = useMemo(() => {
    const codigosGrupo = new Set(itens.filter(i => i.is_grupo).map(i => String(i.item)));
    const paiDe = new Map();
    const comFilhos = new Set();
    for (const it of itens) {
      if (it.is_grupo) continue;
      let p = String(it.item);
      let pai = null;
      while (p.includes('.')) {
        p = p.slice(0, p.lastIndexOf('.'));
        if (codigosGrupo.has(p)) { pai = p; break; }
      }
      paiDe.set(String(it.item), pai);
      if (pai) comFilhos.add(pai);
    }
    return { grupoPaiDe: paiDe, gruposComFilhos: comFilhos };
  }, [itens]);

  const toggleGrupo = (codigo) => setExpandidos(prev => {
    const n = new Set(prev);
    n.has(codigo) ? n.delete(codigo) : n.add(codigo);
    return n;
  });

  const itensFiltrados = useMemo(() => {
    return itens.filter(i => {
      if (filtroGrupo) {
        if (i.is_grupo && i.item !== filtroGrupo) return false;
        if (!i.is_grupo && !i.item.startsWith(filtroGrupo + '.')) return false;
      }
      if (busca) {
        const b = busca.toLowerCase();
        return (
          i.descricao.toLowerCase().includes(b) ||
          i.item.toLowerCase().includes(b) ||
          (i.codigo || '').toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [itens, busca, filtroGrupo]);

  const totalGeral = meta?.total_geral || 1;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar descrição ou código..."
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
          {gruposRaiz.map(g => (
            <option key={g.item} value={g.item}>{g.item} – {g.descricao.slice(0, 40)}</option>
          ))}
        </select>
        {(busca || filtroGrupo) && (
          <Button variant="ghost" size="sm" onClick={() => { setBusca(''); setFiltroGrupo(''); }}>
            <X className="w-4 h-4" /> Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 md:px-3 py-2 text-left font-semibold w-14 md:w-20">Item</th>
              <th className="px-2 md:px-3 py-2 text-left font-semibold">Descrição</th>
              <th className="px-3 py-2 text-left font-semibold w-14 hidden md:table-cell">Und</th>
              <th className="px-3 py-2 text-right font-semibold w-20 hidden md:table-cell">Quant.</th>
              <th className="px-3 py-2 text-right font-semibold w-28 hidden md:table-cell">Valor Unit.</th>
              <th className="px-2 md:px-3 py-2 text-right font-semibold w-24 md:w-28">Total</th>
              {meta?.bdi_percent > 0 && (
                <th className="px-3 py-2 text-right font-semibold w-28 hidden md:table-cell">Unit. c/BDI</th>
              )}
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map((item) => {
              const isGrupo = item.is_grupo;
              // Com filtro/busca ativos mostramos tudo; sem filtro, itens só
              // aparecem se o grupo-pai estiver expandido.
              const filtroAtivo = !!(busca || filtroGrupo);
              if (!isGrupo && !filtroAtivo) {
                const pai = grupoPaiDe.get(String(item.item));
                if (pai && !expandidos.has(pai)) return null;
              }
              const temFilhos = isGrupo && gruposComFilhos.has(String(item.item));
              const aberto = expandidos.has(String(item.item));
              const pct = totalGeral > 0 && item.total > 0
                ? ` (${((item.total / totalGeral) * 100).toFixed(1)}%)`
                : '';
              return (
                <tr
                  key={item.item + '-' + item.ordem}
                  onClick={temFilhos ? () => toggleGrupo(String(item.item)) : undefined}
                  className={
                    isGrupo
                      ? `bg-blue-50 font-semibold border-t-2 border-blue-200 ${temFilhos ? 'cursor-pointer hover:bg-blue-100' : ''}`
                      : 'hover:bg-gray-50 border-t border-gray-100'
                  }
                >
                  <td className="px-2 md:px-3 py-2 font-mono text-xs text-gray-500 align-top">{item.item}</td>
                  <td className="px-2 md:px-3 py-2">
                    <span
                      style={{ paddingLeft: isGrupo ? 0 : `${(item.nivel - 1) * 12}px` }}
                      className={isGrupo ? 'text-blue-800 inline-flex items-center gap-1.5' : 'text-gray-800'}
                    >
                      {temFilhos && (
                        <ChevronDown className={`w-4 h-4 text-blue-500 shrink-0 transition-transform ${aberto ? '' : '-rotate-90'}`} />
                      )}
                      {item.descricao}
                    </span>
                    {item.codigo && (
                      <span className="ml-2 text-xs text-gray-400">{item.codigo}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{item.und}</td>
                  <td className="px-3 py-2 text-right text-gray-700 hidden md:table-cell">
                    {item.quantidade > 0 ? item.quantidade.toLocaleString('pt-BR') : ''}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 hidden md:table-cell">
                    {item.valor_unit > 0 ? fmtBRL(item.valor_unit) : ''}
                  </td>
                  <td className={`px-2 md:px-3 py-2 text-right font-semibold align-top tabular-nums ${isGrupo ? 'text-blue-700' : 'text-gray-800'}`}>
                    {item.total > 0 ? fmtBRL(item.total) : ''}
                    {isGrupo && item.total > 0 && (
                      <span className="ml-1 text-xs font-normal text-gray-400 hidden sm:inline">{pct}</span>
                    )}
                  </td>
                  {meta?.bdi_percent > 0 && (
                    <td className="px-3 py-2 text-right text-gray-500 hidden md:table-cell">
                      {item.valor_unit_bdi > 0 ? fmtBRL(item.valor_unit_bdi) : ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {itensFiltrados.length === 0 && (
          <p className="text-center py-6 text-gray-500 text-sm">Nenhum item encontrado com os filtros atuais.</p>
        )}
      </div>
      <p className="text-xs text-gray-400">{itensFiltrados.length} linha(s) de {itens.length}</p>
    </div>
  );
}

// ── Seção Destinação do Orçamento ──
function DestinacaoOrcamento({ itens, meta }) {
  const grupos = useMemo(() => {
    const g = itens.filter(i => i.is_grupo);
    const totalGeral = meta?.total_geral || g.reduce((s, x) => s + x.total, 0) || 1;
    return g
      .map(gr => ({
        ...gr,
        pct: totalGeral > 0 ? ((gr.total / totalGeral) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.total - a.total);
  }, [itens, meta]);

  if (grupos.length === 0) return (
    <p className="text-sm text-gray-500 italic">Nenhum grupo/etapa encontrado.</p>
  );

  return (
    <div className="space-y-3">
      {grupos.map(g => (
        <div key={g.item} className="flex items-center gap-3">
          <div className="w-8 text-xs font-mono text-gray-500 text-right flex-shrink-0">{g.item}</div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1 gap-2">
              <span className="text-xs sm:text-sm text-gray-700 truncate">{g.descricao}</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-800 flex-shrink-0 tabular-nums">
                <span className="sm:hidden">{fmtBRLcompact(g.total)}</span>
                <span className="hidden sm:inline">{fmtBRL(g.total)}</span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${g.pct}%` }}
              />
            </div>
          </div>
          <div className="w-12 text-right text-xs font-semibold text-blue-700 flex-shrink-0">{g.pct}%</div>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ──
export default function Etapa1SinteticoUpload({ onDadosCarregados, dadosIniciais }) {
  const [arquivo, setArquivo] = useState(dadosIniciais?.arquivo || null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(
    dadosIniciais?.itens ? { itens: dadosIniciais.itens, meta: dadosIniciais.meta, resumo: dadosIniciais.resumo } : null,
  );
  const [erro, setErro] = useState(null);
  const [erroDebug, setErroDebug] = useState(null);
  const timeoutRef = useRef(null);

  const limpar = () => {
    setArquivo(null);
    setLoading(false);
    setResultado(null);
    setErro(null);
    setErroDebug(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleArquivoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = /\.pdf$/i.test(file.name);
    if (!/\.(xlsx|xls|pdf)$/i.test(file.name)) {
      toast.error('Selecione um arquivo .xlsx, .xls ou .pdf');
      return;
    }
    const limiteMB = isPdf ? 25 : 10;
    if (file.size > limiteMB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Limite: ${limiteMB} MB.`);
      return;
    }

    limpar();
    setArquivo(file.name);
    setLoading(true);

    // PDF passa por IA (visão) e leva mais tempo que a planilha.
    const timeoutMs = isPdf ? 280000 : 40000;
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setErro(`Timeout: processamento demorou mais de ${timeoutMs / 1000} segundos. Tente novamente.`);
    }, timeoutMs);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const fn = isPdf ? 'importarOrcamentoPDF' : 'importarOrcamentoSintetico';
      const res = await base44.functions.invoke(fn, { file_url, arquivo_nome: file.name });

      if (!res.data?.sucesso) {
        throw new Error(res.data?.error || 'Erro ao processar arquivo');
      }

      const { itens, meta, resumo } = res.data;
      setResultado({ itens, meta, resumo });

      onDadosCarregados({
        arquivo: file.name,
        itens,
        meta,
        resumo,
        grupos: itens.filter(i => i.is_grupo),
        dados: itens
      });

      toast.success(`Orçamento carregado: ${resumo.total_grupos} etapas · ${resumo.total_itens} itens${isPdf ? ' (via IA — confira os valores)' : ''}`);
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Erro desconhecido';
      const statusCode = err?.response?.status;
      const fullMsg = statusCode ? `${serverMsg} (HTTP ${statusCode})` : serverMsg;
      setErro(fullMsg);
      setErroDebug(err?.response?.data?.debug || null);
      toast.error(fullMsg);
    } finally {
      clearTimeout(timeoutRef.current);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Etapa 1: Orçamento Sintético</h2>
        <p className="text-sm text-gray-500 mb-4">
          Selecione a planilha exportada do OrçaFascio (<code>.xlsx</code>) — método recomendado.
          Também aceita <code>.pdf</code> (lido por IA; <strong>confira os valores</strong> na revisão).
          O cabeçalho, metadados (Obra, BDI) e totais são detectados automaticamente.
        </p>

         {!loading && !resultado && (
          <>
            <label
              htmlFor="sintetico-file"
              className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Upload className="w-10 h-10 text-gray-400 mb-3" />
              <p className="font-medium text-gray-700">Clique para selecionar o arquivo</p>
              <p className="text-xs text-gray-400 mt-1">ou arraste aqui · .xlsx / .xls / .pdf</p>
            </label>
            <input
              id="sintetico-file"
              type="file"
              accept=".xlsx,.xls,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
              className="hidden"
              onChange={handleArquivoChange}
            />
            <p className="text-xs text-gray-400 mt-3">
              Colunas esperadas: <strong>Item</strong>, <strong>Descrição</strong>, <strong>Und</strong>, <strong>Quant.</strong>, <strong>Valor Unit.</strong>, <strong>Total</strong>.
              Linhas de título e BDI antes do cabeçalho são lidas automaticamente.
            </p>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-10 bg-blue-50 border border-blue-200 rounded-xl">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
            <p className="font-semibold text-blue-900">Processando {arquivo}…</p>
            <p className="text-xs text-blue-600 mt-1">Detectando cabeçalho, metadados e totais</p>
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
              onClick={() => { limpar(); setTimeout(() => document.getElementById('sintetico-file')?.click(), 50); }}
            >
              Tentar novamente
            </Button>
            <input id="sintetico-file" type="file" accept=".xlsx,.xls,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" className="hidden" onChange={handleArquivoChange} />
          </div>
        )}
      </div>

      {resultado && (
        <>
          {/* Arquivo carregado */}
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-green-900 truncate">{arquivo}</p>
                {resultado.meta?.nome_obra && (
                  <p className="text-xs text-green-700">Obra: {resultado.meta.nome_obra}</p>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={() => {
              limpar();
              setTimeout(() => document.getElementById('sintetico-file')?.click(), 50);
            }}>
              <X className="w-4 h-4 mr-1" /> Trocar
            </Button>
            <input id="sintetico-file" type="file" accept=".xlsx,.xls,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" className="hidden" onChange={handleArquivoChange} />
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResumoCard
              label="Total Geral"
              value={fmtBRL(resultado.meta?.total_geral)}
              valueMobile={fmtBRLcompact(resultado.meta?.total_geral)}
              color="green"
            />
            <ResumoCard
              label="BDI"
              value={resultado.meta?.bdi_percent > 0 ? `${resultado.meta.bdi_percent}%` : '—'}
              sub={resultado.meta?.total_bdi > 0 ? fmtBRL(resultado.meta.total_bdi) : undefined}
              color="amber"
            />
            <ResumoCard
              label="Sem BDI"
              value={resultado.meta?.total_sem_bdi > 0 ? fmtBRL(resultado.meta.total_sem_bdi) : '—'}
              valueMobile={resultado.meta?.total_sem_bdi > 0 ? fmtBRLcompact(resultado.meta.total_sem_bdi) : '—'}
              color="blue"
            />
            <ResumoCard
              label="Estrutura"
              value={`${resultado.resumo.total_grupos} etapas`}
              sub={`${resultado.resumo.total_itens} itens`}
              color="purple"
            />
          </div>

          {/* Destinação por Etapa */}
          {resultado.itens.filter(i => i.is_grupo).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Destinação do Orçamento por Etapa</CardTitle>
              </CardHeader>
              <CardContent>
                <DestinacaoOrcamento itens={resultado.itens} meta={resultado.meta} />
              </CardContent>
            </Card>
          )}

          {/* Tabela completa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Todas as Linhas do Orçamento</CardTitle>
            </CardHeader>
            <CardContent>
              <TabelaItens itens={resultado.itens} meta={resultado.meta} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}