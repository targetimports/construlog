import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NavbarPublica from './NavbarPublica';
import Ajuda from '@/pages/Ajuda';

// CENTRAL DE AJUDA para quem NÃO está logado.
//
// Mesma página de conteúdo (@/pages/Ajuda), embrulhada na casca pública em vez do
// Layout do app: nada de sidebar, TopHeader, notificações ou seletor de empresa —
// esses componentes leem a sessão e não fazem sentido para um visitante.
//
// Por que isso é seguro: a Ajuda é conteúdo estático (uma lista fixa de aulas e os
// vídeos servidos pelo nginx). Ela não chama nenhuma entidade nem função do
// backend, então "abrir sem login" não expõe dado algum. E a rota pública é só
// esta: qualquer outra continua passando pelo gate de auth do App, e toda /api
// continua exigindo sessão no servidor — o front nunca foi a trava.
export default function AjudaPublica() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <NavbarPublica transparenteNoTopo={false} />
      {/* pt-16 = altura da navbar fixa. */}
      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Voltar à landing. Só existe aqui, na versão pública: quem está logado
              chega pela sidebar e volta por ela. */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 -ml-1 mb-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <Ajuda />
        </div>
      </main>
    </div>
  );
}
