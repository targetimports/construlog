// Service worker customizado (estratégia injectManifest do vite-plugin-pwa).
// Objetivo: PWA instalável/offline COM atualização garantida — ao ativar uma
// versão nova (após um deploy), o SW RECARREGA as abas abertas. Assim um único
// F5 já mostra as alterações, sem precisar "limpar storage / desregistrar SW",
// e isso também destrava um SW antigo preso.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';

// Ativa o SW novo imediatamente (não espera as abas fecharem).
self.skipWaiting();
cleanupOutdatedCaches();

// Precache do app-shell (assets versionados pelo Vite) → habilita offline/instalável.
precacheAndRoute(self.__WB_MANIFEST || []);

// Chamadas ao backend NUNCA são cacheadas (dados sempre da rede).
registerRoute(({ url }) => url.pathname.startsWith('/api'), new NetworkOnly());

// Navegações (HTML): rede primeiro → o F5 traz o index.html novo (que aponta
// pros assets novos); cai no cache só quando offline.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'html-nav', networkTimeoutSeconds: 4 }),
    { denylist: [/^\/api\//] },
  ),
);

// Assume o controle das abas abertas assim que ativa. O reload para a versão
// nova é disparado NO CLIENTE (listener de 'controllerchange' em main.jsx).
// NÃO usamos client.navigate() aqui: ele é instável e às vezes deixa o spinner
// da aba girando para sempre mesmo com a página já carregada.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
