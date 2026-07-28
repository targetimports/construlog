import * as React from "react"

import { cn } from "@/lib/utils"
import { applyMask, STRING_MASKS } from "@/lib/masks"

const Input = React.forwardRef(({ className, type, mask, ...props }, ref) => {
  // ── Máscara pt-BR opcional (cpf/cnpj/telefone/cep) ──────────────────────
  // Ativada só quando a prop `mask` é uma máscara de string. Formata o texto
  // digitado e também o valor que chega (idempotente), sem alterar nada dos
  // demais inputs. Máscaras numéricas (moeda/número) usam componentes próprios.
  const maskAtiva = mask && STRING_MASKS.has(mask);
  const maskOverrides = maskAtiva
    ? {
        value: props.value != null ? applyMask(mask, String(props.value)) : props.value,
        onChange: (e) => {
          e.target.value = applyMask(mask, e.target.value);
          props.onChange?.(e);
        },
      }
    : {};
  // ── Fix global dos inputs numéricos controlados ─────────────────────────
  // Padrão comum nas telas: onChange faz `parseFloat(v) || 0`, então ao apagar
  // tudo o estado do pai vira 0 e o campo re-renderiza "0" — o zero "não sai".
  // Solução: enquanto o campo está EM FOCO, exibimos um rascunho local com o
  // que o usuário digitou (pode ficar vazio); o pai continua recebendo os
  // onChange normalmente (cálculos seguem valendo). No blur, volta a espelhar
  // o valor do pai. Só se aplica a type="number" CONTROLADO (com prop value);
  // inputs de texto e não-controlados (react-hook-form etc.) passam direto.
  const [draft, setDraft] = React.useState(null);
  const numericoControlado = type === "number" && props.value !== undefined;

  const overrides = numericoControlado
    ? {
        value: draft !== null ? draft : props.value,
        onFocus: (e) => {
          setDraft(e.target.value);
          props.onFocus?.(e);
        },
        onChange: (e) => {
          setDraft(e.target.value);
          props.onChange?.(e);
        },
        onBlur: (e) => {
          setDraft(null);
          props.onBlur?.(e);
        },
      }
    : {};

  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-base text-gray-900 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
      {...overrides}
      {...maskOverrides} />)
  );
})
Input.displayName = "Input"

export { Input }
