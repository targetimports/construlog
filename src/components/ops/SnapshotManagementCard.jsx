import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function SnapshotManagementCard() {
  const [loading, setLoading] = useState(false);

  const { data: snapshots, refetch } = useQuery({
    queryKey: ['snapshots-list'],
    queryFn: async () => {
      try {
        const snaps = await base44.entities.SnapshotSistema.filter({}, '-created_at', 20);
        return Array.isArray(snaps) ? snaps : [];
      } catch (e) {
        return [];
      }
    }
  });

  const handlePin = async (snapshotId, currentPinned) => {
    setLoading(true);
    try {
      await base44.functions.invoke('pinnarSnapshot', {
        snapshot_id: snapshotId,
        pinned: !currentPinned
      });
      refetch();
    } catch (e) {
      console.error('Error pinning:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gerenciar Snapshots</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {snapshots && snapshots.length > 0 ? (
            snapshots.map(snap => (
              <div key={snap.id} className="p-2 border rounded flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{snap.nome}</p>
                  <p className="text-xs text-gray-500">
                    {snap.archived ? 'Arquivado' : 'Ativo'} | {(snap.tamanho_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePin(snap.id, snap.pinned)}
                  disabled={loading}
                  title={snap.pinned ? 'Unpin' : 'Pin'}
                >
                  {snap.pinned ? '' : '○'}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Nenhum snapshot disponível</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}