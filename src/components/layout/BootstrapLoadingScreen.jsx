import React from 'react';
import BootLoader from './BootLoader';

/**
 * @deprecated Use BootLoader diretamente
 * Wrapper para compatibilidade com código antigo
 */
export default function BootstrapLoadingScreen({ step = 'auth', progress = 0 }) {
  return <BootLoader step={step} status="loading" />;
}