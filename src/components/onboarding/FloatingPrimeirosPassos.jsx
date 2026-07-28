import React, { useState, useEffect } from 'react';
import { BookOpen, X, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PrimeirosPassos from './PrimeirosPassos';

export default function FloatingPrimeirosPassos() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem('primeiros_passos_hidden');
    const minimized = localStorage.getItem('primeiros_passos_minimized');
    
    if (hidden === 'true') {
      setIsHidden(true);
    }
    if (minimized === 'true') {
      setIsMinimized(true);
    }
  }, []);

  const handleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('primeiros_passos_minimized', newState.toString());
  };

  const handleHide = () => {
    setIsHidden(true);
    localStorage.setItem('primeiros_passos_hidden', 'true');
  };

  if (isHidden) return null;

  return (
    <>
      {/* Botão Flutuante */}
      <div className={cn(
        'fixed bottom-6 right-6 z-50 transition-all duration-300',
        isMinimized && 'bottom-6'
      )}>
        {isMinimized ? (
          // Versão Minimizada
          <button
            onClick={() => setIsMinimized(false)}
            className="group relative flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium text-sm">Primeiros Passos</span>
            
            {/* Botão Ocultar (aparece no hover) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleHide();
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title="Ocultar permanentemente"
            >
              <X className="w-4 h-4" />
            </button>
          </button>
        ) : (
          // Versão Expandida
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-80">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-semibold text-sm">Primeiros Passos</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleMinimize}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors"
                  title="Minimizar"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleHide}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors"
                  title="Ocultar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                Complete os passos para dominar o sistema
              </p>
              <button
                onClick={() => setIsOpen(true)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Ver Checklist
              </button>
            </div>
          </div>
        )}
      </div>

      <PrimeirosPassos 
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}