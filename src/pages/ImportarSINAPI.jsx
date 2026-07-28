import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Database, AlertCircle, Loader2, CheckCircle2, X, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const PREVIEW_POR_PAGINA = 10;

// Converte célula (número ou texto BR "1.234,56") em número.
const toNum = (v) => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  let s = String(v).trim().replace(/r\$/i, '').replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

const txt = (v) => (v == null ? '' : String(v).trim());
const norm = (v) => txt(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Detecta UF, mês de referência e desoneração a partir do nome do arquivo.
// Ex.: SINAPI_Preco_Ref_Insumos_BA_202412_Desonerado.xlsx
const metaDoNome = (nome = '') => {
  const meta = {};
  const uf = nome.match(/_([A-Z]{2})_\d{6}/);
  if (uf) meta.estado = uf[1];
  const dt = nome.match(/_(\d{4})(\d{2})_/);
  if (dt) meta.mes_referencia = `${dt[2]}/${dt[1]}`;
  if (/desonerad/i.test(nome)) meta.desonerado = !/nao[_\s-]?desonerad|n[aã]o desonerad/i.test(nome);
  return meta;
};

// Matchers de coluna por tipo. As listas estão em ordem de PRIORIDADE: a coluna
// específica ("...DA COMPOSIÇÃO" / "...DO INSUMO") vence a genérica — importante
// porque o arquivo de composições tem colunas de Agrupador/Classe antes da
// composição (ex.: CODIGO DO AGRUPADOR vem antes de CODIGO DA COMPOSICAO).
const COLS = {
  insumo: {
    codigo: [/cod.*insumo/, /^codigo/, /\bcod/],
    descricao: [/descri.*insumo/, /descri/],
    unidade: [/unidade/, /^und?$/, /^un$/, /unid/],
    preco: [/pre[cç]o.*median/, /custo.*total/, /pre[cç]o/, /custo/, /valor/],
  },
  composicao: {
    codigo: [/cod.*composi/, /^codigo/, /\bcod/],
    descricao: [/descri.*composi/, /descri/],
    unidade: [/unidade/, /^und?$/, /^un$/, /unid/],
    preco: [/custo.*total/, /pre[cç]o.*median/, /custo/, /pre[cç]o/, /valor/],
  },
};

// Dada a lista de células (já normalizadas) e regexes em ordem de prioridade,
// devolve o índice da primeira coluna que casa com o regex de maior prioridade.
const pickCol = (cells, regexes) => {
  for (const re of regexes) {
    const idx = cells.findIndex((c) => re.test(c));
    if (idx !== -1) return idx;
  }
  return -1;
};

// Acha a linha de cabeçalho (tem código + descrição + preço) e mapeia colunas.
function detectarColunas(aoa, tipo) {
  const M = COLS[tipo];
  const limite = Math.min(aoa.length, 40);
  for (let r = 0; r < limite; r++) {
    const cells = (aoa[r] || []).map(norm);
    const idxCodigo = pickCol(cells, M.codigo);
    const idxDescr = pickCol(cells, M.descricao);
    const idxPreco = pickCol(cells, M.preco);
    if (idxCodigo === -1 || idxDescr === -1 || idxPreco === -1) continue;
    const idxUnidade = pickCol(cells, M.unidade);
    return { headerRow: r, idxCodigo, idxDescr, idxUnidade, idxPreco };
  }
  return null;
}

function parsePlanilha(aoa, tipo, meta) {
  const cols = detectarColunas(aoa, tipo);
  if (!cols) {
    throw new Error('Não consegui identificar as colunas (código, descrição, preço). Verifique se é o arquivo oficial da SINAPI.');
  }
  const registros = [];
  for (let r = cols.headerRow + 1; r < aoa.length; r++) {
    const linha = aoa[r] || [];
    const codigo = txt(linha[cols.idxCodigo]);
    const descricao = txt(linha[cols.idxDescr]);
    const preco = toNum(linha[cols.idxPreco]);
    if (!codigo || !descricao) continue;
    if (!/\d/.test(codigo)) continue; // ignora cabeçalhos repetidos / linhas-título
    registros.push({
      codigo,
      codigo_sinapi: codigo,
      descricao,
      unidade: cols.idxUnidade !== -1 ? txt(linha[cols.idxUnidade]) : '',
      preco_unitario: preco,
      tipo,
      fonte: 'SINAPI',
      estado: meta.estado || '',
      mes_referencia: meta.mes_referencia || '',
      desonerado: meta.desonerado ?? true,
    });
  }
  return { registros, cols };
}

export default function ImportarSINAPI() {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null); // { tipo, registros, cols, nomeArquivo }
  const [erro, setErro] = useState(null); // { nomeArquivo, mensagem }
  const [previewPagina, setPreviewPagina] = useState(1);
  const [meta, setMeta] = useState({ estado: 'BA', mes_referencia: '12/2024', desonerado: true });
  const inputInsumosRef = useRef(null);
  const inputComposicoesRef = useRef(null);

  const TIPO_LABEL = { insumo: 'Insumos', composicao: 'Composições' };

  const handleArquivo = async (event, tipo) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!file) return;

    setErro(null);
    setPreview(null);

    try {
      const metaArquivo = { ...meta, ...metaDoNome(file.name) };
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      if (!ws) throw new Error('A planilha está vazia ou em um formato não suportado.');
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const { registros } = parsePlanilha(aoa, tipo, metaArquivo);

      if (registros.length === 0) {
        throw new Error('Nenhum item válido foi encontrado nas linhas do arquivo. Verifique se é o arquivo correto (preços por UF).');
      }
      setMeta(metaArquivo);
      setPreview({ tipo, registros, nomeArquivo: file.name });
      setPreviewPagina(1);
      toast.success(`${registros.length} ${TIPO_LABEL[tipo].toLowerCase()} lidos. Revise e confirme a importação.`);
    } catch (error) {
      setErro({ nomeArquivo: file.name, mensagem: error.message });
      toast.error('Falha ao ler o arquivo SINAPI', { description: error.message, duration: 8000 });
    }
  };

  const confirmarImportacao = async () => {
    if (!preview) return;
    setImporting(true);
    setProgress(0);
    try {
      // aplica metadados (possivelmente ajustados pelo usuário) aos registros
      const registros = preview.registros.map((r) => ({
        ...r,
        estado: meta.estado || r.estado,
        mes_referencia: meta.mes_referencia || r.mes_referencia,
        desonerado: meta.desonerado,
      }));

      const batchSize = 200;
      let inseridos = 0;
      for (let i = 0; i < registros.length; i += batchSize) {
        const batch = registros.slice(i, i + batchSize);
        await base44.entities.TabelaSINAPI.bulkCreate(batch);
        inseridos += batch.length;
        setProgress(Math.round((inseridos / registros.length) * 100));
      }
      queryClient.invalidateQueries({ queryKey: ['tabela-sinapi'] });
      toast.success(`${inseridos} ${TIPO_LABEL[preview.tipo].toLowerCase()} importados com sucesso!`);
      setPreview(null);
    } catch (error) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Tabela SINAPI</h1>
        <p className="text-gray-500 mt-1">
          Importe os preços oficiais da SINAPI (insumos e composições) para usar como referência em orçamentos.
        </p>
      </div>

      {/* Configuração dos metadados */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-900">Referência</CardTitle>
          <CardDescription className="text-gray-500">Detectada automaticamente pelo nome do arquivo — ajuste se necessário.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-600">Estado (UF)</Label>
              <Input value={meta.estado} onChange={(e) => setMeta({ ...meta, estado: e.target.value.toUpperCase().slice(0, 2) })} placeholder="BA" className="mt-1" maxLength={2} />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Mês de Referência</Label>
              <Input value={meta.mes_referencia} onChange={(e) => setMeta({ ...meta, mes_referencia: e.target.value })} placeholder="12/2024" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Desoneração</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant={meta.desonerado ? 'default' : 'outline'} className={meta.desonerado ? 'flex-1 bg-blue-600 hover:bg-blue-700' : 'flex-1 border-gray-300 text-gray-700'} onClick={() => setMeta({ ...meta, desonerado: true })}>Desonerado</Button>
                <Button type="button" variant={!meta.desonerado ? 'default' : 'outline'} className={!meta.desonerado ? 'flex-1 bg-blue-600 hover:bg-blue-700' : 'flex-1 border-gray-300 text-gray-700'} onClick={() => setMeta({ ...meta, desonerado: false })}>Não Deson.</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de upload */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-white border-gray-200 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <Database className="w-5 h-5 text-blue-600 shrink-0" /> Preços de Insumos
            </CardTitle>
            <CardDescription className="text-gray-500 text-xs break-words">Ex.: SINAPI_Preco_Ref_Insumos_BA_202412_Desonerado.xlsx</CardDescription>
          </CardHeader>
          <CardContent>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => handleArquivo(e, 'insumo')} disabled={importing} className="hidden" ref={inputInsumosRef} />
            <Button variant="outline" className="w-full gap-2 border-gray-300 text-gray-700" disabled={importing} onClick={() => inputInsumosRef.current?.click()}>
              <Upload className="w-4 h-4" /> Selecionar Arquivo de Insumos
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <Database className="w-5 h-5 text-purple-600 shrink-0" /> Composições Sintéticas
            </CardTitle>
            <CardDescription className="text-gray-500 text-xs break-words">Ex.: SINAPI_Custo_Ref_Composicoes_Sintetico_BA_202412_Desonerado.xlsx</CardDescription>
          </CardHeader>
          <CardContent>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => handleArquivo(e, 'composicao')} disabled={importing} className="hidden" ref={inputComposicoesRef} />
            <Button variant="outline" className="w-full gap-2 border-gray-300 text-gray-700" disabled={importing} onClick={() => inputComposicoesRef.current?.click()}>
              <Upload className="w-4 h-4" /> Selecionar Arquivo de Composições
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Erro de leitura */}
      {erro && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">Não foi possível ler este arquivo</p>
                  <p className="text-red-700 break-all text-xs mb-2">{erro.nomeArquivo}</p>
                  <p>{erro.mensagem}</p>
                  <p className="mt-2 text-xs text-red-700">
                    Use o arquivo de preços <strong>por estado (UF)</strong> da SINAPI — Insumos
                    (<em>SINAPI_Preco_Ref_Insumos_UF_AAAAMM…</em>) ou Composições Sintéticas
                    (<em>SINAPI_Custo_Ref_Composicoes_Sintetico_UF_AAAAMM…</em>). Os relatórios de
                    Famílias/Coeficientes, Manutenções e Mão de Obra não contêm preços e não são suportados aqui.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => setErro(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview / confirmação */}
      {preview && (
        <Card className="bg-white border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-start gap-2 text-base text-gray-900">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <span>{preview.registros.length} {TIPO_LABEL[preview.tipo].toLowerCase()} prontos para importar</span>
              </CardTitle>
              {!importing && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600" onClick={() => setPreview(null)}><X className="w-4 h-4" /></Button>
              )}
            </div>
            <CardDescription className="text-gray-500 text-xs truncate">{preview.nomeArquivo}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const total = preview.registros.length;
              const totalPaginas = Math.max(1, Math.ceil(total / PREVIEW_POR_PAGINA));
              const pagAtual = Math.min(previewPagina, totalPaginas);
              const inicio = (pagAtual - 1) * PREVIEW_POR_PAGINA;
              const pageItens = preview.registros.slice(inicio, inicio + PREVIEW_POR_PAGINA);
              return (
                <>
                  {/* Mobile: cards */}
                  <div className="sm:hidden space-y-2">
                    {pageItens.map((r, i) => (
                      <div key={inicio + i} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-xs text-gray-700">{r.codigo}</p>
                          <p className="text-sm font-semibold tabular-nums text-gray-900 shrink-0">R$ {r.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <p className="text-xs text-gray-800 mt-1 break-words">{r.descricao}</p>
                        <p className="text-[11px] text-gray-500 mt-1">Un.: {r.unidade || '—'}</p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: tabela */}
                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 text-gray-500">
                        <th className="text-left p-2">Código</th>
                        <th className="text-left p-2">Descrição</th>
                        <th className="text-center p-2">Un.</th>
                        <th className="text-right p-2">Preço (R$)</th>
                      </tr></thead>
                      <tbody>
                        {pageItens.map((r, i) => (
                          <tr key={inicio + i} className="border-t border-gray-100">
                            <td className="p-2 font-mono text-gray-700">{r.codigo}</td>
                            <td className="p-2 text-gray-800 max-w-md truncate">{r.descricao}</td>
                            <td className="p-2 text-center text-gray-600">{r.unidade || '—'}</td>
                            <td className="p-2 text-right tabular-nums text-gray-900">{r.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <span className="text-xs text-gray-500">Mostrando {inicio + 1}–{Math.min(inicio + PREVIEW_POR_PAGINA, total)} de {total}</span>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={importing || pagAtual <= 1} onClick={() => setPreviewPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                      <span className="text-xs text-gray-600 whitespace-nowrap">Página {pagAtual} de {totalPaginas}</span>
                      <Button variant="outline" size="sm" disabled={importing || pagAtual >= totalPaginas} onClick={() => setPreviewPagina((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </>
              );
            })()}

            <p className="text-xs text-gray-500">
              Referência aplicada: <strong>{meta.estado || '—'}</strong> · <strong>{meta.mes_referencia || '—'}</strong> · {meta.desonerado ? 'Desonerado' : 'Não Desonerado'}
            </p>

            {importing && <Progress value={progress} className="h-2" />}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={confirmarImportacao} disabled={importing} className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {importing ? `Importando... ${progress}%` : `Importar ${preview.registros.length} itens`}
              </Button>
              {!importing && <Button variant="outline" onClick={() => setPreview(null)} className="border-gray-300 text-gray-700 w-full sm:w-auto">Cancelar</Button>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Importante:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use os arquivos oficiais da SINAPI (.xlsx) — insumos e composições sintéticas.</li>
                <li>O sistema lê o arquivo localmente (sem IA): detecta as colunas de código, descrição, unidade e preço automaticamente.</li>
                <li>Os itens importados aparecem na rota <strong>Tabela SINAPI</strong> e ficam disponíveis como referência de preços nos orçamentos.</li>
                <li>Reimportar o mesmo arquivo adiciona os itens novamente (pode duplicar).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
