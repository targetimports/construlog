import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Whitelabel: aplica o título da aba + favicon cacheados antes do React montar,
// para que a marca apareça já no primeiro paint (e na tela de login, pré-auth).
try {
  const b = JSON.parse(localStorage.getItem('branding') || '{}');
  if (b.nome) document.title = b.nome;
  if (b.favicon_url) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'icon'); document.head.appendChild(link); }
    link.setAttribute('href', b.favicon_url);
  }
} catch { /* ignore */ }

// PWA: quando um service worker NOVO assume o controle (após um deploy), recarrega
// a aba UMA vez para mostrar a versão nova — é isso que faz um único F5 bastar.
// Guards: 'recarregando' evita loop; 'tinhaController' evita recarregar na 1ª
// instalação (quando ainda não havia SW controlando a página).
if ('serviceWorker' in navigator) {
  let recarregando = false;
  const tinhaController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando || !tinhaController) return;
    recarregando = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
