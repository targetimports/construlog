/**
 * Teste de fumaça das validações adicionadas nesta sessão.
 *
 * Objetivo: garantir que (a) o formulário BLOQUEIA e mostra a mensagem quando falta
 * campo, e (b) NÃO bloqueia o caminho feliz — o risco real de endurecer validação é
 * travar quem estava usando o sistema normalmente.
 *
 * Roda sem login: monta o componente direto, sem passar pela tela de autenticação.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from 'sonner';
import FormMovimentacao from '@/components/tesouraria/FormMovimentacao';
import FormNovaConta from '@/components/tesouraria/FormNovaConta';

const CONTAS = [
  { id: 'c1', nome: 'Caixa Central', saldo_atual: 1000, status: 'ativa' },
  { id: 'c2', nome: 'Bradesco CC', saldo_atual: 500, status: 'ativa' },
];

beforeEach(() => vi.clearAllMocks());
// Sem `globals: true` no vitest, o cleanup automático do Testing Library não roda.
afterEach(() => cleanup());

describe('FormMovimentacao (Entrada/Saída/Transferência)', () => {
  it('bloqueia e mostra o que falta quando o formulário está vazio', () => {
    const onSubmit = vi.fn();
    render(<FormMovimentacao open tipo="entrada" contas={CONTAS} obras={[]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Entrada/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Selecione a conta')).toBeTruthy();
    expect(screen.getByText('Informe um valor maior que zero')).toBeTruthy();
    expect(screen.getByText('Descreva a movimentação')).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Verifique os campos destacados.');
  });

  it('acusa valor zero (não deixa lançar movimentação sem dinheiro)', () => {
    const onSubmit = vi.fn();
    render(<FormMovimentacao open tipo="saida" contas={CONTAS} obras={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Saída/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Informe um valor maior que zero')).toBeTruthy();
  });

  it('erro some ao corrigir o campo', () => {
    render(<FormMovimentacao open tipo="entrada" contas={CONTAS} obras={[]} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Entrada/i }));
    expect(screen.getByText('Descreva a movimentação')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Descreva a movimentação'), { target: { value: 'Aporte' } });
    expect(screen.queryByText('Descreva a movimentação')).toBeNull();
  });
});

describe('FormNovaConta', () => {
  it('bloqueia sem nome', () => {
    const onSubmit = vi.fn();
    render(<FormNovaConta open conta={null} obras={[]} empresas={[]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Informe o nome da conta')).toBeTruthy();
  });

  it('CAMINHO FELIZ: salva normalmente quando o mínimo está preenchido', () => {
    const onSubmit = vi.fn();
    render(<FormNovaConta open conta={null} obras={[]} empresas={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Bradesco CC 1234'), { target: { value: 'Caixa Obra' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].nome).toBe('Caixa Obra');
  });

  it('exige a empresa dona do caixa quando o usuário pode escolher', () => {
    const onSubmit = vi.fn();
    render(
      <FormNovaConta open conta={null} obras={[]} empresas={[{ id: 'e1', nome: 'Matriz' }]}
        podeEscolherEmpresa onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByPlaceholderText('Ex: Bradesco CC 1234'), { target: { value: 'Caixa X' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Selecione a empresa dona do caixa')).toBeTruthy();
  });
});
