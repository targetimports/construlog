import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflineSyncBanner({
  isOnline,
  isSyncing,
  pendingCount,
  lastError,
  onSyncNow
}) {
  if (isOnline && pendingCount === 0 && !lastError) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-40 px-4 py-3 ${
      isOnline
        ? 'bg-green-50 border-b border-green-200'
        : 'bg-amber-50 border-b border-amber-200'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {pendingCount > 0
                  ? `Online — ${pendingCount} vistória(s) pendente(s)`
                  : 'Online'}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Modo offline — dados salvos localmente
              </span>
            </>
          )}

          {lastError && (
            <span className="text-xs text-red-600 ml-2">{lastError}</span>
          )}
        </div>

        {pendingCount > 0 && (
          <Button
            onClick={onSyncNow}
            disabled={isSyncing || !isOnline}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSyncing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        )}
      </div>
    </div>
  );
}