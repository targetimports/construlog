import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader2, Clock, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import autoTable from 'jspdf-autotable';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable, PDF_INK, PDF_MUTE } from '@/lib/pdfBrand';
import Pagination from '@/components/shared/Pagination';

const POR_PAGINA = 5;

const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtH = (v) => `${num(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`;

// Modal com o detalhamento COMPLETO da folha: composição de cada colaborador +
// horas por obra (fonte: Ponto/Presença → ApontamentoMaoObra) + exportação em PDF
// no padrão visual do sistema (pdfBrand). Somente leitura.
export default function DetalheFolhaModal({ open, onClose, folha }) {
  const folhaId = folha?.id;
  const { empresa, branding } = useEmpresaBranding(folha?.empresa_id);
  const [gerando, setGerando] = React.useState(false);

  const { data: itens = [], isLoading: loadingItens } = useQuery({
    queryKey: ['folha-itens', folhaId],
    queryFn: () => base44.entities.FolhaPagamentoItem.filter({ folha_id: folhaId }, '-created_date', 500),
    enabled: open && !!folhaId,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000),
    enabled: open,
  });
  const colabById = React.useMemo(() => Object.fromEntries(colaboradores.map((c) => [c.id, c])), [colaboradores]);

  const { data: detalheResp, isLoading: loadingDet } = useQuery({
    queryKey: ['folha-detalhe', folhaId],
    queryFn: async () => (await base44.functions.invoke('getDetalheFolhaPagamento', { folha_id: folhaId })).data,
    enabled: open && !!folhaId,
  });
  const detalhes = detalheResp?.detalhes || {};

  const isLoading = loadingItens || loadingDet;

  // Totais gerais
  const tot = React.useMemo(() => itens.reduce((a, i) => ({
    salario: a.salario + num(i.salario_base), bonificacao: a.bonificacao + num(i.bonificacao),
    fgts: a.fgts + num(i.fgts), beneficios: a.beneficios + num(i.beneficios),
    extras: a.extras + num(i.extras), horasExtra: a.horasExtra + num(i.valor_horas_extra),
    total: a.total + num(i.total_item),
  }), { salario: 0, bonificacao: 0, fgts: 0, beneficios: 0, extras: 0, horasExtra: 0, total: 0 }), [itens]);
  const horasGerais = React.useMemo(
    () => Object.values(detalhes).reduce((s, d) => s + num(d.horas_total), 0),
    [detalhes],
  );

  const nomeDe = (item) => colabById[item.colaborador_id]?.nome || detalhes[item.colaborador_id]?.colaborador_nome || item.colaborador_id;

  // Paginação (5 por página). O PDF continua exportando a folha INTEIRA.
  const [pagina, setPagina] = React.useState(1);
  React.useEffect(() => { setPagina(1); }, [folhaId, open]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const inicio = (pagAtual - 1) * POR_PAGINA;
  const pageItens = itens.slice(inicio, inicio + POR_PAGINA);

  const exportarPDF = async () => {
    setGerando(true);
    try {
      const doc = novoPDF();
      const titulo = `Folha de Pagamento ${folha?.competencia || ''} — Detalhada`;
      let y = await cabecalhoPDF(doc, {
        empresa, branding,
        titulo: 'Folha de Pagamento — Detalhada',
        subtitulo: `Competência ${folha?.competencia || ''}${empresa?.nome ? ` · ${empresa.nome}` : ''}`,
      });

      // Resumo
      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Colaboradores', 'Horas apontadas', 'Total da folha', 'Status']],
        body: [[String(itens.length), fmtH(horasGerais), fmtBRL(tot.total), String(folha?.status || '')]],
      }));
      y = doc.lastAutoTable.finalY + 8;

      // Composição por colaborador
      autoTable(doc, temaAutoTable({
        startY: y,
        // Colunas de dinheiro em R$; só "Horas apontadas" é em horas. O rótulo da hora
        // extra traz (R$) porque a coluna mostra o VALOR pago, não a quantidade de horas.
        head: [['Colaborador', 'Salário R$', 'Bônus R$', 'FGTS R$', 'Benef. R$', 'Extras R$', 'Hora extra R$', 'Horas apontadas', 'Total R$']],
        body: itens.map((i) => {
          const d = detalhes[i.colaborador_id];
          return [
            nomeDe(i), fmt(i.salario_base), fmt(i.bonificacao), fmt(i.fgts),
            fmt(i.beneficios), fmt(i.extras),
            // valor pago + a quantidade de horas entre parênteses, pra não confundir
            num(i.horas_extra) > 0 ? `${fmt(i.valor_horas_extra)} (${fmt(i.horas_extra)}h)` : fmt(i.valor_horas_extra),
            d?.horas_total > 0 ? fmtH(d.horas_total) : '—', fmt(i.total_item),
          ];
        }),
        foot: [['TOTAL', fmt(tot.salario), fmt(tot.bonificacao), fmt(tot.fgts), fmt(tot.beneficios), fmt(tot.extras), fmt(tot.horasExtra), fmtH(horasGerais), fmt(tot.total)]],
      }));
      y = doc.lastAutoTable.finalY + 8;

      // Horas por obra — um bloco por colaborador que tem apontamento
      const comHoras = itens.filter((i) => detalhes[i.colaborador_id]?.obras?.length > 0);
      if (comHoras.length) {
        doc.setFontSize(11); doc.setTextColor(...PDF_INK);
        if (y > 250) { doc.addPage(); y = 16; }
        doc.text('Horas por obra (fonte: Ponto/Presença)', 14, y);
        y += 5;
        doc.setFontSize(8); doc.setTextColor(...PDF_MUTE);
        doc.text('Custo aplicado = horas x custo real da hora (custo do mes / horas uteis do mes). Mensalista tem salario fixo: as horas mostram onde o custo foi aplicado.', 14, y);
        y += 4;

        for (const i of comHoras) {
          const d = detalhes[i.colaborador_id];
          autoTable(doc, temaAutoTable({
            startY: y,
            head: [[`${nomeDe(i)} — ${fmtH(d.horas_total)}${d.custo_hora_real > 0 ? ` · custo real/hora ${fmtBRL(d.custo_hora_real)}` : ''}`, '', '', '', '', '']],
            body: [
              ['Obra', 'Dias', 'H normais', 'H extra', 'Total h', 'Custo aplicado'],
              ...d.obras.map((o) => [
                o.obra_nome, String(o.dias), fmt(o.horas_normais), fmt(o.horas_extra), fmt(o.horas_total), fmtBRL(o.valor_rateado),
              ]),
              ...(d.nao_alocado > 0 ? [['Sem apontamento no mês', '', '', '', '', fmtBRL(d.nao_alocado)]] : []),
            ],
          }));
          y = doc.lastAutoTable.finalY + 6;
          if (y > 265) { doc.addPage(); y = 16; }
        }
      }

      rodapePDF(doc, { empresa, branding, titulo });
      doc.save(`folha-detalhada-${folha?.competencia || 'competencia'}.pdf`);
      toast.success('PDF gerado!');
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || 'tente novamente'));
    }
    setGerando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6 flex-wrap">
            <span>Folha detalhada — {folha?.competencia}</span>
            <Button size="sm" onClick={exportarPDF} disabled={gerando || isLoading} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div>
                <p className="text-xs text-gray-500">Empresa</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{empresa?.nome || 'Grupo'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Colaboradores</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{itens.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Horas apontadas</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{fmtH(horasGerais)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total da folha</p>
                <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtBRL(tot.total)}</p>
              </div>
            </div>

            {/* Um bloco por colaborador (paginado) */}
            {pageItens.map((item) => {
              const d = detalhes[item.colaborador_id];
              const colab = colabById[item.colaborador_id];
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Cabeçalho do colaborador */}
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{nomeDe(item)}</p>
                      {colab?.cargo && <p className="text-xs text-gray-500">{colab.cargo}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {d?.horas_total > 0 && (
                        <Badge className="bg-blue-50 text-blue-700 border-0 gap-1 text-xs">
                          <Clock className="w-3 h-3" /> {fmtH(d.horas_total)}
                        </Badge>
                      )}
                      {d?.custo_hora_real > 0 && <span className="text-xs text-gray-500">custo/hora <b className="text-gray-700">{fmtBRL(d.custo_hora_real)}</b></span>}
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtBRL(item.total_item)}</span>
                    </div>
                  </div>

                  {/* Composição */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 px-3 py-2 text-xs border-b border-gray-100">
                    {[
                      ['Salário base', item.salario_base], ['Bonificação', item.bonificacao],
                      ['FGTS', item.fgts], ['Benefícios', item.beneficios], ['Extras', item.extras],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p className="text-gray-500">{label}</p>
                        <p className="font-medium text-gray-900 tabular-nums">{fmtBRL(val)}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-gray-500">
                        Horas extra{num(item.horas_extra) > 0 ? ` (${fmt(item.horas_extra)}h +${num(item.adicional_hora_extra_percentual) || 50}%)` : ''}
                      </p>
                      <p className={`font-medium tabular-nums ${num(item.valor_horas_extra) > 0 ? 'text-blue-700' : 'text-gray-900'}`}>
                        {fmtBRL(item.valor_horas_extra)}
                      </p>
                    </div>
                  </div>

                  {/* Horas por obra */}
                  {d?.obras?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-white border-b border-gray-100">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-semibold text-gray-500"><Building2 className="w-3 h-3 inline mr-1" />Obra</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Dias</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-gray-500">H normais</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-gray-500">H extra</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Total h</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Custo rateado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {d.obras.map((o) => (
                            <tr key={o.obra_id || 'sem-obra'}>
                              <td className="px-3 py-1.5 text-gray-800">{o.obra_nome}</td>
                              <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{o.dias}</td>
                              <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{fmt(o.horas_normais)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{fmt(o.horas_extra)}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-gray-900 tabular-nums">{fmt(o.horas_total)}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-gray-900 tabular-nums">{fmtBRL(o.valor_rateado)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td className="px-3 py-1.5 font-semibold text-gray-700" colSpan={4}>Aplicado nas obras</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-900 tabular-nums">{fmt(d.horas_total)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-900 tabular-nums">{fmtBRL(d.valor_aplicado)}</td>
                          </tr>
                          {d.nao_alocado > 0 && (
                            <tr>
                              <td className="px-3 py-1.5 text-gray-500" colSpan={5}>Sem apontamento no mês (não caiu em nenhuma obra)</td>
                              <td className="px-3 py-1.5 text-right text-amber-700 tabular-nums">{fmtBRL(d.nao_alocado)}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-xs text-gray-400">Sem horas apontadas no Ponto/Presença nesta competência.</p>
                  )}
                </div>
              );
            })}

            <Pagination
              currentPage={pagAtual}
              totalPages={totalPaginas}
              onPageChange={setPagina}
              startIndex={inicio}
              endIndex={Math.min(inicio + POR_PAGINA, itens.length)}
              totalItems={itens.length}
            />

            <p className="text-[11px] text-gray-400">
              Horas vindas do <b>Ponto/Presença</b> (Equipe &amp; Diário). Mensalista tem salário fixo — as horas não calculam o pagamento, elas mostram <b>quanto do custo foi aplicado em cada obra</b>: horas × custo real da hora, onde a hora vale o custo total do mês ÷ as horas úteis do mês. Quem trabalha o mês inteiro aplica ~100% do custo nas obras.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
