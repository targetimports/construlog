import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, Phone, Mail } from 'lucide-react';

// BLOQUEIO POR LICENÇA — o que o usuário vê quando o acesso foi suspenso.
//
// POR QUE NÃO É UM OVERLAY:
// Um modal por cima do sistema é removível pelo console em dois cliques — bastava
// apagar o nó e o sistema apareceria funcionando embaixo. Aqui a tela de bloqueio
// SUBSTITUI a árvore da aplicação: quem apagar o elemento fica com a página em
// branco, porque não existe sistema renderizado atrás.
//
// E, principalmente: o bloqueio de verdade é no SERVIDOR. Com a licença negada, o
// backend responde 423 em toda rota de API (backend/src/licenca.js). Mesmo um
// front totalmente adulterado não lê nem grava nada — esta tela é o aviso, não a
// tranca. Nunca tratar front como barreira de segurança.

const INTERVALO_MS = 30_000;

/**
 * Estado da licença desta instalação, direto do backend.
 * Falha de rede NÃO bloqueia (mesma regra do servidor): problema nosso não pode
 * parar a obra do cliente.
 */
export function useLicenca() {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    let vivo = true;

    const consultar = async () => {
      try {
        const r = await fetch('/api/licenca', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (vivo) setEstado(d);
      } catch {
        // Sem resposta: mantém o que já se sabia.
      }
    };

    consultar();
    const t = setInterval(consultar, INTERVALO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  // Só bloqueia com uma negativa explícita de um licenciamento ativo.
  const bloqueado = estado?.ativo === true && estado?.autorizado === false;
  return { estado, bloqueado };
}

const CONTATO = {
  telefone: '(75) 99999-0000',
  email: 'suporte@construlog.com.br',
};

export default function BloqueioLicenca({ estado }) {
  // Trava a rolagem enquanto a tela estiver no ar.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const mensagem = estado?.mensagem
    || 'O acesso a este sistema está temporariamente suspenso.';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 bg-red-600 px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">Acesso suspenso</p>
            <p className="text-xs text-red-100">O sistema está indisponível no momento</p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-gray-700">{mensagem}</p>

          {estado?.dias_atraso != null && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
              <p className="text-sm text-amber-800">
                Pagamento em atraso há <strong>{estado.dias_atraso} dia(s)</strong>.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Fale com o suporte
            </p>
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                {CONTATO.telefone}
              </p>
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="break-all">{CONTATO.email}</span>
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-gray-400">
            Seus dados estão preservados. Assim que a pendência for regularizada, o
            acesso é liberado automaticamente em até 30 segundos.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Verificar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
