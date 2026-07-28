import React from 'react';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

/**
 * Calcula status do consumo planejado
 * @param {number} consumido - quantidade consumida/solicitada
 * @param {number} planejado - quantidade planejada
 * @returns { status: 'ok' | 'atencao' | 'estourado', percentual: number }
 */
export function calcularStatusConsumo(consumido, planejado) {
  if (planejado <= 0) {
    return { status: 'ok', percentual: 0 };
  }

  const percentual = (consumido / planejado) * 100;

  if (percentual > 100) {
    return { status: 'estourado', percentual };
  } else if (percentual >= 80) {
    return { status: 'atencao', percentual };
  } else {
    return { status: 'ok', percentual };
  }
}

/**
 * Componente visual do indicador
 */
export function IndicadorConsumo({ consumido, planejado, tamanho = 'md' }) {
  const { status, percentual } = calcularStatusConsumo(consumido, planejado);

  const configs = {
    ok: {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-700',
      icon: CheckCircle,
      label: 'OK'
    },
    atencao: {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
      icon: AlertCircle,
      label: 'Atenção'
    },
    estourado: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-700',
      icon: TrendingUp,
      label: 'Estourado'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border ${config.bg} ${config.border}`}>
      <Icon className={`${sizeClasses[tamanho]} ${config.text} flex-shrink-0`} />
      <div className="text-xs">
        <div className={`font-semibold ${config.text}`}>{config.label}</div>
        <div className={`${config.text} opacity-75`}>{percentual.toFixed(0)}%</div>
      </div>
    </div>
  );
}

/**
 * Barra de progresso de consumo
 */
export function BarraConsumo({ consumido, planejado, altura = 'sm' }) {
  const { status, percentual } = calcularStatusConsumo(consumido, planejado);

  const colors = {
    ok: 'bg-green-500',
    atencao: 'bg-amber-500',
    estourado: 'bg-red-500'
  };

  const alturas = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const progressWidth = Math.min(percentual, 100);

  return (
    <div className="space-y-1">
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${alturas[altura]}`}>
        <div
          className={`${colors[status]} rounded-full transition-all duration-300`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>{consumido}</span>
        <span>de {planejado}</span>
      </div>
    </div>
  );
}

export default { IndicadorConsumo, BarraConsumo, calcularStatusConsumo };