import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// NAVBAR PÚBLICA — usada nas telas que existem SEM login: a landing ("/") e a
// Central de Ajuda ("/Ajuda").
//
// Deliberadamente burra: não lê o usuário, não consulta permissão, não sabe nada
// do app. É essa ignorância que a torna segura de renderizar para um visitante
// anônimo — ao contrário da sidebar/TopHeader, que dependem de sessão.
//
// Enxuta de propósito: marca à esquerda, ações à direita. Sem menu de âncoras —
// a landing é uma página só, e quem chega rola.
// `mostrarEntrar`: a landing é página de venda — quem chega ali é visitante, não
// usuário do sistema, e um botão de login só rouba atenção do único caminho que
// importa (falar com a gente). Na Central de Ajuda o atalho continua fazendo
// sentido, então o padrão é mostrar.
export default function NavbarPublica({ transparenteNoTopo = true, cta = null, mostrarEntrar = true }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(!transparenteNoTopo);

  useEffect(() => {
    if (!transparenteNoTopo) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparenteNoTopo]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl border-b border-gray-100' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-semibold tracking-tight text-lg text-gray-900 shrink-0"
        >
          Construlog
        </button>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          {/* Entrar aponta para /Login, não para /Dashboard: sem sessão, as rotas
              do sistema respondem 404 e o visitante ficaria sem porta de entrada. */}
          {mostrarEntrar && (
            <button
              onClick={() => navigate('/Login')}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Entrar
            </button>
          )}
          {cta && (
            cta.onClick ? (
              <button
                type="button"
                onClick={cta.onClick}
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium rounded-full px-5 h-10"
              >
                {cta.label}
              </button>
            ) : (
              <a
                href={cta.href}
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium rounded-full px-5 h-10"
              >
                {cta.label}
              </a>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
