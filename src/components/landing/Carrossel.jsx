import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Slides padrão (placeholders de cor sólida) usados enquanto não houver imagens
// cadastradas em /ConfiguracoesEmpresa. As imagens reais vêm do endpoint público.
const PLACEHOLDER = [
  { cor: 'bg-gradient-to-br from-slate-200 to-slate-300', titulo: 'Obras de ponta a ponta', texto: 'Do projeto à entrega, com qualidade e no prazo.' },
  { cor: 'bg-gradient-to-br from-blue-200 to-blue-300', titulo: 'Engenharia que entrega', texto: 'Equipe técnica e execução de excelência.' },
  { cor: 'bg-gradient-to-br from-emerald-200 to-emerald-300', titulo: 'Transparência total', texto: 'Acompanhe cada etapa da sua obra, sem surpresas.' },
  { cor: 'bg-gradient-to-br from-amber-200 to-amber-300', titulo: 'Resultados que duram', texto: 'Construções sólidas, feitas para durar.' },
];

export default function Carrossel() {
  const [SLIDES, setSlides] = useState(PLACEHOLDER);
  const [i, setI] = useState(0);
  const n = SLIDES.length;
  const go = useCallback((idx) => setI((idx + n) % n), [n]);

  // Busca as imagens cadastradas; se houver, substitui os placeholders.
  useEffect(() => {
    fetch('/api/public/carrossel')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.slides) && d.slides.length > 0) {
          const validos = d.slides.filter((s) => s && s.url);
          setSlides(validos.map((s, idx) => {
            // Título/subtítulo são opcionais: se vierem vazios, usa o texto
            // default (placeholder) daquela posição.
            const def = PLACEHOLDER[idx % PLACEHOLDER.length];
            return {
              img: s.url,
              titulo: (s.titulo && String(s.titulo).trim()) ? s.titulo : def.titulo,
              texto: (s.texto && String(s.texto).trim()) ? s.texto : def.texto,
            };
          }));
          setI(0);
        }
      })
      .catch(() => { /* mantém placeholders */ });
  }, []);

  // Avança sozinho a cada 5s.
  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-gray-200/80 bg-gray-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18)]">
      {/* Trilho 16:9 */}
      <div className="aspect-[16/9] overflow-hidden">
        <div
          className="flex h-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {SLIDES.map((s, idx) => (
            <div key={idx} className="relative w-full h-full flex-shrink-0">
              {s.img ? (
                <img src={s.img} alt={s.alt || s.titulo || `Imagem ${idx + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full ${s.cor}`} />
              )}

              {/* Vinheta na parte de baixo (maior e gradual) — integra a imagem e destaca o texto */}
              {(s.titulo || s.texto) && (
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
              )}

              {/* Texto sobreposto */}
              {(s.titulo || s.texto) && (
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                  <div className="max-w-md">
                    {s.titulo && (
                      <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-sm">
                        {s.titulo}
                      </h3>
                    )}
                    {s.texto && (
                      <p className="mt-2 text-sm sm:text-base text-white/80 leading-relaxed">
                        {s.texto}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Setas — sutis, aparecem no hover */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(i - 1)}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => go(i + 1)}
            aria-label="Próximo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots — canto inferior direito (não colide com o texto à esquerda) */}
          <div className="absolute bottom-5 right-5 flex items-center gap-2">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => go(idx)}
                aria-label={`Ir para o slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
