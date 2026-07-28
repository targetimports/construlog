import React from 'react';
import { AlertTriangle, AlertCircle, Navigation, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AlertasNavegacao({ 
  desvioDetectado, 
  notificacaoAtiva,
  tempoEstimado,
  distanciaRestante
}) {
  const formatarTempo = (segundos) => {
    if (!segundos) return '--';
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    
    if (horas > 0) {
      return `${horas}h ${minutos % 60}min`;
    }
    return `${minutos}min`;
  };

  const formatarDistancia = (metros) => {
    if (!metros) return '--';
    if (metros >= 1000) {
      return `${(metros / 1000).toFixed(1)} km`;
    }
    return `${Math.round(metros)} m`;
  };

  return (
    <div className="space-y-2">
      {/* ALERTA DESVIO DE ROTA */}
      {desvioDetectado && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-red-50 border-l-4 border-red-500 p-3 rounded flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="text-sm">
            <p className="font-bold text-red-900">Desvio Detectado!</p>
            <p className="text-red-800 text-xs mt-1">
              Você saiu da rota recomendada. Recalculando automaticamente...
            </p>
          </div>
        </motion.div>
      )}

      {/* NOTIFICAÇÃO RECALCULANDO */}
      {notificacaoAtiva && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-blue-50 border border-blue-300 p-3 rounded flex items-center gap-2"
        >
          <Navigation className="w-4 h-4 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-blue-900">Rota recalculada!</p>
        </motion.div>
      )}

      {/* ETA E DISTÂNCIA */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold text-blue-900">TEMPO RESTANTE</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatarTempo(tempoEstimado)}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-4 h-4 text-green-600" />
            <p className="text-xs font-semibold text-green-900">DISTÂNCIA</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatarDistancia(distanciaRestante)}</p>
        </div>
      </div>
    </div>
  );
}