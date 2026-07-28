import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Tela /Estoque aposentada: tratava a entidade Material como "entrada de estoque"
// (campos quantidade/valor), conflitando com o catálogo (SuprimentosMateriais) e
// sem refletir o saldo real (que vem das movimentações — EstoqueMovimentacao).
// Redireciona para o Saldo de Estoque, que usa o fluxo correto.
export default function Estoque() {
  return <Navigate to={createPageUrl('SaldoEstoque')} replace />;
}
