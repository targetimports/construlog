import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';

// VISOR DE FOTOS do sistema — abre a imagem em tela cheia, navega entre as fotos
// (setas na tela, ← →, clique no fundo para fechar) e baixa o arquivo.
// Extraído do detalhe de recebimento de material para servir também à O.S. da frota:
// a regra é a mesma em qualquer lugar — foto de comprovação não abre em outra aba.
//
// COMO USAR dentro de um Dialog do Radix (importante, tem duas armadilhas):
//   1) o visor é renderizado em PORTAL no body, senão o `fixed inset-0` fica preso à
//      caixa do modal (que tem transform) e a foto sai espremida;
//   2) por estar no body, o Radix lê os cliques dele como "fora do modal" e fecharia
//      o modal junto. Então, enquanto o visor estiver aberto, trave no DialogContent:
//        onInteractOutside={(e) => { if (idx != null) e.preventDefault(); }}
//        onEscapeKeyDown={(e) => { if (idx != null) e.preventDefault(); }}

// Baixa a imagem de fato (fetch → blob → link), em vez de só abrir em nova aba:
// a URL é da própria aplicação (mesma origem), então o navegador salva o arquivo.
export async function baixarImagem(url, nome) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = nome || (url.split('/').pop() || 'foto.jpg');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    // Fallback: abre em nova aba para o usuário salvar manualmente.
    window.open(url, '_blank', 'noopener');
    toast.info('Abrindo a imagem em nova aba para salvar.');
  }
}

/**
 * @param fotos    array de URLs
 * @param index    índice aberto (null = fechado)
 * @param onIndex  setter do índice (recebe função, igual a um useState)
 * @param nomeBase prefixo do arquivo ao baixar (ex.: 'os-saida')
 */
export default function Lightbox({ fotos = [], index, onClose, onIndex, nomeBase = 'foto' }) {
  const aberto = index != null && fotos[index];
  const ir = useCallback((delta) => {
    onIndex((i) => (i == null ? null : (i + delta + fotos.length) % fotos.length));
  }, [fotos.length, onIndex]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') ir(1);
      else if (e.key === 'ArrowLeft') ir(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, ir, onClose]);

  if (!aberto) return null;
  const multi = fotos.length > 1;

  // Fundo escuro: clicar nele fecha SÓ o visor. Setas/X param a propagação para não
  // disparar esse fechamento de fundo. pointer-events-auto: o Radix põe
  // pointer-events:none no body enquanto o modal está aberto — sem isto os cliques do
  // visor (que é portal no body) não chegariam a lugar nenhum.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center pointer-events-auto" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <button type="button" onClick={(e) => { e.stopPropagation(); baixarImagem(fotos[index], `${nomeBase}-${index + 1}.jpg`); }}
          className="text-white/80 hover:text-white p-2" title="Baixar esta foto">
          <Download className="w-6 h-6" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/80 hover:text-white p-2" title="Fechar (Esc)">
          <X className="w-6 h-6" />
        </button>
      </div>

      {multi && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); ir(-1); }}
            className="absolute left-3 sm:left-6 text-white/70 hover:text-white bg-black/30 rounded-full p-2" title="Anterior (←)">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); ir(1); }}
            className="absolute right-3 sm:right-6 text-white/70 hover:text-white bg-black/30 rounded-full p-2" title="Próxima (→)">
            <ChevronRight className="w-7 h-7" />
          </button>
        </>
      )}

      <figure className="max-w-[90vw] max-h-[88vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={fotos[index]} alt={`Foto ${index + 1}`} className="max-w-full max-h-[82vh] object-contain rounded shadow-2xl" />
        {multi && <figcaption className="text-white/70 text-xs mt-3 tabular-nums">{index + 1} / {fotos.length}</figcaption>}
      </figure>
    </div>,
    document.body
  );
}
