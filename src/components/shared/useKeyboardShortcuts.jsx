import { useEffect } from 'react';

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      // Ignora se estiver em input/textarea (exceto Esc)
      if (key !== 'escape') {
        const target = event.target;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      shortcuts.forEach(({ keys, action, preventDefault = true }) => {
        const [mainKey, ...modifiers] = keys.split('+').reverse();
        const needsCtrl = modifiers.includes('ctrl');
        const needsShift = modifiers.includes('shift');
        const needsAlt = modifiers.includes('alt');

        if (
          key === mainKey.toLowerCase() &&
          ctrl === needsCtrl &&
          shift === needsShift &&
          alt === needsAlt
        ) {
          if (preventDefault) {
            event.preventDefault();
          }
          action(event);
        }
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Atalhos globais comuns
export const COMMON_SHORTCUTS = {
  SAVE: 'ctrl+s',
  SEARCH: 'ctrl+k',
  NEW: 'ctrl+n',
  CLOSE: 'escape',
  REFRESH: 'ctrl+r',
  HELP: 'shift+?'
};