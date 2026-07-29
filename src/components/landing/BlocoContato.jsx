import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Mail, MessageCircle } from 'lucide-react';

// BLOCO DE CONTATO — duas colunas: promessa à esquerda, formulário à direita.
//
// Um componente só, usado em dois lugares: a seção "Contato" da landing e o
// modal que abre pelos botões dos planos. Assim o texto, a validação e o envio
// não divergem entre as duas portas.
//
// `plano` (opcional) só pré-preenche a mensagem — quem clicou em "Falar com
// especialista" no cartão Construtora não devia ter que digitar isso de novo.
export default function BlocoContato({ contato = {}, plano = null, onEnviado }) {
  const [form, setForm] = useState({ nome: '', email: '', mensagem: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erros, setErros] = useState({});

  useEffect(() => {
    if (!plano) return;
    setForm((f) => (f.mensagem ? f : { ...f, mensagem: `Tenho interesse no plano ${plano}. ` }));
  }, [plano]);

  const setCampo = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const enviar = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.nome.trim()) err.nome = 'Informe seu nome.';
    if (!form.email.trim()) err.email = 'Informe seu e-mail.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) err.email = 'E-mail inválido.';
    if (!form.mensagem.trim()) err.mensagem = 'Escreva sua mensagem.';
    setErros(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    try {
      const res = await fetch('/api/public/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          mensagem: form.mensagem.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setEnviado(true);
        setForm({ nome: '', email: '', mensagem: '' });
        onEnviado?.();
      } else if (res.status === 429) {
        setErros({ geral: 'Muitas tentativas. Aguarde um instante e tente de novo.' });
      } else {
        setErros({ geral: 'Não foi possível enviar agora. Tente novamente.' });
      }
    } catch {
      setErros({ geral: 'Falha de conexão. Tente novamente.' });
    } finally {
      setEnviando(false);
    }
  };

  const campo = (erro) =>
    `w-full h-12 rounded-xl border px-4 text-[15px] outline-none transition-colors focus:border-blue-500 ${
      erro ? 'border-red-400' : 'border-gray-200'
    }`;

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Contato</span>
        <h2 className="mt-4 text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-[1.1]">
          Vamos ver o sistema
          <br />com a sua obra?
        </h2>
        <p className="mt-5 text-lg text-gray-500 leading-relaxed">
          Uma conversa de 30 minutos. A gente mostra o sistema rodando com um
          orçamento parecido com o seu e você decide sem compromisso.
        </p>

        {plano && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-sm font-medium text-blue-700">
            Plano {plano}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {contato.whatsapp && (
            <a
              href={`https://wa.me/${contato.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 px-5 py-4 hover:border-gray-300 transition-colors"
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-50">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </span>
              <span>
                <span className="block text-sm font-medium">WhatsApp</span>
                <span className="block text-sm text-gray-400">Resposta no mesmo dia útil</span>
              </span>
            </a>
          )}
          {contato.email && (
            <a
              href={`mailto:${contato.email}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 px-5 py-4 hover:border-gray-300 transition-colors"
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50">
                <Mail className="w-5 h-5 text-blue-600" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">E-mail</span>
                <span className="block text-sm text-gray-400 truncate">{contato.email}</span>
              </span>
            </a>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        {enviado ? (
          <div className="text-center py-10">
            <div className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-emerald-50 mb-4">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-lg">Mensagem enviada.</p>
            <p className="mt-2 text-sm text-gray-500">Retornamos no próximo dia útil.</p>
            <button
              type="button"
              onClick={() => setEnviado(false)}
              className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setCampo('nome', e.target.value)}
                placeholder="Como podemos te chamar?"
                className={campo(erros.nome)}
              />
              {erros.nome && <p className="mt-1 text-xs text-red-500">{erros.nome}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setCampo('email', e.target.value)}
                placeholder="voce@construtora.com.br"
                className={campo(erros.email)}
              />
              {erros.email && <p className="mt-1 text-xs text-red-500">{erros.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mensagem *</label>
              <textarea
                rows={4}
                value={form.mensagem}
                onChange={(e) => setCampo('mensagem', e.target.value)}
                placeholder="Quantas obras você toca hoje? O que mais te incomoda na gestão?"
                className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none transition-colors resize-none focus:border-blue-500 ${
                  erros.mensagem ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              {erros.mensagem && <p className="mt-1 text-xs text-red-500">{erros.mensagem}</p>}
            </div>

            {erros.geral && <p className="text-sm text-red-500">{erros.geral}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors text-white text-[15px] font-medium rounded-full h-12"
            >
              {enviando ? 'Enviando...' : 'Quero uma demonstração'}
              {!enviando && <ArrowRight className="w-4 h-4" />}
            </button>
            <p className="text-center text-xs text-gray-400">
              Sem compromisso. Não enviamos spam.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
