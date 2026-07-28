import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ehPresenca, ehMeioPeriodo, JORNADA_DIA } from '@/lib/presenca';

const POR_PAGINA = 15;

export default function RelatorioPresencaObra({ obraId }) {
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [filtroColab, setFiltroColab] = useState('');

  // Carregar dados de presença do período
  const { data: presencas = [] } = useQuery({
    queryKey: ['relatorio-presenca', obraId, dataInicio, dataFim],
    queryFn: async () => {
      // Fonte única: ApontamentoMaoObra (obra+profissional+dia). Normaliza para o
      // formato do relatório. `presente` cobre dia todo E meio período (quem
      // trabalhou); `meioPeriodo` e `horas` permitem medir a presença de verdade.
      const todas = await base44.entities.ApontamentoMaoObra.filter({ obra_id: obraId });
      return todas
        .filter(p => p.data >= dataInicio && p.data <= dataFim)
        .map(p => ({
          ...p,
          colaborador_id: p.profissional_id,
          presente: ehPresenca(p.presenca),
          meioPeriodo: ehMeioPeriodo(p.presenca),
          falta: p.presenca === 'falta',
          horas: Number(p.horas_normais) || 0,
        }));
    },
    enabled: !!obraId && !!dataInicio && !!dataFim
  });

  // Mapa de colaboradores (para resolver nomes) — independente de vínculo.
  const { data: todosColaboradores = [] } = useQuery({
    queryKey: ['colaboradores-todos-relatorio'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000),
  });
  const colMap = useMemo(
    () => Object.fromEntries((todosColaboradores || []).map(c => [c.id, c])),
    [todosColaboradores]
  );

  // Processar dados por colaborador — derivado das presenças reais do período
  // (a tabela/alerta refletem o que existe no período, não um vínculo separado).
  const relatorioColaborador = useMemo(() => {
    const porColab = {};
    presencas.forEach(p => {
      if (!p.colaborador_id) return;
      (porColab[p.colaborador_id] = porColab[p.colaborador_id] || []).push(p);
    });

    return Object.entries(porColab).map(([cid, regs]) => {
      const totalDias = regs.length;
      const presentes = regs.filter(p => p.presente).length;
      const meioPeriodo = regs.filter(p => p.meioPeriodo).length;
      const faltas = regs.filter(p => p.falta).length;
      const horasExtra = regs.reduce((sum, p) => sum + (p.horas_extra || 0), 0);
      const horas = regs.reduce((sum, p) => sum + (p.horas || 0), 0);
      // % de presença pelas HORAS (meio período conta como meio dia, não como dia
      // inteiro — senão duas manhãs valeriam o mesmo que dois dias cheios).
      const horasPossiveis = totalDias * JORNADA_DIA;
      const percentualPresenca = horasPossiveis > 0 ? ((horas / horasPossiveis) * 100).toFixed(1) : 0;

      return {
        id: cid,
        nome: colMap[cid]?.nome || 'Colaborador',
        totalDias,
        presentes,
        meioPeriodo,
        faltas,
        horas,
        horasExtra,
        percentualPresenca,
        observacoes: regs.filter(p => p.observacao).map(p => ({ data: p.data, obs: p.observacao }))
      };
    }).filter(r =>
      filtroColab === '' || r.nome.toLowerCase().includes(filtroColab.toLowerCase())
    ).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [presencas, colMap, filtroColab]);

  // Paginação (15 por página)
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(relatorioColaborador.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const relatorioPagina = useMemo(
    () => relatorioColaborador.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [relatorioColaborador, paginaAtual]
  );
  useEffect(() => { setPagina(1); }, [filtroColab, dataInicio, dataFim]);

  // Gráfico de presença por dia
  const dadosGrafico = useMemo(() => {
    const map = {};
    presencas.forEach(p => {
      if (!map[p.data]) {
        map[p.data] = { data: p.data, presentes: 0, faltas: 0, total: 0 };
      }
      map[p.data].total++;
      if (p.presente) map[p.data].presentes++;
      if (p.falta) map[p.data].faltas++;
    });
    return Object.values(map).sort((a, b) => a.data.localeCompare(b.data));
  }, [presencas]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Relatório de Presença</h2>
        <p className="text-sm text-gray-600 mt-1 hidden sm:block">Análise de faltas, presenças e horas extras</p>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-gray-600">Data Início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600">Data Fim</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600">Filtrar Colaborador</Label>
          <Input
            type="text"
            value={filtroColab}
            onChange={(e) => setFiltroColab(e.target.value)}
            placeholder="Buscar..."
            className="mt-1"
          />
        </div>
      </div>

      {/* GRÁFICOS */}
      {dadosGrafico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Presença por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={(d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '')} />
                <YAxis tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Legend />
                <Bar dataKey="presentes" fill="#10b981" name="Presentes" />
                <Bar dataKey="faltas" fill="#ef4444" name="Faltas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* TABELA DE COLABORADORES */}
      {relatorioColaborador.length === 0 ? (
        <div className="flex items-center gap-2 p-8 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>Nenhum registro de presença no período selecionado.</p>
        </div>
      ) : (
        <>
        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-700 font-semibold">
                <th className="p-3">Colaborador</th>
                <th className="p-3 text-right">Total de Dias</th>
                <th className="p-3 text-right">Presentes</th>
                <th className="p-3 text-right">Faltas</th>
                <th className="p-3 text-right">% Presença</th>
                <th className="p-3 text-right">Horas Extra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {relatorioPagina.map((rel) => (
                <tr key={rel.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">{rel.nome}</td>
                  <td className="p-3 text-right">{rel.totalDias}</td>
                  <td className="p-3 text-right text-green-600 font-semibold">{rel.presentes}</td>
                  <td className="p-3 text-right text-red-600 font-semibold">{rel.faltas}</td>
                  <td className="p-3 text-right">
                    <span className={`font-semibold ${parseFloat(rel.percentualPresenca) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                      {rel.percentualPresenca}%
                    </span>
                  </td>
                  <td className="p-3 text-right">{rel.horasExtra.toFixed(2)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {relatorioPagina.map((rel) => (
            <div key={rel.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900 truncate">{rel.nome}</p>
                <span className={`text-sm font-bold shrink-0 ${parseFloat(rel.percentualPresenca) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                  {rel.percentualPresenca}%
                </span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <div className="font-semibold text-gray-900">{rel.totalDias}</div>
                  <div className="text-gray-500">Dias</div>
                </div>
                <div>
                  <div className="font-semibold text-green-600">{rel.presentes}</div>
                  <div className="text-gray-500">Presentes</div>
                </div>
                <div>
                  <div className="font-semibold text-red-600">{rel.faltas}</div>
                  <div className="text-gray-500">Faltas</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{rel.horasExtra.toFixed(1)}h</div>
                  <div className="text-gray-500">HE</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Paginação (compartilhada tabela/cards; empilha no mobile) */}
        {relatorioColaborador.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
            <span className="text-xs text-gray-500">
              Mostrando {(paginaAtual - 1) * POR_PAGINA + 1}–{Math.min(paginaAtual * POR_PAGINA, relatorioColaborador.length)} de {relatorioColaborador.length}
            </span>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                className="h-8 gap-1 border-gray-300 text-gray-700"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <span className="text-xs text-gray-600">Página {paginaAtual} de {totalPaginas}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas}
                className="h-8 gap-1 border-gray-300 text-gray-700"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        </>
      )}

      {/* OBSERVAÇÕES */}
      {relatorioColaborador.some(r => r.observacoes.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Observações Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {relatorioColaborador.filter(r => r.observacoes.length > 0).map(rel => (
                <div key={rel.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <p className="font-semibold text-gray-900">{rel.nome}</p>
                  <ul className="text-xs text-gray-600 space-y-1 mt-1">
                    {rel.observacoes.map((obs, idx) => (
                      <li key={idx}>
                        <span className="text-gray-500">{obs.data}:</span> {obs.obs}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}