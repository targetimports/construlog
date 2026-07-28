import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Rocket } from 'lucide-react';

export default function EmissaoNFeActions({ loading, onEmitir, onLimpar }) {
  return (
    <div className="flex gap-3 justify-end">
      <Button variant="outline" onClick={onLimpar} disabled={loading}>
        Limpar
      </Button>
      <Button onClick={onEmitir} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
        ) : (
          <><Rocket className="w-4 h-4" /> Emitir NF-e</>
        )}
      </Button>
    </div>
  );
}