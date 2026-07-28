import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ValidadorObraGlobal() {
  const [obraObrigatoria, setObraObrigatoria] = React.useState(false);
  const currentPageName = window.location.pathname.split('/').pop();

  // Páginas que EXIGEM obra selecionada
  const paginasComObraObrigatoria = [
    'SolicitacoesVeiculos',
    'Compras',
    'SolicitarCompra',
    'OrdensCompra',
    'RecebimentoAlmoxarifado',
    'Financeiro',
    'LancamentosFinanceiros',
    'Estoque',
    'TransferenciaEstoqueObra',
    'ApontamentoHoras',
    'GestaoMaoDeObra'
  ];

  useEffect(() => {
    const temObraObrigatoria = paginasComObraObrigatoria.includes(currentPageName);
    setObraObrigatoria(temObraObrigatoria);
  }, [currentPageName]);

  if (!obraObrigatoria) return null;

  return (
    <div className="px-4 py-2">
      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Esta página exige uma <strong>obra selecionada</strong>. Selecione uma obra no seletor superior antes de criar/editar registros.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function useValidarObraObrigatoria() {
  return async (obraId, tipoRegistro) => {
    if (!obraId) {
      throw new Error(`Obra é obrigatória para criar ${tipoRegistro}`);
    }
    return true;
  };
}