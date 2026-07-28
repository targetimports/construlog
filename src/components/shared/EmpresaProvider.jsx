import React from 'react';
import { useEmpresa } from './useEmpresaContext';
import { EmpresaContext } from './useEmpresaContext';

/**
 * Provider que encapsula o contexto de empresa
 * Deve estar envolvendo toda a aplicação
 */
export function EmpresaProvider({ children }) {
  const empresaData = useEmpresa();

  return (
    <EmpresaContext.Provider value={empresaData}>
      {children}
    </EmpresaContext.Provider>
  );
}