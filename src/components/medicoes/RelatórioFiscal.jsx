import React, { useMemo } from 'react';
import { FileText, Download, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function RelatórioFiscal({ medicaoNumero, valorMedido, descontos = [], retencoes = [] }) {
  const relatorio = useMemo(() => {
    const impostos = retencoes.filter(r => ['inss', 'iss', 'csll', 'ir', 'cofins', 'pis'].includes(r.tipo));
    const retencaoTecnica = retencoes.find(r => r.tipo === 'retencao_tecnica');
    
    const totalImpostos = impostos.reduce((acc, imp) => acc + imp.valor, 0);
    const totalDescacado = retencoes.reduce((acc, r) => acc + r.valor, 0);
    const cargaTributaria = ((totalDescacado / valorMedido) * 100).toFixed(2);

    return {
      impostos,
      retencaoTecnica,
      totalImpostos,
      totalDescacado,
      cargaTributaria,
      aliquotaMedia: impostos.length > 0 ? (totalImpostos / valorMedido * 100).toFixed(2) : '0.00'
    };
  }, [retencoes, valorMedido]);

  const exportarPDF = async () => {
    const element = document.getElementById('relatorio-fiscal');
    const canvas = await html2canvas(element);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 10, 10, 190, 277);
    pdf.save(`relatorio-fiscal-medicao-${medicaoNumero}.pdf`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <FileText className="w-5 h-5" /> Relatório Fiscal
            </CardTitle>
            <Button onClick={exportarPDF} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent id="relatorio-fiscal" className="space-y-6">
          {/* Resumo Executivo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-white rounded-lg border border-purple-200">
              <p className="text-xs text-gray-600">Carga Tributária</p>
              <p className="text-2xl font-bold text-purple-600">{relatorio.cargaTributaria}%</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-purple-200">
              <p className="text-xs text-gray-600">Total Retido</p>
              <p className="text-2xl font-bold text-purple-600">R$ {relatorio.totalDescacado.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-purple-200">
              <p className="text-xs text-gray-600">Alíquota Média</p>
              <p className="text-2xl font-bold text-purple-600">{relatorio.aliquotaMedia}%</p>
            </div>
          </div>

          {/* Detalhamento de Impostos */}
          {relatorio.impostos.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Impostos Retidos</h4>
              <div className="space-y-2">
                {relatorio.impostos.map((imp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded">
                    <span className="text-sm font-medium">{imp.tipo.toUpperCase()}</span>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">R$ {imp.valor.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">{imp.percentual.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retenção Técnica */}
          {relatorio.retencaoTecnica && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900">Retenção Técnica</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    Valor: <span className="font-semibold">R$ {relatorio.retencaoTecnica.valor.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Será liberado na 2ª parcela do faturamento após conclusão dos serviços.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Análise */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Análise Fiscal</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Badge className="mt-1">✓</Badge>
                <p>
                  Valor bruto da medição: <strong>R$ {valorMedido.toFixed(2)}</strong>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="mt-1">✓</Badge>
                <p>
                  Total de descontos: <strong>R$ {descontos.reduce((acc, d) => acc + d.valor, 0).toFixed(2)}</strong>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="destructive" className="mt-1">!</Badge>
                <p>
                  Total retido em impostos: <strong>R$ {relatorio.totalImpostos.toFixed(2)}</strong>
                </p>
              </div>
              {relatorio.cargaTributaria > 20 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Carga tributária acima de 20%. Valide cálculos com contabilidade.
                </div>
              )}
            </div>
          </div>

          {/* Tabela Resumida */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="text-left p-2 font-semibold">Descrição</th>
                  <th className="text-right p-2 font-semibold">Valor</th>
                  <th className="text-right p-2 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Base de Cálculo</td>
                  <td className="text-right p-2">R$ {valorMedido.toFixed(2)}</td>
                  <td className="text-right p-2">100.00%</td>
                </tr>
                {relatorio.impostos.map((imp, idx) => (
                  <tr key={idx} className="border-b bg-red-50">
                    <td className="p-2">(-) {imp.tipo.toUpperCase()}</td>
                    <td className="text-right p-2 text-red-600">R$ {imp.valor.toFixed(2)}</td>
                    <td className="text-right p-2 text-red-600">{imp.percentual.toFixed(2)}%</td>
                  </tr>
                ))}
                {relatorio.retencaoTecnica && (
                  <tr className="border-b bg-amber-50">
                    <td className="p-2">(-) Retenção Técnica</td>
                    <td className="text-right p-2 text-amber-600">R$ {relatorio.retencaoTecnica.valor.toFixed(2)}</td>
                    <td className="text-right p-2 text-amber-600">{relatorio.retencaoTecnica.percentual.toFixed(2)}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}