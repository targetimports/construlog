/**
 * Parte 2: formulários que dependem de react-query / base44 (mockados).
 * Foco nos que mexem com dinheiro e estoque.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, {
      get: () => ({ list: async () => [], filter: async () => [], create: async () => ({}), update: async () => ({}) }),
    }),
    auth: { me: async () => ({ email: 'x@x.com', full_name: 'X' }) },
    functions: { invoke: async () => ({ data: {} }) },
    integrations: { Core: { UploadFile: async () => ({ file_url: 'u' }) } },
  },
}));

import { toast } from 'sonner';
import DialogBaixaRecebimento from '@/components/financeiro/DialogBaixaRecebimento';
import FormApontamentoHoraModal from '@/components/rh/FormApontamentoHoraModal';
import ClienteForm from '@/components/clientes/ClienteForm';

const wrap = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('DialogBaixaRecebimento', () => {
  const conta = { id: 'r1', valor: 1000, valor_recebido: 0 };

  it('CAMINHO FELIZ: baixa com o valor restante sugerido', () => {
    const onConfirm = vi.fn();
    wrap(<DialogBaixaRecebimento open conta={conta} onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Recebimento/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].valor_recebido).toBe(1000);
  });

  it('recusa valor acima do restante', () => {
    const onConfirm = vi.fn();
    wrap(<DialogBaixaRecebimento open conta={conta} onClose={vi.fn()} onConfirm={onConfirm} />);
    const inputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Recebimento/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Verifique os campos destacados.');
  });

  it('recusa data futura', () => {
    const onConfirm = vi.fn();
    wrap(<DialogBaixaRecebimento open conta={conta} onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2099-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Recebimento/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('A data não pode ser futura')).toBeTruthy();
  });
});

describe('FormApontamentoHoraModal', () => {
  it('bloqueia apontamento sem horas (0 normais + 0 extras)', () => {
    const onSave = vi.fn();
    wrap(<FormApontamentoHoraModal apontamento={null} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Informe as horas trabalhadas')).toBeTruthy();
  });
});

describe('ClienteForm', () => {
  it('bloqueia CPF/CNPJ pela metade', () => {
    wrap(<ClienteForm cliente={null} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Nome do cliente'), { target: { value: 'Cliente A' } });
    fireEvent.change(screen.getByPlaceholderText('CPF ou CNPJ'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Cliente/i }));
    expect(screen.getByText('CPF (11 dígitos) ou CNPJ (14 dígitos)')).toBeTruthy();
  });

  it('CAMINHO FELIZ: aceita só o nome (demais campos são opcionais)', async () => {
    const onSave = vi.fn();
    wrap(<ClienteForm cliente={null} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Nome do cliente'), { target: { value: 'Cliente B' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Cliente/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(toast.error).not.toHaveBeenCalledWith('Verifique os campos destacados.');
  });
});
