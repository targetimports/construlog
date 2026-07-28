import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// NAVBAR PÚBLICA — usada nas telas que existem SEM login: a landing ("/") e a
// Central de Ajuda ("/Ajuda").
//
// Deliberadamente burra: não lê o usuário, não consulta permissão, não sabe nada
// do app. É essa ignorância que a torna segura de renderizar para um visitante
// anônimo — ao contrário da sidebar/TopHeader, que dependem de sessão.
//
// O nome do grupo vem de /api/public/branding, o único endpoint que responde sem
// autenticação (e devolve só nome e logo).
export default function NavbarPublica({ transparenteNoTopo = true }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(!transparenteNoTopo);
  const [brandNome, setBrandNome] = useState('');

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.nome_empresa) setBrandNome(d.nome_empresa); })
      .catch(() => { /* sem branding, mostra só "Construlog" */ });
  }, []);

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
        scrolled ? 'bg-white/55 backdrop-blur-2xl' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-baseline gap-1.5 min-w-0"
        >
          <span className="font-semibold tracking-tight text-lg text-gray-900">Construlog</span>
          {brandNome && (
            <span className="font-normal tracking-tight text-lg text-gray-300 truncate">- {brandNome}</span>
          )}
        </button>
        {/* Acesso ao sistema — discreto, para funcionários. */}
        <button
          onClick={() => navigate('/Dashboard')}
          className="text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors shrink-0"
        >
          Entrar
        </button>
      </nav>
    </header>
  );
}
