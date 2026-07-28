import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import IAAlerts from './IAAlerts';
import IASuggestionsTable from './IASuggestionsTable';

export default function IAUpload({ bm_id, contrato_versao_id, onSuggestionsLoaded }) {
  const [loading, setLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [confiancaGeral, setConfiancaGeral] = useState(0);

  const handleExtrair = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('iaMedicoesExtract', {
        bm_id,
        contrato_versao_id
      });

      if (res.data.success) {
        setSugestoes(res.data.sugestoes);
        setConfiancaGeral(res.data.confianca_geral);
        onSuggestionsLoaded?.(res.data.sugestoes);
        toast.success(`${res.data.sugestoes.length} sugestões geradas`);
      }
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuditoria = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('iaMedicoesAuditOnApprove', {
        bm_id
      });

      if (res.data.success) {
        setAlertas(res.data.alertas);
        if (!res.data.pode_aprovar) {
          toast.error('Alertas críticos detectados. Revise antes de aprovar.');
        } else {
          toast.success('Auditoria concluída sem críticos');
        }
      }
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAplicar = async (selecionadas) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('iaMedicoesApplySuggestions', {
        bm_id,
        sugestoes_aplicadas: selecionadas,
        acao: 'apply'
      });

      if (res.data.success) {
        toast.success(`${res.data.atualizacoes} sugestões aplicadas`);
        setSugestoes([]); // Limpar após aplicação
      }
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async (selecionadas) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('iaMedicoesApplySuggestions', {
        bm_id,
        sugestoes_aplicadas: selecionadas,
        acao: 'reject'
      });

      if (res.data.success) {
        toast.success(`${res.data.atualizacoes} sugestões rejeitadas`);
        setSugestoes([]); // Limpar após rejeição
      }
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Análise IA de Medições
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleExtrair}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {loading ? <Loader className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Sugerir Quantidades
            </Button>
            <Button
              onClick={handleAuditoria}
              disabled={loading}
              variant="outline"
            >
              {loading ? <Loader className="w-4 h-4 mr-1 animate-spin" /> : null}
              Auditar Antes de Aprovar
            </Button>
          </div>

          {confiancaGeral > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              Confiança geral: <strong>{confiancaGeral}%</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {alertas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alertas de Auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <IAAlerts alertas={alertas} loading={loading} />
          </CardContent>
        </Card>
      )}

      {sugestoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sugestões IA ({sugestoes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <IASuggestionsTable 
              sugestoes={sugestoes}
              loading={loading}
              onApply={handleAplicar}
              onReject={handleRejeitar}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}