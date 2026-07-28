import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Info } from 'lucide-react';

export default function ObraProgressBar({ percent_atual, percent_preview }) {
  const temPreview = percent_preview !== undefined && percent_preview !== null;
  const maxPercent = Math.max(percent_atual || 0, percent_preview || 0);

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>Progresso da Obra</span>
          {temPreview && <Info className="w-4 h-4 text-blue-600" title="Há rascunho em preview" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progresso Aprovado */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              {(percent_atual || 0).toFixed(2)}% concluída
            </span>
            <span className="text-xs text-slate-500">(última medição aprovada)</span>
          </div>
          <Progress value={percent_atual || 0} className="h-3" />
        </div>

        {/* Progresso Preview (se existe) */}
        {temPreview && (
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">
                Preview: {(percent_preview || 0).toFixed(2)}%
              </span>
              <span className="text-xs text-blue-500">(rascunho selecionado)</span>
            </div>
            <Progress value={percent_preview || 0} className="h-3 bg-blue-100" />
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-slate-600 bg-white/60 p-2 rounded border border-blue-100">
          {temPreview ? (
            <>
              <strong>Atual:</strong> {(percent_atual || 0).toFixed(2)}% 
              <strong className="ml-3">Preview:</strong> {(percent_preview || 0).toFixed(2)}%
            </>
          ) : (
            <>Selecione um rascunho para ver preview de progresso</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}