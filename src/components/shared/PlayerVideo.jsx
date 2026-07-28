import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from 'lucide-react';

// PLAYER DE VÍDEO do sistema — controles próprios, no lugar dos do navegador.
//
// Motivo: os controles nativos mudam de aparência em cada navegador e destoam do
// resto da interface. Aqui a barra segue a paleta do sistema e some quando o vídeo
// está rodando, deixando a imagem limpa.
//
// Não reimplementa o que o navegador já faz bem: o elemento <video> continua
// cuidando de buffer, range request e decodificação — só a casca é nossa.

const tempo = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  return `${m}:${String(seg).padStart(2, '0')}`;
};

export default function PlayerVideo({ src, autoPlay = false, iniciarEm = 0, onExpandir, className = '' }) {
  const ref = useRef(null);
  const barraRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [acabou, setAcabou] = useState(false);
  const [mostrarControles, setMostrarControles] = useState(true);
  const timerRef = useRef(null);

  const pct = duracao > 0 ? (atual / duracao) * 100 : 0;

  const alternar = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play(); } else { v.pause(); }
  }, []);

  // Controles somem sozinhos enquanto o vídeo roda; qualquer movimento os traz de volta.
  const acordar = useCallback(() => {
    setMostrarControles(true);
    clearTimeout(timerRef.current);
    if (!ref.current?.paused) {
      timerRef.current = setTimeout(() => setMostrarControles(false), 2500);
    }
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const irPara = (e) => {
    const v = ref.current;
    const barra = barraRef.current;
    if (!v || !barra || !duracao) return;
    const r = barra.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    v.currentTime = Math.max(0, Math.min(1, x / r.width)) * duracao;
  };

  return (
    <div
      className={`relative group rounded-xl overflow-hidden bg-black border border-gray-200 ${className}`}
      onMouseMove={acordar}
      onMouseLeave={() => !ref.current?.paused && setMostrarControles(false)}
      onTouchStart={acordar}
    >
      <video
        ref={ref}
        src={src}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        className="w-full aspect-video block cursor-pointer"
        onClick={alternar}
        onPlay={() => { setTocando(true); setAcabou(false); acordar(); }}
        onPause={() => { setTocando(false); setMostrarControles(true); }}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuracao(e.currentTarget.duration);
          // Continua de onde o vídeo pequeno parou (só faz sentido na abertura).
          if (iniciarEm > 0 && iniciarEm < e.currentTarget.duration) {
            e.currentTarget.currentTime = iniciarEm;
          }
        }}
        onEnded={() => { setTocando(false); setAcabou(true); setMostrarControles(true); }}
      />

      {/* Play central — aparece com o vídeo parado, para o alvo de toque ser grande. */}
      {!tocando && (
        <button
          type="button"
          onClick={alternar}
          className="absolute inset-0 flex items-center justify-center"
          aria-label={acabou ? 'Assistir de novo' : 'Reproduzir'}
        >
          <span className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            {acabou
              ? <RotateCcw className="w-7 h-7 text-blue-600" />
              : <Play className="w-7 h-7 text-blue-600 ml-1" fill="currentColor" />}
          </span>
        </button>
      )}

      {/* Barra de controles */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200 ${
          mostrarControles ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Trilha de progresso */}
        <div
          ref={barraRef}
          onClick={irPara}
          className="h-1 w-full bg-white/25 rounded-full cursor-pointer mb-2.5 relative"
          role="slider"
          aria-label="Progresso do vídeo"
          aria-valuenow={Math.round(pct)}
        >
          <div className="h-full bg-blue-500 rounded-full relative" style={{ width: `${pct}%` }}>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center gap-3 text-white">
          <button type="button" onClick={alternar} aria-label={tocando ? 'Pausar' : 'Reproduzir'} className="hover:text-blue-300 transition-colors">
            {tocando ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>

          <span className="text-xs tabular-nums text-white/90">
            {tempo(atual)} <span className="text-white/50">/ {tempo(duracao)}</span>
          </span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => { const v = ref.current; if (v) { v.muted = !v.muted; setMudo(v.muted); } }}
            aria-label={mudo ? 'Ativar som' : 'Silenciar'}
            className="hover:text-blue-300 transition-colors"
          >
            {mudo ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onExpandir && (
            <button
              type="button"
              onClick={() => { ref.current?.pause(); onExpandir(atual); }}
              aria-label="Ampliar vídeo"
              className="hover:text-blue-300 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
