import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function SnapshotIntegrityCard({ onSuccess }) {
  const [snapshotId, setSnapshotId] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null);

  const handleValidate = async () => {
    if (!snapshotId.trim()) {
      toast.error('Digite um snapshot ID');
      return;
    }

    setValidating(true);
    try {
      const res = await base44.functions.invoke('validarSnapshotIntegridade', {
        snapshot_id: snapshotId
      });

      if (res.data?.ok) {
        setResult({
          ok: true,
          hash_match: res.data.hash_match,
          counts_match: res.data.counts_match
        });
        toast.success('Snapshot íntegro!');
      } else {
        setResult({
          ok: false,
          hash_match: res.data?.hash_match,
          counts_match: res.data?.counts_match,
          error: res.data?.error
        });
        toast.error('Integridade comprometida');
      }
      onSuccess?.();
    } catch (e) {
      toast.error('Erro ao validar: ' + e.message);
      setResult({ ok: false, error: e.message });
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Validar Integridade de Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="ID do snapshot"
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            disabled={validating}
          />
          <Button
            onClick={handleValidate}
            disabled={validating}
            variant="outline"
          >
            {validating ? '' : '✓'} Validar
          </Button>
        </div>

        {result && (
          <div className={`p-3 rounded border ${result.ok ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className="font-semibold">{result.ok ? 'Snapshot Válido' : 'Snapshot Inválido'}</p>
                <p className="text-xs mt-1">Hash Match: {result.hash_match ? '' : ''}</p>
                <p className="text-xs">Records Match: {result.counts_match ? '' : ''}</p>
                {result.error && <p className="text-xs text-red-600 mt-1">{result.error}</p>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}