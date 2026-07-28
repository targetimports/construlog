import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link as LinkIcon, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

export default function CronogramaGantt({ itens = [], onItensChange, onDatasObraChange, dataInicioObra, dataFimObra }) {
  const [itensLocal, setItensLocal] = useState(itens);
  const [obraInicio, setObraInicio] = useState(dataInicioObra || '');
  const [obraFim, setObraFim] = useState(dataFimObra || '');
  const [dialogLink, setDialogLink] = useState(false);
  const [linkSelecionado, setLinkSelecionado] = useState({ origem: null, destino: null, latencia: 0 });
  const [exportando, setExportando] = useState(false);
  const ganttRef = useRef(null);
  const { empresa, branding } = useEmpresaBranding(undefined);

  // Mantém o estado local sincronizado quando os dados chegam/atualizam do pai.
  useEffect(() => { setItensLocal(itens); }, [itens]);
  useEffect(() => { setObraInicio(dataInicioObra || ''); }, [dataInicioObra]);
  useEffect(() => { setObraFim(dataFimObra || ''); }, [dataFimObra]);

  const commit = (novosItens) => {
    setItensLocal(novosItens);
    onItensChange?.(novosItens);
  };

  const atualizarItem = (index, campo, valor) => {
    const novosItens = [...itensLocal];
    novosItens[index] = { ...novosItens[index], [campo]: valor };

    // Auto-calcular data_fim se mudar data_inicio ou duracao
    if (campo === 'data_inicio' || campo === 'duracao_dias') {
      const dataInicio = campo === 'data_inicio' ? new Date(valor) : new Date(novosItens[index].data_inicio);
      const duracao = campo === 'duracao_dias' ? parseInt(valor) || 1 : novosItens[index].duracao_dias || 1;
      if (!isNaN(dataInicio.getTime())) {
        const dataFim = new Date(dataInicio);
        dataFim.setDate(dataFim.getDate() + duracao - 1);
        novosItens[index].data_fim = dataFim.toISOString().split('T')[0];
      }
    }

    commit(novosItens);
  };

  const atualizarDataObra = (campo, valor) => {
    if (campo === 'data_inicio') setObraInicio(valor);
    else setObraFim(valor);
    onDatasObraChange?.(campo, valor);
  };

  const confirmarLink = () => {
    const novosItens = [...itensLocal];
    const item = { ...novosItens[linkSelecionado.destino] };

    item.predecessores = [...(item.predecessores || [])];
    item.predecessores.push({ item_index: linkSelecionado.origem, latencia_dias: linkSelecionado.latencia });

    const itemOrigem = novosItens[linkSelecionado.origem];
    if (itemOrigem?.data_fim) {
      const dataFimOrigem = new Date(itemOrigem.data_fim);
      dataFimOrigem.setDate(dataFimOrigem.getDate() + 1 + (linkSelecionado.latencia || 0));
      item.data_inicio = dataFimOrigem.toISOString().split('T')[0];
      if (item.duracao_dias) {
        const novaDataFim = new Date(item.data_inicio);
        novaDataFim.setDate(novaDataFim.getDate() + (item.duracao_dias - 1));
        item.data_fim = novaDataFim.toISOString().split('T')[0];
      }
    }

    novosItens[linkSelecionado.destino] = item;
    commit(novosItens);
    setDialogLink(false);
    toast.success('Dependência criada');
  };

  const removerPredecessor = (itemIdx, predIdx) => {
    const novosItens = [...itensLocal];
    const preds = [...(novosItens[itemIdx].predecessores || [])];
    preds.splice(predIdx, 1);
    novosItens[itemIdx] = { ...novosItens[itemIdx], predecessores: preds };
    commit(novosItens);
    toast.success('Dependência removida');
  };

  const identificarCaminhoCritico = () =>
    itensLocal.map((item, idx) => ({ index: idx, critico: !(item.predecessores && item.predecessores.length > 0) }));

  const caminhoCritico = identificarCaminhoCritico();

  const calcularPosicaoNoGrafico = (dataInicio, dataFim) => {
    if (!obraInicio || !obraFim) return null;
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const inicioObra = new Date(obraInicio);
    const fimObra = new Date(obraFim);
    const duracaoTotal = fimObra - inicioObra;
    if (!(duracaoTotal > 0)) return null;
    const left = ((inicio - inicioObra) / duracaoTotal) * 100;
    const width = ((fim - inicio) / duracaoTotal) * 100;
    return { left: `${Math.max(0, left)}%`, width: `${Math.max(2, width)}%` };
  };

  const exportarParaExcel = () => {
    try {
      if (itensLocal.length === 0) { toast.error('Não há atividades para exportar.'); return; }
      const rows = itensLocal.map((item, idx) => {
        const semPred = caminhoCritico.find((c) => c.index === idx)?.critico;
        const deps = (item.predecessores || [])
          .map((p) => itensLocal[p.item_index]?.descricao + (p.latencia_dias > 0 ? ` (+${p.latencia_dias}d)` : ''))
          .filter(Boolean)
          .join('; ');
        return [
          item.descricao || '',
          item.data_inicio || '',
          item.duracao_dias || '',
          item.data_fim || '',
          // O flag marca itens SEM predecessora (início livre), não caminho crítico real.
          semPred ? 'Sim' : 'Não',
          deps,
        ];
      });
      exportarXLSXBranded(`cronograma-${new Date().toISOString().slice(0, 10)}`, [{
        nome: 'Cronograma',
        titulo: 'Cronograma da Obra',
        subtitulo: obraInicio ? `${obraInicio}${obraFim ? ' a ' + obraFim : ''}` : '',
        headers: ['Atividade', 'Data Início', 'Duração (dias)', 'Data Fim', 'Início Livre', 'Dependências'],
        rows,
        larguras: [55, 14, 14, 14, 12, 45],
      }], { empresa, branding });
      toast.success('Excel exportado!');
    } catch (e) {
      toast.error('Erro ao exportar Excel: ' + (e?.message || 'tente novamente'));
    }
  };

  const exportarParaImagem = async () => {
    if (!ganttRef.current) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(ganttRef.current, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cronograma-gantt.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Imagem exportada!');
    } catch (e) {
      toast.error('Erro ao exportar imagem: ' + (e?.message || 'tente novamente'));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card ref={ganttRef} className="bg-white border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900">Cronograma de Gantt</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportarParaImagem} disabled={exportando} className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2">
              <Download className="w-4 h-4" />
              {exportando ? 'Gerando...' : 'Exportar Imagem'}
            </Button>
            <Button size="sm" variant="outline" onClick={exportarParaExcel} className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2">
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Período da Obra */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div>
              <Label className="text-gray-600">Data Início da Obra</Label>
              <Input
                type="date"
                value={obraInicio || ''}
                onChange={(e) => atualizarDataObra('data_inicio', e.target.value)}
                className="mt-1.5 bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label className="text-gray-600">Data Fim da Obra</Label>
              <Input
                type="date"
                value={obraFim || ''}
                onChange={(e) => atualizarDataObra('data_fim', e.target.value)}
                className="mt-1.5 bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          {/* Timeline Visual */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px] space-y-2">
              {/* Cabeçalho da Timeline */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-2">
                <div className="col-span-4">Atividade</div>
                <div className="col-span-2 text-center">Data Início</div>
                <div className="col-span-1 text-center">Duração</div>
                <div className="col-span-2 text-center">Data Fim</div>
                <div className="col-span-3 text-center">Linha do Tempo</div>
              </div>

              {/* Itens */}
              {itensLocal.map((item, index) => {
                const ehCritico = caminhoCritico.find(c => c.index === index)?.critico;
                const posicao = item.data_inicio && item.data_fim
                  ? calcularPosicaoNoGrafico(item.data_inicio, item.data_fim)
                  : null;

                return (
                  <div key={item.id || index} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="col-span-4">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", ehCritico ? "text-red-600" : "text-gray-900")}>
                            {item.descricao}
                          </span>
                          {ehCritico && (
                            <span className="text-xs text-red-600 font-semibold">CRÍTICO</span>
                          )}
                        </div>
                        {item.predecessores && item.predecessores.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.predecessores.map((pred, predIdx) => (
                              <div key={predIdx} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded">
                                <LinkIcon className="w-3 h-3" />
                                {itensLocal[pred.item_index]?.descricao?.substring(0, 15)}...
                                {pred.latencia_dias > 0 && ` +${pred.latencia_dias}d`}
                                <button onClick={() => removerPredecessor(index, predIdx)} className="ml-1 hover:text-red-600">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="date"
                          value={item.data_inicio || ''}
                          onChange={(e) => atualizarItem(index, 'data_inicio', e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 text-xs h-8"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          value={item.duracao_dias || ''}
                          onChange={(e) => atualizarItem(index, 'duracao_dias', e.target.value)}
                          placeholder="dias"
                          className="bg-white border-gray-300 text-gray-900 text-xs h-8 text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="date"
                          value={item.data_fim || ''}
                          onChange={(e) => atualizarItem(index, 'data_fim', e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 text-xs h-8"
                        />
                      </div>
                      <div className="col-span-3 relative h-8">
                        {posicao && (
                          <div
                            className={cn("absolute h-6 rounded top-1 transition-all", ehCritico ? "bg-red-500" : "bg-slate-500")}
                            style={{ left: posicao.left, width: posicao.width }}
                            title={`${item.descricao}: ${item.data_inicio} a ${item.data_fim}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-6 text-xs text-gray-600 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-500 rounded" />
              <span>Atividade Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded" />
              <span>Caminho Crítico</span>
            </div>
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-slate-600" />
              <span>Dependência entre atividades</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para adicionar latência */}
      <Dialog open={dialogLink} onOpenChange={setDialogLink}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Configurar Dependência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600">Latência (dias de intervalo)</Label>
              <Input
                type="number"
                value={linkSelecionado.latencia}
                onChange={(e) => setLinkSelecionado({ ...linkSelecionado, latencia: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="mt-1.5 bg-white border-gray-300 text-gray-900"
              />
              <p className="text-gray-500 text-xs mt-1">
                Dias de espera entre o fim da atividade anterior e início desta
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogLink(false)} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </Button>
              <Button onClick={confirmarLink} className="bg-gray-900 hover:bg-gray-800 text-white">
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
