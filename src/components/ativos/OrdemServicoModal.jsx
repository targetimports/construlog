import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormSkeleton } from '@/components/shared/Skeletons';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { novoPDF, cabecalhoPDF, rodapePDF, temaAutoTable, carregarImagemPDF, PDF_INK, PDF_MUTE } from '@/lib/pdfBrand';
import autoTable from 'jspdf-autotable';
import { FileText, AlertTriangle, Check, Download } from 'lucide-react';
import Lightbox from '@/components/shared/Lightbox';
import { toast } from 'sonner';

// ORDEM DE SERVIÇO do empréstimo — o comprovante de que o ativo foi entregue à obra:
// dados do ativo, período, medidor e as duas vistorias (saída e devolução) com fotos e
// assinatura de quem recebeu. É o documento que se imprime e se guarda.

const dt = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const dth = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const un = (t) => (t === 'km' ? 'km' : 'h');

function Campo({ rotulo, valor }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="text-sm text-gray-900">{valor || '—'}</p>
    </div>
  );
}

function BlocoVistoria({ titulo, v, medidorTipo, onAbrirFoto }) {
  if (!v) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-400">
        {titulo}: ainda não realizada.
      </div>
    );
  }
  const avarias = (v.itens || []).filter((i) => String(i.estado).toLowerCase() === 'avaria');
  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-gray-900">{titulo}</p>
        <Badge className={avarias.length ? 'bg-amber-100 text-amber-700 gap-1' : 'bg-green-100 text-green-700 gap-1'}>
          {avarias.length ? <><AlertTriangle className="w-3 h-3" />{avarias.length} avaria(s)</> : <><Check className="w-3 h-3" />Sem avarias</>}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Campo rotulo="Medidor" valor={v.medidor != null ? `${v.medidor} ${un(medidorTipo)}` : '—'} />
        <Campo rotulo="Vistoriado em" valor={dth(v.data_vistoria)} />
        <Campo rotulo="Por" valor={v.vistoriado_por} />
      </div>
      {avarias.length > 0 && (
        <ul className="text-sm text-amber-700 list-disc pl-5 space-y-0.5">
          {avarias.map((a, i) => (
            <li key={i}>{a.item}{a.observacao ? ` — ${a.observacao}` : ''}</li>
          ))}
        </ul>
      )}
      {v.observacao && <p className="text-sm text-gray-600 italic">“{v.observacao}”</p>}
      {(v.fotos || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* Abre no visor do sistema (navega e baixa), não em outra aba. */}
          {v.fotos.map((url, i) => (
            <button key={url + i} type="button" onClick={() => onAbrirFoto?.(v.fotos, i)}
              className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 block hover:ring-2 hover:ring-blue-400">
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {(v.assinante_nome || v.assinatura_url) && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Assinatura</p>
          {v.assinatura_url && <img src={v.assinatura_url} alt="Assinatura" className="h-16 object-contain" />}
          <p className="text-sm text-gray-900">
            {v.assinante_nome || '—'}
            {v.assinante_documento ? <span className="text-gray-500"> · {v.assinante_documento}</span> : null}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrdemServicoModal({ open, emprestimoId, onClose }) {
  const { empresa, branding } = useEmpresaBranding();
  const [gerando, setGerando] = useState(false);
  // Visor de fotos: guarda QUAL galeria está aberta (saída ou devolução) e o índice,
  // para as setas navegarem só dentro daquela vistoria.
  const [galeria, setGaleria] = useState([]);
  const [zoomIdx, setZoomIdx] = useState(null);
  const abrirFoto = (fotos, i) => { setGaleria(fotos || []); setZoomIdx(i); };

  const { data, isLoading } = useQuery({
    queryKey: ['ordem-servico-emprestimo', emprestimoId],
    queryFn: () => base44.functions.invoke('getOrdemServicoEmprestimo', { emprestimo_id: emprestimoId }).then((r) => r.data),
    enabled: !!(open && emprestimoId),
  });

  const os = data?.os;
  const ativo = data?.ativo;

  const baixarPDF = async () => {
    if (!os) return;
    setGerando(true);
    try {
      const doc = novoPDF();
      const M = 14;
      const PW = doc.internal.pageSize.getWidth();
      let y = await cabecalhoPDF(doc, {
        empresa: data.empresa || empresa, branding,
        titulo: `ORDEM DE SERVIÇO ${os.numero || ''}`,
        subtitulo: `Empréstimo de ativo ${os.emprestimo_numero || ''}`,
      });

      autoTable(doc, temaAutoTable({
        startY: y + 2,
        head: [['Ativo', 'Obra', 'Saída', 'Retorno previsto']],
        body: [[
          [ativo?.nome, ativo?.placa && `Placa ${ativo.placa}`, ativo?.codigo].filter(Boolean).join(' · ') || '—',
          data.obra?.nome || '—',
          dt(os.data_saida),
          dt(os.data_prevista_retorno),
        ]],
      }));
      y = doc.lastAutoTable.finalY + 6;

      autoTable(doc, temaAutoTable({
        startY: y,
        head: [['Medidor saída', 'Medidor retorno', 'Uso', 'Tarifa', 'Custo']],
        body: [[
          os.medidor_saida != null ? `${os.medidor_saida} ${un(os.medidor_tipo)}` : '—',
          os.medidor_retorno != null ? `${os.medidor_retorno} ${un(os.medidor_tipo)}` : '—',
          os.uso_calculado != null ? `${os.uso_calculado} ${os.tarifa_tipo === 'dia' ? 'dia(s)' : un(os.medidor_tipo)}` : '—',
          `${fmtBRL(os.tarifa_valor)} / ${os.tarifa_tipo || '—'}`,
          os.custo_total != null ? fmtBRL(os.custo_total) : '—',
        ]],
      }));
      y = doc.lastAutoTable.finalY + 6;

      if (os.motivo) {
        doc.setFontSize(9); doc.setTextColor(...PDF_MUTE);
        doc.text('Motivo:', M, y);
        doc.setTextColor(...PDF_INK);
        const linhas = doc.splitTextToSize(os.motivo, PW - M * 2 - 16);
        doc.text(linhas, M + 16, y);
        y += linhas.length * 4 + 4;
      }

      // Checklists das duas pontas.
      for (const [titulo, v] of [['Vistoria de saída', data.vistoria_saida], ['Vistoria de devolução', data.vistoria_entrada]]) {
        if (!v) continue;
        autoTable(doc, temaAutoTable({
          startY: y,
          head: [[`${titulo} — ${v.medidor ?? '—'} ${un(os.medidor_tipo)}`, 'Estado', 'Observação']],
          body: (v.itens || []).map((i) => [i.item, String(i.estado).toLowerCase() === 'avaria' ? 'AVARIA' : 'OK', i.observacao || '']),
          columnStyles: { 1: { cellWidth: 22 } },
        }));
        y = doc.lastAutoTable.finalY + 4;
        if (v.observacao) {
          doc.setFontSize(8.5); doc.setTextColor(...PDF_MUTE);
          const linhas = doc.splitTextToSize(`Obs.: ${v.observacao}`, PW - M * 2);
          doc.text(linhas, M, y);
          y += linhas.length * 4 + 2;
        }
        y += 2;
      }

      // Assinatura de quem recebeu — o que dá força de comprovante ao documento.
      const vs = data.vistoria_saida;
      if (vs?.assinante_nome || vs?.assinatura_url) {
        if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
        y += 6;
        const img = vs.assinatura_url ? await carregarImagemPDF(vs.assinatura_url) : null;
        if (img) {
          try { doc.addImage(img.dataUrl, 'PNG', M, y, 60, 20); } catch { /* ignora */ }
        }
        y += 22;
        doc.setDrawColor(150); doc.setLineWidth(0.3);
        doc.line(M, y, M + 70, y);
        doc.setFontSize(8.5); doc.setTextColor(...PDF_INK);
        doc.text(vs.assinante_nome || '', M, y + 4);
        if (vs.assinante_documento) {
          doc.setTextColor(...PDF_MUTE);
          doc.text(vs.assinante_documento, M, y + 8);
        }
        doc.setTextColor(...PDF_MUTE); doc.setFontSize(7.5);
        doc.text('Responsável pelo recebimento do ativo', M, y + (vs.assinante_documento ? 12 : 8));
      }

      rodapePDF(doc, { empresa: data.empresa || empresa, branding, titulo: `O.S. ${os.numero || ''}` });
      doc.save(`${os.numero || 'ordem-servico'}.pdf`);
    } catch (e) {
      toast.error('Erro ao gerar o PDF: ' + (e?.message || e));
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setZoomIdx(null); onClose?.(); } }}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        // Com o visor aberto (portal no body = "fora" do modal), clique/Esc nele seria
        // lido pelo Radix como interação externa e fecharia a O.S. junto.
        onInteractOutside={(e) => { if (zoomIdx != null) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (zoomIdx != null) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {os?.numero ? `Ordem de Serviço ${os.numero}` : 'Documento do empréstimo'}
          </DialogTitle>
          {os && (
            <p className="text-sm text-gray-500">
              Empréstimo {os.emprestimo_numero}
              {os.numero
                ? ` · emitida em ${dth(os.emitida_em)}`
                : ' · liberado antes da O.S. existir — sem numeração'}
            </p>
          )}
        </DialogHeader>

        {isLoading || !os ? (
          <FormSkeleton fields={6} />
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Campo rotulo="Ativo" valor={ativo?.nome} />
              <Campo rotulo="Placa / código" valor={ativo?.placa || ativo?.codigo} />
              <Campo rotulo="Obra" valor={data.obra?.nome} />
              <Campo rotulo="Status" valor={os.status} />
              <Campo rotulo="Saída" valor={dt(os.data_saida)} />
              <Campo rotulo="Retorno previsto" valor={dt(os.data_prevista_retorno)} />
              <Campo rotulo="Retorno" valor={dt(os.data_retorno)} />
              <Campo rotulo="Liberado por" valor={os.aprovador} />
              <Campo rotulo="Medidor saída" valor={os.medidor_saida != null ? `${os.medidor_saida} ${un(os.medidor_tipo)}` : '—'} />
              <Campo rotulo="Medidor retorno" valor={os.medidor_retorno != null ? `${os.medidor_retorno} ${un(os.medidor_tipo)}` : '—'} />
              <Campo rotulo="Tarifa" valor={`${fmtBRL(os.tarifa_valor)} / ${os.tarifa_tipo || '—'}`} />
              <Campo rotulo="Custo" valor={os.custo_total != null ? fmtBRL(os.custo_total) : '—'} />
            </div>
            {os.motivo && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Motivo</p>
                <p className="text-sm text-gray-700">{os.motivo}</p>
              </div>
            )}
            <BlocoVistoria titulo="Vistoria de saída" v={data.vistoria_saida} medidorTipo={os.medidor_tipo} onAbrirFoto={abrirFoto} />
            <BlocoVistoria titulo="Vistoria de devolução" v={data.vistoria_entrada} medidorTipo={os.medidor_tipo} onAbrirFoto={abrirFoto} />
          </div>
        )}

        <Lightbox
          fotos={galeria}
          index={zoomIdx}
          onClose={() => setZoomIdx(null)}
          onIndex={setZoomIdx}
          nomeBase={`os-${os?.numero || 'vistoria'}-foto`}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={baixarPDF} disabled={!os || gerando}>
            <Download className="w-4 h-4" /> {gerando ? 'Gerando...' : 'Baixar O.S. (PDF)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
