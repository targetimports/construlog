import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Whitelabel: nome do sistema, logo e favicon, definidos em /ConfiguracoesEmpresa
// (entidade Empresa: nome_sistema, logo_url, favicon_url). Cacheado em localStorage
// para aplicar instantaneamente (inclusive na tela de login, que é pré-auth).

const DEFAULTS = {
  nome: 'Construlog',
  logo_url: '/construlog-logo.png',
  favicon_url: '/icon.svg'
};

export function lerBrandingCache() {
  try {
    const cached = JSON.parse(localStorage.getItem('branding') || '{}');
    // Descarta referência a asset removido (logo antiga Germanos).
    if (cached.logo_url && String(cached.logo_url).includes('germanos-logo')) delete cached.logo_url;
    return { ...DEFAULTS, ...cached };
  } catch {
    return { ...DEFAULTS };
  }
}

export function useBranding() {
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
    staleTime: 5 * 60 * 1000
  });
  // Branding é do grupo → vem da MATRIZ (fallback p/ a primeira empresa visível).
  const emp = empresas.find((e) => e.tipo === 'matriz') || empresas[0];
  // A Empresa é a fonte da verdade. ENQUANTO ela carrega, usamos o último branding
  // conhecido (cache do localStorage), não o DEFAULT — assim a logo salva (ex.: Germanos)
  // aparece de imediato, sem o "flash" da logo padrão (Construlog) antes de carregar.
  const cache = lerBrandingCache();
  return {
    nome: emp?.nome_sistema || emp?.nome || cache.nome,
    logo_url: emp?.logo_url || cache.logo_url,
    favicon_url: emp?.favicon_url || cache.favicon_url
  };
}

// Resolve a EMPRESA (para cabeçalho de PDF: razão social, CNPJ, endereço, logo)
// + o branding, dado o empresa_id de uma obra. Fallback: matriz → 1º membro.
// Compartilha a mesma queryKey ['empresas'] (cache único, não filtra o branding).
export function useEmpresaBranding(empresaId) {
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
    staleTime: 5 * 60 * 1000
  });
  const cache = lerBrandingCache();
  const matriz = empresas.find((e) => e.tipo === 'matriz');
  const empresa =
    (empresaId && empresas.find((e) => e.id === empresaId)) ||
    matriz ||
    empresas.find((e) => e.tipo === 'membro') ||
    {};
  const src = empresa.id ? empresa : (matriz || {});
  const branding = {
    nome: src.nome_sistema || src.nome || cache.nome,
    logo_url: src.logo_url || cache.logo_url,
    favicon_url: src.favicon_url || cache.favicon_url
  };
  return { empresa, branding };
}

// Aplica o título da aba + favicon e atualiza o cache. Montar uma vez no Layout.
export function BrandingEffect() {
  const b = useBranding();
  useEffect(() => {
    if (b.nome) document.title = b.nome;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'icon');
      document.head.appendChild(link);
    }
    if (b.favicon_url) link.setAttribute('href', b.favicon_url);
    try {
      localStorage.setItem('branding', JSON.stringify({ nome: b.nome, logo_url: b.logo_url, favicon_url: b.favicon_url }));
    } catch { /* ignore */ }
  }, [b.nome, b.logo_url, b.favicon_url]);
  return null;
}
