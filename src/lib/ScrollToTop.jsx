import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Ao trocar de rota, volta ao topo.
//
// O navegador só restaura scroll em navegação real; numa SPA a URL muda mas a
// página é a mesma, então a posição antiga permanece — quem clicava no CTA no pé
// da landing caía na Central de Ajuda já no rodapé, vendo a aula 8 primeiro.
//
// Âncoras (#recursos, #contato) são exceção: ali a intenção é justamente rolar
// até um ponto, então saímos do caminho.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
