import React, { useEffect, useState } from 'react';

/**
 * TopBar Progress - Indicador fino de carregamento durante navegação
 * Usado em transições entre páginas (não no boot inicial)
 */
export default function TopBarProgress({ isLoading = false }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    setProgress(30); // Start animation

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 30;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading || progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[9000] bg-gray-100">
      <div
        className="h-full bg-blue-600 transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}