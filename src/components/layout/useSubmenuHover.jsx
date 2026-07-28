import { useRef, useCallback } from 'react';

export function useSubmenuHover(submenuId) {
  const closeTimeoutRef = useRef(null);
  const hoverZoneRef = useRef(null);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback((callback, delay = 150) => {
    closeTimeoutRef.current = setTimeout(() => {
      callback();
      closeTimeoutRef.current = null;
    }, delay);
  }, []);

  const handleMouseEnterZone = useCallback((callback) => {
    cancelClose();
    callback();
  }, [cancelClose]);

  const handleMouseLeaveZone = useCallback((callback, delay = 150) => {
    scheduleClose(callback, delay);
  }, [scheduleClose]);

  const cleanup = useCallback(() => {
    cancelClose();
  }, [cancelClose]);

  return {
    hoverZoneRef,
    cancelClose,
    scheduleClose,
    handleMouseEnterZone,
    handleMouseLeaveZone,
    cleanup
  };
}