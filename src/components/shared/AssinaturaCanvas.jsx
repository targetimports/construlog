import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

// Prancheta de assinatura (dedo no celular, mouse no desktop) → data URL PNG.
// Extraída da vistoria de ativo para servir também à entrega do motorista: nas duas
// situações alguém assina confirmando que recebeu algo.
export default function AssinaturaCanvas({ onChange, altura = 'h-36' }) {
  const ref = useRef(null);
  const desenhando = useRef(false);
  const [assinou, setAssinou] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111827';
  }, []);

  const ponto = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const iniciar = (e) => {
    const ctx = ref.current.getContext('2d');
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    desenhando.current = true;
    setAssinou(true);
  };
  const mover = (e) => {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = ref.current.getContext('2d');
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const parar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    onChange(ref.current.toDataURL('image/png'));
  };
  const limpar = () => {
    const canvas = ref.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setAssinou(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={ref}
          onMouseDown={iniciar} onMouseMove={mover} onMouseUp={parar} onMouseLeave={parar}
          onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={parar}
          className={`w-full ${altura} border-2 border-dashed border-gray-300 rounded-lg bg-white cursor-crosshair`}
          style={{ touchAction: 'none' }}
        />
        {!assinou && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Assine com o dedo ou com o mouse</p>
          </div>
        )}
      </div>
      {assinou && (
        <Button type="button" variant="outline" size="sm" className="gap-2 text-gray-600" onClick={limpar}>
          <Eraser className="w-3.5 h-3.5" /> Limpar assinatura
        </Button>
      )}
    </div>
  );
}
