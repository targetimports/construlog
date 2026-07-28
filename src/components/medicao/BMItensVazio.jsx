/**
 * BMItensVazio: Componente exibido quando a BM não tem itens
 * 
 * Cenários:
 * 1) contrato_itens == 0 → Erro + botão "Abrir Contrato"
 * 2) contrato_itens > 0 && bm_itens == 0 → Botão "Pré-carregar itens"
 */

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, ExternalLink, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function BMItensVazio({ bm, diagnostico, onPreloadSuccess }) {
  const [loading, setLoading] = useState(false);

  const contratoItensCount = diagnostico?.contrato_itens_count || 0;
  const bmItemsCount = diagnostico?.bm_items_count || 0;
  const contrato_versao_id = bm?.contrato_versao_id;

  // Cenário 1: Contrato sem itens
  if (contratoItensCount === 0) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-10 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="font-semibold text-red-600 text-lg">Contrato sem itens</p>
          <p className="text-sm text-gray-500">
            Esta versão de contrato não possui itens cadastrados. 
            Cadastre os itens antes de utilizar esta medição.
          </p>
          <p className="text-xs text-gray-400 font-mono">
            contrato_versao_id: {contrato_versao_id}
          </p>
          <Button
            variant="outline"
            className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => {
              window.location.href = createPageUrl(`ContratoVersao?id=${contrato_versao_id}`);
            }}
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Contrato
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Cenário 2: Contrato tem itens, mas BM ainda não tem BMItems
  if (contratoItensCount > 0 && bmItemsCount === 0) {
    const handlePreload = async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('preloadBMItems', { bm_id: bm.id });
        const data = res.data;
        if (!data?.ok) {
          toast.error(data?.error || 'Erro ao pré-carregar itens');
          return;
        }
        toast.success(data.message || 'Itens pré-carregados!');
        onPreloadSuccess?.();
      } catch (err) {
        const errData = err?.response?.data;
        toast.error(errData?.error || err.message || 'Erro ao pré-carregar');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardContent className="py-10 text-center space-y-4">
          <Download className="w-10 h-10 text-yellow-500 mx-auto" />
          <p className="font-semibold text-yellow-700 text-lg">Itens do contrato disponíveis</p>
          <p className="text-sm text-gray-600">
            O contrato possui <strong>{contratoItensCount}</strong> iten(s), mas esta BM ainda não foi inicializada.
            Clique abaixo para carregar os itens automaticamente.
          </p>
          <Button
            onClick={handlePreload}
            disabled={loading}
            className="gap-2 bg-yellow-600 hover:bg-yellow-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Carregando...' : 'Pré-carregar itens do contrato'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Fallback genérico (não deveria chegar aqui)
  return (
    <Card>
      <CardContent className="py-10 text-center text-gray-500">
        <p>Nenhum item para exibir.</p>
      </CardContent>
    </Card>
  );
}